---
name: Integrations
description: How Waypoint connects to Sabre, Vocal Bridge, AI, and voice, and how credentials are handled.
---

# Integrations

Waypoint's value is that it *acts* against real systems. Two integrations are load-bearing: **Sabre** (flight and hotel inventory + bookings) and **Vocal Bridge** (voice). Both use credentials the traveler supplied, stored as encrypted platform secrets, never in code or the repo.

~~~
Secrets to set (dev and prod). The traveler pasted values for the first three during intake; wire them via the secrets CLI when building, do not hardcode:
- `SABRE_TOKEN` — the Sabre bearer access token (starts `T1RL...`).
- `SABRE_CLIENT_ID`, `SABRE_CLIENT_SECRET`, `SABRE_PCC` — if/when available, used to refresh the token and to populate the required POS PseudoCityCode. May not all be present initially.
- `SABRE_ENV` — `cert` (certification) by default.
- `VOCAL_BRIDGE_API_KEY` — the Vocal Bridge API key (starts `vb_...`).
- `LANDING_AI_KEY` — document extraction; parked for the roadmap ticket-import feature, not used in the core release.
~~~

## Sabre — real inventory, with a graceful fallback

Waypoint searches and books against Sabre's certification environment. The integration is real; a resilient simulated fallback keeps the experience whole when the sandbox can't answer.

- **Auth.** Sabre uses an OAuth2 bearer token (sessionless tokens last ~7 days). Use the supplied `SABRE_TOKEN` directly. If `SABRE_CLIENT_ID`/`SECRET` are present, refresh proactively on a `401`; if not, surface a clear "couldn't reach Sabre" and fall back to simulated inventory rather than failing the turn.
- **Flight search.** Bargain Finder Max (`POST /v5/offers/shop`, OTA_AirLowFareSearchRQ). Returns up to ~50 itineraries ranked by price, each with an offer id and a TTL. Requires a PCC in the POS block (`SABRE_PCC`).
- **Hotel search.** Content Services for Lodging — Get Hotel Availability (v2): a stay date range, guest counts, and a location or hotel codes; the response normalizes multi-source rates into one structure.
- **Booking retrieval (the disruption flow's first step).** Booking Management — get a booking by confirmation id, to pull the current authoritative state before deciding what to re-shop.
- **Mandatory offer revalidation.** Always revalidate the chosen offer immediately before booking. Offers expire; re-pricing on stale data is the single most common Sabre booking failure. If the fare moved, surface the new price honestly and re-gate ("That fare just expired. I re-priced it at $228. Still want it?"), never book silently at a changed price.

~~~
Build the Sabre client in `common/sabre.ts` as a thin wrapper: `sabreToken()` (cached token + optional refresh), `searchFlights(params)`, `searchHotels(params)`, `getBooking(confirmationId)`, `revalidateOffer(offer)`. Each returns a NORMALIZED shape the rest of the app uses (see `src/planning.md`), so simulated and real results are interchangeable. On any Sabre error (missing PCC, expired token, cert access not enabled, network), log the real error via `console.error` and return `{ source: 'simulated', ... }` realistic inventory generated for the requested route/dates, so the demo always completes. Booking in `cert` is a test-environment action: no real money moves, but treat the confirm-gate exactly as if it did.

Confirm exact endpoints/fields against live Sabre docs at build time (they shift between versions). Sabre also publishes an MCP server and agentic REST APIs; check whether the supplied credentials have access before hand-rolling every REST client, as wiring the tool layer to the MCP server may be less code. Verify with `askMindStudioSdk` / a quick docs check during the build.
~~~

## Vocal Bridge — voice, attempted real first

Voice is the front door. The first build task is a **Vocal Bridge feasibility check** from this platform, because the graded submission wants the real integration and the traveler supplied a key.

- **The real path.** A backend method mints a short-lived Vocal Bridge connection token from `VOCAL_BRIDGE_API_KEY` (the key never reaches the client). The web client connects with that token via Vocal Bridge's browser SDK, streams the transcript, and registers a query handler that calls Waypoint's `converse` orchestrator, so voice and chat share one brain. If this connects cleanly from the platform, it becomes the primary voice channel.
- **The guaranteed fallback.** If Vocal Bridge can't be reached from here, voice uses the browser's built-in speech recognition and synthesis (Web Speech API): capture speech to text, send to `converse`, speak the streamed reply back. Voice-first ships either way; the fallback is transparent to the traveler.

~~~
Do the feasibility spike before committing UI to either path. Abstract voice behind a small client interface (`startListening`, `stopListening`, `speak(text)`, presence-state events) so the board/conversation UI is identical regardless of which engine backs it. Whichever engine is active, the board's live updates come from Waypoint's own `stream()` from the `converse`/`runCall` methods, NOT from a voice-provider channel, so the "board builds live while the agent talks" behavior does not depend on Vocal Bridge being reachable.
~~~

## AI models

The orchestrator and the simulated call both run on the platform AI SDK (no separate keys). Model choice, prompt structure, and tool wiring are specified in `src/orchestrator.md` and `src/disruption.md`; confirm current model IDs with `askMindStudioSdk` at build time rather than guessing.

## Activities and places

Activity suggestions (things to do, restaurants) come from the AI orchestrator's own web-search capability rather than a Google Maps key (none was supplied). This is enough to propose real, plausible, located activities for the MVP. A real Places/Directions integration and true route-ordering are a roadmap item.

## Landing AI

The supplied Landing AI key is for document extraction and maps to the roadmap **ticket import** feature (upload a confirmation email or PDF and Waypoint parses it into a trip). It is not part of the core release; the key is noted here so it isn't lost.
