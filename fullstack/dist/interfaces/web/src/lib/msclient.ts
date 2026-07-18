// Waypoint's own platform client — replaces '@mindstudio-ai/interface'.
// Talks to the server in backend/plugin.ts: bearer-token sessions in
// localStorage, /_/auth/* for email-code sign-in, and /_/methods/<name>/invoke
// for backend calls (plain JSON, or SSE when { stream: true }).

export interface InvokeOptions {
  stream?: boolean;
  onToken?: (text: string) => void;
  onStreamData?: (data: unknown) => void;
  onStreamError?: (error: string) => void;
}

export interface SessionUser {
  id: string;
  email: string | null;
  roles: string[];
  displayName?: string;
  [key: string]: unknown;
}

const TOKEN_KEY = 'waypoint_session';
const USER_KEY = 'waypoint_user';

type AuthStatus = 'initializing' | 'authenticating' | 'authenticated' | 'unauthenticated';

let token: string | null = localStorage.getItem(TOKEN_KEY);
let currentUser: SessionUser | null = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
let status: AuthStatus = token ? 'authenticating' : 'unauthenticated';
const listeners = new Set<(user: SessionUser | null) => void>();

function setSession(nextToken: string | null, nextUser: SessionUser | null) {
  token = nextToken;
  currentUser = nextUser;
  status = nextUser ? 'authenticated' : 'unauthenticated';
  if (nextToken) localStorage.setItem(TOKEN_KEY, nextToken);
  else localStorage.removeItem(TOKEN_KEY);
  if (nextUser) localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
  else localStorage.removeItem(USER_KEY);
  listeners.forEach((cb) => cb(currentUser));
}

async function authFetch(path: string, body?: unknown): Promise<Response> {
  return fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

// Validate a restored session on startup; a dead token logs the visitor out.
if (token) {
  authFetch('/_/auth/me')
    .then(async (res) => {
      if (res.ok) setSession(token, (await res.json()).user);
      else setSession(null, null);
    })
    .catch(() => {
      // Server unreachable — keep the cached user so a flaky reload still works.
      status = currentUser ? 'authenticated' : 'unauthenticated';
      listeners.forEach((cb) => cb(currentUser));
    });
}

export const auth = {
  get currentUser(): SessionUser | null {
    return currentUser;
  },
  get authStatus(): AuthStatus {
    return status;
  },
  onAuthStateChanged(cb: (user: SessionUser | null) => void): () => void {
    listeners.add(cb);
    cb(currentUser);
    return () => listeners.delete(cb);
  },
  async signup(email: string, password: string): Promise<void> {
    const res = await authFetch('/_/auth/signup', { email, password });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not create the account.');
    const out = await res.json();
    setSession(out.token, out.user);
  },
  async login(email: string, password: string): Promise<void> {
    const res = await authFetch('/_/auth/login', { email, password });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Wrong email or password.');
    const out = await res.json();
    setSession(out.token, out.user);
  },
  async logout(): Promise<void> {
    await authFetch('/_/auth/logout', {}).catch(() => {});
    setSession(null, null);
  },
};

async function invoke(name: string, input: unknown, opts?: InvokeOptions): Promise<any> {
  const res = await fetch(`/_/methods/${name}/invoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ input: input ?? {}, ...(opts?.stream ? { stream: true } : {}) }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({} as any));
    throw new Error(body.error || `Method "${name}" failed: ${res.status}`);
  }
  if (!opts?.stream) return (await res.json()).output;

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let output: any;
  let streamError: string | undefined;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      let event: any;
      try { event = JSON.parse(line.slice(6)); } catch { continue; }
      if (event.type === 'token' && event.text) opts.onToken?.(event.text);
      else if (event.type === 'data') opts.onStreamData?.(event.data);
      else if (event.type === 'error' && event.error) {
        streamError = event.error;
        opts.onStreamError?.(event.error);
      } else if (event.type === 'done') output = event.output;
    }
  }
  if (output === undefined && streamError !== undefined) throw new Error(streamError);
  if (output === undefined) throw new Error('Stream ended without a done event');
  return output;
}

export function createClient<T>(): T {
  return new Proxy({} as any, {
    get: (_target, name: string) => (input?: unknown, opts?: InvokeOptions) => invoke(name, input, opts),
  }) as T;
}

// Kept for API compatibility with the old SDK surface; nothing to do here.
export const platform = {};
export const analytics = {};
