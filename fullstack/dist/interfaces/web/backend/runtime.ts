// Waypoint's standalone backend runtime — replaces '@mindstudio-ai/agent'.
// The backend methods in dist/methods/src import that package; a Vite alias
// points them here instead, so the whole backend runs on our own stack:
//   auth      → email+password accounts with bearer-token sessions
//   db        → Supabase (Postgres, when SUPABASE_URL is set) or local SQLite
//   stream    → forwarded to the HTTP response as SSE events
//   mindstudio.generateText → the xAI (Grok) chat-completions API
// Only the surface the methods actually use is implemented.
import { AsyncLocalStorage } from 'node:async_hooks';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Storage — one generic collection of JSON rows, filtered in JS.
// Supabase (PostgREST over fetch, zero deps) when configured, else SQLite.
// ---------------------------------------------------------------------------

interface StoredRow {
  id: string;
  data: Record<string, any>;
  created_at: number;
  updated_at: number;
}

interface Store {
  all(tbl: string): Promise<StoredRow[]>;
  one(tbl: string, id: string): Promise<StoredRow | null>;
  put(tbl: string, row: StoredRow): Promise<void>;
  del(tbl: string, id: string): Promise<void>;
}

function sqliteStore(): Store {
  const here = import.meta.url ? path.dirname(fileURLToPath(import.meta.url)) : process.cwd();
  const file = process.env.WAYPOINT_DB || path.resolve(here, '../../../../.data/waypoint.db');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const d = new DatabaseSync(file);
  d.exec(`
    CREATE TABLE IF NOT EXISTS rows (
      tbl TEXT NOT NULL,
      id TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (tbl, id)
    );
  `);
  const parse = (r: any): StoredRow => ({ id: r.id, data: JSON.parse(r.data), created_at: r.created_at, updated_at: r.updated_at });
  return {
    async all(tbl) {
      return (d.prepare('SELECT * FROM rows WHERE tbl = ?').all(tbl) as any[]).map(parse);
    },
    async one(tbl, id) {
      const r = d.prepare('SELECT * FROM rows WHERE tbl = ? AND id = ?').get(tbl, id) as any;
      return r ? parse(r) : null;
    },
    async put(tbl, row) {
      d.prepare('INSERT OR REPLACE INTO rows (tbl, id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run(tbl, row.id, JSON.stringify(row.data), row.created_at, row.updated_at);
    },
    async del(tbl, id) {
      d.prepare('DELETE FROM rows WHERE tbl = ? AND id = ?').run(tbl, id);
    },
  };
}

// Requires one real table per entity in the Supabase dashboard (SQL editor) —
// see fullstack/README.md for the full CREATE TABLE script. Each table shares
// the same generic shape (id, data jsonb, created_at, updated_at) so the app's
// schemaless method code works unchanged, but every entity now shows up as
// its own table in the Table Editor instead of one shared blob.
function supabaseStore(url: string, key: string): Store {
  const root = `${url.replace(/\/$/, '')}/rest/v1`;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const q = encodeURIComponent;
  const request = async (tbl: string, method: string, suffix: string, body?: unknown, prefer?: string) => {
    const res = await fetch(`${root}/${q(tbl)}${suffix}`, {
      method,
      headers: { ...headers, ...(prefer ? { Prefer: prefer } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`[waypoint db] Supabase ${method} ${tbl} failed ${res.status}: ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  };
  return {
    all: (tbl) => request(tbl, 'GET', '?select=*'),
    one: async (tbl, id) => ((await request(tbl, 'GET', `?id=eq.${q(id)}&select=*`)) as StoredRow[])[0] ?? null,
    put: async (tbl, row) => {
      await request(tbl, 'POST', '', [row], 'resolution=merge-duplicates,return=minimal');
    },
    del: async (tbl, id) => {
      await request(tbl, 'DELETE', `?id=eq.${q(id)}`);
    },
  };
}

let storeInstance: Store | null = null;
function store(): Store {
  if (!storeInstance) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      console.error('[waypoint] storage: Supabase');
      storeInstance = supabaseStore(url, key);
    } else {
      console.error('[waypoint] storage: local SQLite (set SUPABASE_URL + SUPABASE_SERVICE_KEY for hosted storage)');
      storeInstance = sqliteStore();
    }
  }
  return storeInstance;
}

let clock = Date.now();
const tick = () => ++clock; // strictly monotonic so created_at sorts are stable

type Row = Record<string, any>;

const flatten = (r: StoredRow): Row => ({ ...r.data, id: r.id, created_at: r.created_at, updated_at: r.updated_at });
const stripMeta = ({ id: _i, created_at: _c, updated_at: _u, ...data }: Row) => data;

async function insertRow(tbl: string, data: Row): Promise<Row> {
  const now = tick();
  const id = data.id || `${tbl.slice(0, 2)}-${randomUUID().slice(0, 13)}`;
  const row: StoredRow = { id, data: stripMeta(data), created_at: data.created_at ?? now, updated_at: now };
  await store().put(tbl, row);
  return flatten(row);
}

// ---------------------------------------------------------------------------
// db — the Table/Query/Mutation thenable shape the methods use
// ---------------------------------------------------------------------------

class LocalQuery<R> implements PromiseLike<R> {
  constructor(private exec: () => R | Promise<R>) {}
  sortBy(accessor: (row: any) => any): LocalQuery<R> {
    return new LocalQuery(async () => {
      const rows = await this.exec();
      if (!Array.isArray(rows)) return rows;
      return [...rows].sort((a, b) => {
        const av = accessor(a);
        const bv = accessor(b);
        return av < bv ? -1 : av > bv ? 1 : 0;
      }) as R;
    });
  }
  limit(n: number): LocalQuery<R> {
    return new LocalQuery(async () => {
      const rows = await this.exec();
      return (Array.isArray(rows) ? rows.slice(0, n) : rows) as R;
    });
  }
  then<TR1 = R, TR2 = never>(
    onfulfilled?: ((value: R) => TR1 | PromiseLike<TR1>) | null,
    onrejected?: ((reason: any) => TR2 | PromiseLike<TR2>) | null,
  ): Promise<TR1 | TR2> {
    return Promise.resolve().then(this.exec).then(onfulfilled, onrejected);
  }
}

function defineTable<T>(name: string, _options?: unknown) {
  return {
    get: (id: string) =>
      new LocalQuery<(T & Row) | null>(async () => {
        const r = await store().one(name, id);
        return r ? (flatten(r) as T & Row) : null;
      }),
    filter: (predicate: (row: any, bindings?: any) => boolean, bindings?: any) =>
      new LocalQuery<(T & Row)[]>(async () =>
        (await store().all(name)).map(flatten).filter((r) => predicate(r, bindings)) as (T & Row)[],
      ),
    push: (data: Row | Row[]) =>
      new LocalQuery(async () =>
        Array.isArray(data) ? Promise.all(data.map((d) => insertRow(name, d))) : insertRow(name, data),
      ),
    update: (id: string, data: Row) =>
      new LocalQuery(async () => {
        const existing = await store().one(name, id);
        if (!existing) throw new Error(`[db] update: no row ${id} in "${name}"`);
        return insertRow(name, { ...flatten(existing), ...data, id });
      }),
    remove: (id: string) =>
      new LocalQuery(async () => {
        await store().del(name, id);
        return { id };
      }),
  };
}

export const db = {
  defineTable,
  batch: (...items: PromiseLike<any>[]) => Promise.all(items),
};

// ---------------------------------------------------------------------------
// Request context: auth + stream
// ---------------------------------------------------------------------------

export interface RequestContext {
  userId: string | null;
  stream?: (data: string | Record<string, unknown>) => void;
}

const als = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(ctx: RequestContext, fn: () => Promise<T>): Promise<T> {
  return als.run(ctx, fn);
}

export const auth = {
  get userId(): string | null {
    return als.getStore()?.userId ?? null;
  },
  // Removes login credentials for the current account — the users table row
  // itself is a normal db-defined table, so the calling method removes that
  // part directly via Users.remove(). auth_accounts/sessions live outside
  // the db shim (see the auth service above), so this is the one place that
  // can reach them.
  async deleteAccount(): Promise<void> {
    const userId = als.getStore()?.userId;
    if (!userId) return;
    const user = await store().one('users', userId);
    if (user?.data?.email) await store().del('auth_accounts', user.data.email);
    const sessions = await store().all('sessions');
    await Promise.all(sessions.filter((s) => s.data?.userId === userId).map((s) => store().del('sessions', s.id)));
  },
};

export const stream = async (data: string | Record<string, unknown>): Promise<void> => {
  als.getStore()?.stream?.(data);
};

// ---------------------------------------------------------------------------
// mindstudio.generateText → xAI (Grok)
// ---------------------------------------------------------------------------

const XAI_URL = 'https://api.x.ai/v1/chat/completions';
const MODEL_PREFERENCE = ['grok-4-fast-non-reasoning', 'grok-3-mini', 'grok-3', 'grok-4'];

function xaiKey(): string | null {
  return process.env.XAI_API_KEY || process.env.GROK_API_KEY || process.env.grok || null;
}

let modelPromise: Promise<string> | null = null;
function pickModel(key: string): Promise<string> {
  if (process.env.XAI_MODEL) return Promise.resolve(process.env.XAI_MODEL);
  modelPromise ??= (async () => {
    try {
      const res = await fetch('https://api.x.ai/v1/models', { headers: { Authorization: `Bearer ${key}` } });
      if (res.ok) {
        const available = new Set<string>(((await res.json()).data ?? []).map((m: any) => m.id));
        const chosen = MODEL_PREFERENCE.find((m) => available.has(m)) || [...available][0];
        if (chosen) {
          console.error(`[waypoint] using xAI model: ${chosen}`);
          return chosen;
        }
      }
    } catch {}
    return MODEL_PREFERENCE[1];
  })();
  return modelPromise;
}

export const mindstudio = {
  async generateText(step: {
    message: string;
    modelOverride?: { model?: string; temperature?: number; maxResponseTokens?: number };
    structuredOutputType?: string;
    structuredOutputExample?: string;
  }): Promise<{ content: string }> {
    const key = xaiKey();
    if (!key) throw new Error('[waypoint] no xAI key found (set XAI_API_KEY or grok in the root .env)');
    const model = await pickModel(key);

    let content = step.message;
    if (step.structuredOutputType === 'json') {
      content += `\n\nRespond with a single JSON object and nothing else — no prose, no code fences.`;
      if (step.structuredOutputExample) content += ` Example shape: ${step.structuredOutputExample}`;
    }

    const res = await fetch(XAI_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content }],
        temperature: step.modelOverride?.temperature ?? 0.7,
        max_tokens: Math.min(step.modelOverride?.maxResponseTokens ?? 4000, 16000),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`[waypoint] xAI request failed ${res.status}: ${body.slice(0, 300)}`);
    }
    const out = (await res.json()).choices?.[0]?.message?.content ?? '';
    return { content: out };
  },

  // Real-time, search-grounded generation — xAI's Responses API with the
  // x_search (X/Twitter) + web_search tools, so answers reflect what people
  // are actually posting/recommending right now rather than only training
  // data. Different endpoint and response shape than generateText above
  // (output is an array of typed steps — reasoning, tool calls, and a final
  // "message" item — not a flat choices[0].message); requires grok-4.5.
  async generateWithSearch(step: { message: string; maxOutputTokens?: number }): Promise<{ content: string }> {
    const key = xaiKey();
    if (!key) throw new Error('[waypoint] no xAI key found (set XAI_API_KEY or grok in the root .env)');

    const res = await fetch('https://api.x.ai/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'grok-4.5',
        input: [{ role: 'user', content: step.message }],
        tools: [{ type: 'x_search' }, { type: 'web_search' }],
        max_output_tokens: Math.min(step.maxOutputTokens ?? 4000, 16000),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`[waypoint] xAI Responses API failed ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    // A tool-use turn (x_search/web_search) can emit more than one
    // message-type item — an early "I'll search for..." acknowledgment
    // before the tool calls resolve, then the real synthesized answer after.
    // Taking the first one (the old behavior) intermittently grabbed that
    // premature acknowledgment instead of the finished response.
    const messages = (data.output ?? []).filter((o: any) => o.type === 'message');
    const message = messages[messages.length - 1];
    const text = message?.content?.find((c: any) => c.type === 'output_text')?.text ?? '';
    return { content: text };
  },

  // xAI's standalone TTS API — lets the mascot actually speak its lines
  // instead of just displaying them. 'eve' is the default/flagship voice;
  // 'ara' | 'leo' | 'rex' | 'sal' are the other options if a different tone
  // fits better.
  async textToSpeech(step: { text: string; voiceId?: string }): Promise<{ audioDataUrl: string }> {
    const key = xaiKey();
    if (!key) throw new Error('[waypoint] no xAI key found (set XAI_API_KEY or grok in the root .env)');

    const res = await fetch('https://api.x.ai/v1/tts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      // output_format is deliberately omitted — it's a structured object on
      // xAI's side (confirmed via a 422 when a plain string was sent), and
      // the API's own default (24kHz MP3) is exactly what we want anyway.
      body: JSON.stringify({
        text: step.text,
        voice_id: step.voiceId ?? 'eve',
        language: 'en',
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`[waypoint] xAI TTS failed ${res.status}: ${body.slice(0, 300)}`);
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      const b64 = data.audio ?? data.audio_base64 ?? data.data;
      if (!b64) throw new Error('[waypoint] xAI TTS response had no audio field');
      return { audioDataUrl: `data:audio/mpeg;base64,${b64}` };
    }
    // Raw binary audio body.
    const buf = Buffer.from(await res.arrayBuffer());
    return { audioDataUrl: `data:${contentType || 'audio/mpeg'};base64,${buf.toString('base64')}` };
  },
};

// ---------------------------------------------------------------------------
// Auth service — email + password with bearer-token sessions.
// Password hashes live in their own collection ('auth_accounts', keyed by
// email) so user rows returned by app methods can never leak a hash.
// ---------------------------------------------------------------------------

const hashPassword = (password: string): string => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
};

const verifyPassword = (password: string, stored: string): boolean => {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(hash, 'hex'));
};

function validate(email: string, password: string): string {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error('That email address does not look right.');
  if (password.length < 6) throw new Error('Password must be at least 6 characters.');
  return normalized;
}

async function openSession(userId: string): Promise<string> {
  const token = randomUUID() + randomUUID().slice(0, 8);
  await store().put('sessions', { id: token, data: { userId }, created_at: Date.now(), updated_at: Date.now() });
  return token;
}

export async function signup(email: string, password: string): Promise<{ token: string; user: Row }> {
  const normalized = validate(email, password);
  if (await store().one('auth_accounts', normalized)) {
    throw new Error('An account with that email already exists — sign in instead.');
  }
  // An invited collaborator may already have a user row; signing up claims it.
  let user = (await store().all('users')).map(flatten).find((u) => u.email === normalized) ?? null;
  user ??= await insertRow('users', { email: normalized, roles: [] });
  await store().put('auth_accounts', {
    id: normalized,
    data: { userId: user.id, hash: hashPassword(password) },
    created_at: Date.now(),
    updated_at: Date.now(),
  });
  return { token: await openSession(user.id), user };
}

export async function login(email: string, password: string): Promise<{ token: string; user: Row }> {
  const normalized = validate(email, password);
  const account = await store().one('auth_accounts', normalized);
  if (!account || !verifyPassword(password, account.data.hash)) {
    throw new Error('Wrong email or password.');
  }
  const user = await store().one('users', account.data.userId);
  if (!user) throw new Error('That account no longer exists.');
  return { token: await openSession(user.id), user: flatten(user) };
}

export async function sessionUser(token: string | null): Promise<Row | null> {
  if (!token) return null;
  const session = await store().one('sessions', token);
  if (!session) return null;
  const user = await store().one('users', session.data.userId);
  return user ? flatten(user) : null;
}

export async function logout(token: string | null): Promise<void> {
  if (token) await store().del('sessions', token);
}

// ---------------------------------------------------------------------------
// First-run seeding (the plugin loads the scenario module and calls back)
// ---------------------------------------------------------------------------

export async function isFreshDb(): Promise<boolean> {
  if (await store().one('meta', 'seeded')) return false;
  return (await store().all('trips')).length === 0;
}

export async function markSeeded(): Promise<void> {
  await store().put('meta', { id: 'seeded', data: { at: Date.now() }, created_at: Date.now(), updated_at: Date.now() });
}
