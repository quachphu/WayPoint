<div align="center">

# 🧭 Waypoint

**A voice-first AI travel companion — plan trips, connect with nearby travelers, and let an agent handle the busywork.**

[![Node](https://img.shields.io/badge/node-24%2B-3C873A?logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/react-19-149ECA?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/vite-8-FF7A2E?logo=vite&logoColor=white)](https://vitejs.dev)
[![Supabase](https://img.shields.io/badge/storage-Supabase%20%7C%20SQLite-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![xAI](https://img.shields.io/badge/agent-Grok%20%28xAI%29-FF7A2E)](https://x.ai)
[![License](https://img.shields.io/badge/license-Hackathon%20project-lightgrey)](#)

</div>

---

Built for the DeepLearning.AI Voice AI Hackathon (Sabre + Vocal Bridge track). Fully self-hosted — no MindStudio account or platform needed. One process serves the React frontend and the entire backend. The full product spec lives in the repo-root `docs/` package.

## ✨ What it does

- **Voice-first trip planning** — talk or type to plan a trip on a live, connected board (flights, hotels, activities); the agent searches, books, and re-plans around disruptions by placing a simulated call to the airline.
- **Onboarding & profiles** — new travelers pick an identity (with a matching default avatar), add hobbies, favorite games/music, languages, and can upload a real profile photo. Gender is locked once set; everything else stays editable.
- **A mascot that actually talks** — onboarding and map-scouting moments are narrated aloud via xAI's TTS API, not just displayed as text.
- **People nearby** — a Facebook-style panel surfacing other signed-up travelers by city/state/country, with a "Recommended" flag for people who share your hobbies/games/music, and 1:1 or group chat.
- **AI-curated local map** — an interactive Leaflet map where Grok (via X/web search) discovers real, well-reviewed local spots near your actual coordinates — a shared, growing dataset that gets richer the more people pass through an area.

## 🚀 Run it

```bash
cd dist/interfaces/web
npm install
npm run dev        # or: npm start (honors $PORT) — open http://localhost:5173
```

Sign in with a normal **email + password** account (no verification step) — you'll land on a short profile setup before reaching the app. A fresh database seeds the "Weekend in San Francisco" demo trip; the first account to sign up claims it.

**Storage:** local SQLite by default (`fullstack/.data/waypoint.db`, gitignored — delete it to reset). For deployed hosting, point it at a free **Supabase** project instead — set `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` in `.env` and run this once in the Supabase SQL editor:

```sql
do $$
declare
  t text;
begin
  foreach t in array array[
    'trips', 'trip_events', 'call_sessions', 'trip_collaborators',
    'users', 'messages', 'pending_actions',
    'sessions', 'auth_accounts', 'meta',
    'conversations', 'conversation_messages', 'city_places', 'friend_requests'
  ]
  loop
    execute format(
      'create table if not exists %I (
         id text primary key, data jsonb not null,
         created_at bigint not null, updated_at bigint not null
       );', t
    );
  end loop;
end $$;
```

Each entity gets its own real table (visible individually in the Table Editor), sharing the same generic `id/data/created_at/updated_at` shape so the app's schemaless method code works unchanged.

With Supabase configured the server is stateless: accounts, trips, and sessions all live in Postgres, so it deploys anywhere with no volumes.

## 🔑 Environment variables

Set in a repo-root `.env`, loaded automatically by the server.

| Variable | Purpose | Without it |
|---|---|---|
| `grok` / `XAI_API_KEY` | The agent's LLM + trending-places search + mascot TTS (xAI) | Agent can't think — required |
| `XAI_MODEL` | Pin a specific Grok model for chat completions | Auto-picks from your key's models |
| `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` | Hosted Postgres storage (accounts, trips, sessions, profiles) | Local SQLite file |
| `VOCAL_BRIDGE_API_KEY` | Mints voice-session tokens (`getVoiceToken`) | Voice falls back to browser Web Speech |
| `VOCAL_BRIDGE_AGENT_ID` | Only for account-scoped VB keys (`X-Agent-Id`) | Not needed for agent-scoped keys |
| `SABRE_TOKEN` + `SABRE_PCC` | Real flight search (Bargain Finder Max, cert env) | Simulated inventory |
| `WAYPOINT_DB` | SQLite file path | `fullstack/.data/waypoint.db` |
| `WAYPOINT_SCENARIO` | Seed scenario for a fresh db | `weekend-planned` |

Every fallback logs its real reason via `console.error`, and the UI completes either way.

## 🗂️ Structure

```
mindstudio.json              ← manifest: method + scenario registry (kept as the server's routing table)
dist/
  methods/src/               ← backend methods (converse, runCall, approveAction, getTrendingPlaces, …)
    common/                  ← agent loop, sabre client, board diffing, trip state, shared profile logic
    tables/                  ← users, trips, trip_events, pending_actions, messages, city_places, …
  interfaces/web/            ← React frontend (Vite): board, chat, voice orb, call layer, social + profile UI
    backend/                 ← the standalone server
      runtime.ts             ←   db (SQLite/Supabase) + auth sessions + Grok (chat/search/TTS) + stream — stands in for '@mindstudio-ai/agent'
      plugin.ts              ←   Vite plugin serving /_/auth/* and /_/methods/*/invoke
    src/lib/msclient.ts      ← our own platform client (replaced '@mindstudio-ai/interface')
```

The backend methods still `import { auth, db, stream, mindstudio } from '@mindstudio-ai/agent'` — a Vite alias resolves that to `backend/runtime.ts`, so the method code stays platform-agnostic.

## 🎙️ Voice architecture

The orb tries Vocal Bridge first: the backend mints a connection token (the browser never sees the API key), the VB agent does STT/TTS and turn-taking, and each spoken query is answered by the same `converse` pipeline chat uses (`voice.onQuery` → `store.send`). The Vocal Bridge agent must be configured in **AI-agent (bring-your-own-agent) mode** in the VB dashboard for the query channel to fire. Board node clicks are forwarded to the agent as `board_node_selected` client actions. If VB is unconfigured or the connection fails, the engine silently falls back to the Web Speech API.

The mascot's onboarding and map-scouting lines are additionally spoken aloud via xAI's standalone TTS API (`mindstudio.textToSpeech`, voice `eve` by default) — a separate, simpler one-shot pipeline from the Vocal Bridge conversation loop above.

## ☁️ Deploying

Any Node 24+ host (Fly.io, Render, Railway, a VPS):

```bash
cd fullstack/dist/interfaces/web && npm install && npm start
```

Set the env vars above on the host. With `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` set there is nothing to persist on the host itself; without them, keep `.data/` on a mounted volume (or point `WAYPOINT_DB` at one).
