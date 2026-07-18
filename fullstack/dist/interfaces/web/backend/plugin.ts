// Waypoint's standalone server, as a Vite plugin. `npm run dev` (or `npm start`)
// serves the React frontend AND the whole backend:
//   • '@mindstudio-ai/agent' is aliased to ./runtime.ts, so the real backend
//     methods in dist/methods/src run in this process (SQLite db, Grok agent,
//     Sabre/Vocal Bridge keys from the root .env)
//   • /_/auth/*      — email-code sign-in with bearer-token sessions
//   • /_/methods/<name>/invoke — executes those methods, JSON or SSE streaming
// On a fresh database it seeds an empty state by default, so every trip you
// see came from a real conversation with the agent — set WAYPOINT_SCENARIO to
// e.g. "weekend-planned" to seed a canned demo trip for a quick screenshot.
import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

function loadRootEnv(repoRoot: string) {
  const file = path.join(repoRoot, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*("([^"]*)"|'([^']*)'|[^#\s]*)/);
    if (!m) continue;
    const value = m[3] ?? m[4] ?? m[2];
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

export function waypointServer(): Plugin {
  let root = '';
  let fullstackRoot = '';
  let manifest: any;
  const fsUrl = (abs: string) => '/@fs' + abs;

  const readBody = (req: IncomingMessage) =>
    new Promise<any>((resolve) => {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); }
      });
    });

  const json = (res: ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  const bearer = (req: IncomingMessage): string | null => {
    const h = req.headers.authorization || '';
    return h.startsWith('Bearer ') ? h.slice(7) : null;
  };

  return {
    name: 'waypoint-server',
    apply: 'serve',

    config(cfg) {
      root = path.resolve(cfg.root || process.cwd());
      fullstackRoot = path.resolve(root, '../../..');
      manifest = JSON.parse(fs.readFileSync(path.join(fullstackRoot, 'mindstudio.json'), 'utf8'));
      loadRootEnv(path.resolve(fullstackRoot, '..'));
      return {
        resolve: {
          alias: { '@mindstudio-ai/agent': path.join(root, 'backend/runtime.ts') },
        },
      };
    },

    configureServer(server: ViteDevServer) {
      const runtime = () => server.ssrLoadModule(fsUrl(path.join(root, 'backend/runtime.ts')));

      // Fresh database → seed one of the app's own demo scenarios. The first
      // traveler to sign in claims it (getBootstrap's demo-claim path).
      let seeded: Promise<void> | null = null;
      const ensureSeeded = () =>
        (seeded ??= (async () => {
          const rt = await runtime();
          if (!(await rt.isFreshDb())) return;
          const wanted = process.env.WAYPOINT_SCENARIO || 'empty-traveler';
          const scenario = manifest.scenarios?.find((sc: any) => sc.id === wanted);
          if (!scenario) return;
          const mod = await server.ssrLoadModule(fsUrl(path.join(fullstackRoot, scenario.path)));
          await mod[scenario.export]();
          await rt.markSeeded();
          console.error(`[waypoint] fresh database — seeded scenario "${scenario.id}"`);
        })());

      server.middlewares.use(async (req, res, next) => {
        const url = (req.url || '').split('?')[0];
        if (!url.startsWith('/_/')) return next();

        if (url.startsWith('/_/telemetry/')) {
          res.writeHead(204);
          res.end();
          return;
        }

        try {
          await ensureSeeded();
          const rt = await runtime();

          if (url.startsWith('/_/auth/')) {
            const body = req.method === 'POST' ? await readBody(req) : {};
            if (url === '/_/auth/signup' || url === '/_/auth/login') {
              try {
                const fn = url.endsWith('signup') ? rt.signup : rt.login;
                json(res, 200, await fn(String(body.email || ''), String(body.password || '')));
              } catch (err: any) {
                json(res, 400, { error: String(err?.message || err) });
              }
            } else if (url === '/_/auth/me') {
              const user = await rt.sessionUser(bearer(req));
              user ? json(res, 200, { user }) : json(res, 401, { error: 'Not signed in' });
            } else if (url === '/_/auth/logout') {
              await rt.logout(bearer(req));
              json(res, 200, {});
            } else {
              json(res, 404, { error: `Unknown auth route ${url}` });
            }
            return;
          }

          const m = url.match(/^\/_\/methods\/([^/]+)\/invoke$/);
          if (!m) return next();
          const entry = manifest.methods.find((e: any) => e.export === m[1]);
          if (!entry) {
            json(res, 404, { error: `Unknown method "${m[1]}"` });
            return;
          }

          const [mod, body] = await Promise.all([
            server.ssrLoadModule(fsUrl(path.join(fullstackRoot, entry.path))),
            readBody(req),
          ]);
          const handler = mod[entry.export];
          if (typeof handler !== 'function') throw new Error(`${entry.path} does not export ${entry.export}()`);
          const userId = (await rt.sessionUser(bearer(req)))?.id ?? null;

          if (body.stream) {
            res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
            const emit = (event: Record<string, unknown>) => res.write(`data: ${JSON.stringify(event)}\n\n`);
            const streamCb = (data: string | Record<string, unknown>) =>
              typeof data === 'string' ? emit({ type: 'token', text: data }) : emit({ type: 'data', data });
            try {
              const output = await rt.runWithContext({ userId, stream: streamCb }, () => handler(body.input ?? {}));
              emit({ type: 'done', output });
            } catch (err: any) {
              console.error(`[waypoint] ${entry.export} failed:`, err);
              emit({ type: 'error', error: String(err?.message || err) });
            }
            res.end();
          } else {
            const output = await rt.runWithContext({ userId }, () => handler(body.input ?? {}));
            json(res, 200, { output });
          }
        } catch (err: any) {
          console.error(`[waypoint] ${url} failed:`, err);
          json(res, 500, { error: String(err?.message || err) });
        }
      });
    },
  };
}
