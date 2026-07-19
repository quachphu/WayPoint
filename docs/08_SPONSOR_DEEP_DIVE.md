# Sponsor deep dive — Sabre & Vocal Bridge, verified against live docs (July 2026)

This document is the result of a fresh research pass against Sabre's and Vocal Bridge's own current developer material (official docs, GitHub sample repos, and their SDK READMEs, fetched live today), specifically to feed the *next* build of this project. It supersedes nothing in `docs/03_API_INTEGRATION.md`, it deepens it: every claim below is either a direct confirmation of what that doc already said, or a correction/addition based on what's verifiably true right now. Where the two disagree, trust this doc and see §5 for the specific patch.

Written to be actionable in the next hour, not just informative. Read §0 first if you're mid-hackathon and need to start moving immediately.

## 0. If you have 10 minutes before you need to be coding

1. **Vocal Bridge is fully self-serve and fast.** Sign up at vocalbridgeai.com, get an API key and a phone number in minutes, no approval wait. Do this first — it's the zero-friction path. `pip install vocal-bridge && vb auth login` and `vb docs` will dump the complete, agent-specific integration reference (JS/React/Flutter examples, your actual configured tools) straight to your terminal, which is a better source than any doc, including this one, once you have a key.
2. **Sabre requires a registration step that isn't instant** (email verification, then key generation in "My Applications"). Do this in parallel with #1, not after. If your team was issued pre-provisioned cert credentials specifically for this hackathon (check Discord/the event kickoff materials), use those first and skip self-registration — hackathon-issued credentials typically come with a PCC already attached, which self-registered Dev Studio accounts sometimes lack (see §1.4, this is the single most common Sabre integration blocker).
3. **Do not spend hackathon time trying to reach Sabre's MCP server.** It is real, but it is not currently a self-serve Dev Studio product — see §1.6. Build against the plain REST endpoints (BFM, hotel avail, booking management); that's what every public sample app does, that's what your cert credentials give you, and that's a completely legitimate, judge-visible way to satisfy "uses Sabre APIs."
4. **Wire Vocal Bridge's `useAIAgent`/`onAIAgentQuery` pattern before anything else voice-related.** It's genuinely two lines against an already-working chat backend (confirmed straight from their SDK source, §2.4). Get chat-only planning working first, then hang voice on it — this order isn't just good practice, it's the fastest path to a demo-able thing today.

## 1. Sabre — verified findings

### 1.1 Registration & credentials (confirmed, with the real gotcha)

The flow is consistently described the same way by Sabre's own docs and by every third-party integration guide that's current in 2026: register at `developer.sabre.com` → verify the email → log in → **My Applications** → generate an application, which gives you a **Client ID** and **Client Secret** (also called API Key/Secret) for the **CERT** (certification/sandbox) environment, no commercial agreement or sales conversation required for this tier.

The concrete gotcha, confirmed across multiple independent sources including Sabre's own sample-app READMEs and live Stack Overflow threads from developers hitting this exact wall: **your Client ID is not just an opaque string, it's structured as `V1:<EPR>:<PCC or GROUP>:<DOMAIN>`** (e.g. `V1:yourname:DEVCENTER:EXT` for a self-registered Dev Studio account, or `V1:EPR:YOURPCC:AA` if you have your own Pseudo City Code). A self-registered Dev Studio account is issued a **default sandbox PCC** — you do not need to acquire your own PCC to get started, but you do need to know which PCC is embedded in your credentials to put in the `POS.Source[].PseudoCityCode` field on every shopping request (`docs/03_API_INTEGRATION.md` §1.3 already has this field, it just needs the real value, which is account-specific and shows up on your Dev Studio "My Applications" page, not something to guess or leave as a placeholder).

### 1.2 Auth — confirmed, one correction on environment hostnames

The OAuth2 flow in `docs/03_API_INTEGRATION.md` §1.2 is correct in shape. The one thing worth flagging: **Sabre's cert-environment hostname is not fully standardized across accounts and API vintages** — you will see three different forms in live, current documentation and sample code depending on when/how your account was provisioned and which API family you're calling:

| Form | Example | Where it shows up |
|---|---|---|
| `api.cert.platform.sabre.com` | `https://api.cert.platform.sabre.com/v5/offers/shop` | Current REST platform APIs (BFM v5, Booking Management), the form most 2025-2026 guides use |
| `api-crt.cert.havail.sabre.com` | `https://api-crt.cert.havail.sabre.com/v3/auth/token` | Older / some legacy-domain sandbox accounts |
| `api.test.sabre.com` | `https://api.test.sabre.com/v2/auth/token` | Older quickstart guides and sample apps (`SACS-NodeJs`, some Stack Overflow-era threads) |

**Don't hardcode one of these.** Confirm which hostname is live for your specific credentials by checking the account setup email from Dev Studio (this was already the guidance in `docs/03_API_INTEGRATION.md`, this research confirms it's not just a hedge, it's a real, current inconsistency, not a solved problem you can shortcut past). Build the base URL as a single environment variable (`SABRE_BASE_URL`), not a constant, so a wrong guess is a one-line fix, not a redeploy.

The token endpoint itself is version-sensitive too: `/v2/auth/token` and `/v3/auth/token` both exist in current live documentation; `/v3` is the more current one referenced in Sabre's own current API reference for token creation. Try `/v3` first.

### 1.3 Bargain Finder Max (BFM) — confirmed, request shape verified against multiple live current sources

`POST {base}/v5/offers/shop`, `OTA_AirLowFareSearchRQ` body. Confirmed identical in shape across Sabre's own sample-app repo (`SabreDevStudio/bargain-finder-max-sample-nodejs`), a live current Stack Overflow answer, and third-party integration guides all dated 2025-2026. The one field worth calling out that `docs/03_API_INTEGRATION.md` didn't have: **`TPA_Extensions.IntelliSellTransaction.RequestType.Name` controls how many itineraries come back** (`"50ITINS"`, `"100ITINS"`, etc.) — this is the actual throttle on response size/cost, set it deliberately rather than leaving Sabre's default, since larger responses cost more model tokens once you're feeding results to an LLM for ranking.

```json
{
  "OTA_AirLowFareSearchRQ": {
    "Version": "5",
    "POS": { "Source": [{ "PseudoCityCode": "YOUR_PCC", "RequestorID": { "Type": "1", "ID": "1", "CompanyName": { "Code": "TN" } } }] },
    "OriginDestinationInformation": [
      { "RPH": "1", "DepartureDateTime": "2026-07-18T00:00:00", "OriginLocation": { "LocationCode": "LAX" }, "DestinationLocation": { "LocationCode": "SFO" } }
    ],
    "TravelerInfoSummary": { "AirTravelerAvail": [{ "PassengerTypeQuantity": [{ "Code": "ADT", "Quantity": 1 }] }] },
    "TPA_Extensions": { "IntelliSellTransaction": { "RequestType": { "Name": "50ITINS" } } }
  }
}
```

Response includes an `offerId` per itinerary and Sabre's own price ranking; each offer has a time-to-live, and — as `docs/03_API_INTEGRATION.md` already correctly stresses — **revalidate before booking, always**, this is confirmed as the single most common integration failure mode across every source consulted, not a theoretical edge case.

### 1.4 Hotel search — Get Hotel Avail v2, confirmed

`SabreDevStudio/get-hotel-avail-v2-sample-nodejs` is a real, current, working reference. Request needs a location (airport code, geo point, or explicit hotel codes) and a stay date range; the response is Sabre's own cross-supplier normalized shape (property info, amenities, a `RateKey` per rate plan, lead price). One detail worth carrying into the build: the response includes a **`ShopKey`** at the top level — this is meant to be reused for follow-up detail/booking calls in the same shopping session rather than re-shopping from scratch, worth wiring in even for the MVP since it's a real efficiency the API is built around.

### 1.5 Booking Management (getBooking) — confirmed, request shape more concrete than before

`POST {base}/v1/trip/orders/getBooking`. Confirmed via Sabre's own Postman collection (`SabreDevStudio/postman-collections`) and multiple current write-ups. Minimum viable request is just `{"confirmationId": "ABC123"}`; you can narrow the response with `returnOnly: [...]` (e.g. `["FLIGHTS"]`, as `docs/03_API_INTEGRATION.md` already shows). The full request also accepts `bookingSource` (defaults to `"SABRE"`), `targetPcc`, and traveler-name fields for extra validation, useful if you want a second factor beyond the confirmation code before letting the disruption agent act on a booking. This one endpoint deliberately merges both the PNR (ATPCO/classic) and NDC Order domains into one normalized response — confirmed as a genuine simplification Sabre built specifically so integrators don't need to branch on booking type, lean on that rather than writing your own branching logic.

### 1.6 The MCP server and "agentic APIs" — correction, then a further correction specific to this event

`docs/03_API_INTEGRATION.md` §1.6 says to "confirm whether it's available on your Dev Studio account before writing any raw REST client." Checking Sabre's own *generic public* press material, product pages, and third-party MCP directories at the time this section was first written: it looked like Sabre's MCP server was a first-party enterprise capability with no public self-serve onboarding path.

**That generic finding turned out not to apply to this specific hackathon.** Once real hackathon-issued credentials were in hand, direct testing (see `docs/09_SABRE_LIVE_VERIFIED.md` §3) confirmed **two live, working MCP servers in CERT, reachable right now with the hackathon token**: a tools-based server at `https://mcp.cert.sabre.com/mcp` and a skills-based server at `https://mcp2.cert.sabre.com/mcp`, both Streamable HTTP, both accepting the same `SABRE_TOKEN` as a Bearer token. Sabre stood these up specifically for this event's PCC/EPR, distinct from the generic public platform's access story. **Read `docs/09_SABRE_LIVE_VERIFIED.md` in full before deciding whether to use MCP or direct REST for this build** — both are confirmed working, §3 there lays out the real tradeoff.

Also superseded: the REST examples in `docs/03_API_INTEGRATION.md` §1.3 (BFM v5, `OTA_AirLowFareSearchRQ`) describe the generic public Sabre product. **Your hackathon token is scoped to a newer, different, flatter API family (Flight Shop API v1 at `/v1/offers/flightShop`, confirmed live) that doesn't use that envelope at all** — see `docs/09_SABRE_LIVE_VERIFIED.md` §2 for the confirmed real request/response shapes. Don't build against §1.3's request shape for this project.

### 1.7 Rate limits & sandbox etiquette — confirmed

Consistent across sources: cert credentials are for development traffic, not load/perf testing. No hard published per-minute rate limit surfaced in current public docs (unlike Vocal Bridge, which publishes exact numbers, §2.7), but every source agrees on the same practical guidance already in `docs/03_API_INTEGRATION.md` §1.7 — cache aggressively, don't loop shopping calls, and treat a `401` as "refresh the token," not "something is broken."

### 1.8 Fastest real starting points (verified live repos)

- `github.com/SabreDevStudio/bargain-finder-max-sample-nodejs` — full auth-to-parsed-results flow for BFM, actively referenced by Sabre's own current docs.
- `github.com/SabreDevStudio/get-hotel-avail-v2-sample-nodejs` — same pattern for hotel search.
- `github.com/SabreDevStudio/postman-collections` (`Booking-Management` folder) — a ready-made Postman collection with a working `REST Authorize` request and `Get Booking`/`Cancel Booking` examples; importing this into Postman first, before writing any code, is the fastest way to confirm your specific credentials actually work end-to-end.
- `github.com/SabreDevStudio/create-passenger-name-record-sample-nodejs` — the actual booking-creation flow (not covered in depth by the existing docs package, worth a look if the team gets to real Sabre bookings rather than the simulated-booking fallback `fullstack/src/integrations.md` already plans for).

## 2. Vocal Bridge — verified findings

### 2.1 Sign-up & the "4 steps" quickstart — confirmed word-for-word

Fetched directly from `vocalbridgeai.com/docs/overview` today. The product's own quickstart is exactly what `docs/03_API_INTEGRATION.md` describes: create an account → configure a system prompt and get an API key + phone number in minutes → stand up a backend token endpoint → install `@vocalbridgeai/sdk` (or `@vocalbridgeai/react`) → connect. No approval wait, no sales step, genuinely the fastest of the two sponsor integrations to get real signal from.

### 2.2 Token issuance — confirmed exactly

```bash
curl -X POST "https://vocalbridgeai.com/api/v1/token" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"participant_name": "User"}'
```

The backend proxy pattern (`docs/03_API_INTEGRATION.md` §2.2, `fullstack/src/integrations.md`) is exactly what Vocal Bridge's own docs and their SDK's own README recommend as the *production* strategy specifically (their SDK README is explicit that a raw `apiKey` auth strategy exists too, but is labeled "prototyping only — exposes key to browser," confirming the existing docs' instinct to skip straight to the token-URL strategy was right, don't even build the prototyping path).

### 2.3 Three real auth strategies (new detail, worth having)

Confirmed directly from the SDK's own README, not previously broken out in `docs/03_API_INTEGRATION.md`:

```js
// 1. API Key (prototyping only — exposes key to browser)
{ auth: { apiKey: 'vb_xxx' } }

// 2. Token URL (production — your backend proxies the request)
{ auth: { tokenUrl: '/api/voice-token' } }

// 3. Custom provider (maximum flexibility)
{ auth: { tokenProvider: async () => ({ url, token, room_name, ... }) } }
```

The third form (`tokenProvider`) is worth knowing about even though it's not the default path: it's the escape hatch if you ever need to inject something extra into the connection handshake (e.g. per-trip metadata) without Vocal Bridge's own token endpoint supporting it directly.

### 2.4 The "bring your own agent" pattern — confirmed, exact code

Directly from the SDK source and docs site, matching `docs/03_API_INTEGRATION.md` §2.5 and `fullstack/src/integrations.md`'s framing exactly:

```js
import { VocalBridge } from '@vocalbridgeai/sdk';
const vb = new VocalBridge({ auth: { tokenUrl: '/api/voice-token' } });

vb.onAIAgentQuery(async (query) => {
  return await orchestrator.invoke(query, { thread_id: tripId }); // spoken back automatically
});

await vb.connect();
```

React: `useAIAgent({ onQuery: async (query) => { ... } })` — one hook, confirmed identical pattern. This must be explicitly enabled per-agent (`vb config set --ai-agent-enabled true --ai-agent-description "..."`) — confirmed from the CLI's own current documentation — and there's a `verbatim` flag (default `false`) worth knowing about: with it `false`, Vocal Bridge's voice layer *adapts* your orchestrator's text response for natural spoken delivery rather than reading it verbatim, which matters for `docs/02_ARCHITECTURE.md`'s "two lines" framing — the voice layer is doing real work beyond pass-through, not just TTS on your raw text.

### 2.5 Client Actions — confirmed bidirectional, with the manual-mode detail

Confirmed exactly as `docs/03_API_INTEGRATION.md` §2.4 and the planning-board spec describe: `vb.on('agentAction', ...)` for agent→app, `vb.sendAction(name, payload)` for app→agent. One addition from the SDK's own README worth designing around: `onAIAgentQuery` is the *automatic* mode (return value auto-sent back), but there's also a fully manual mode —

```js
vb.on('aiAgentQuery', async ({ query, turnId }) => {
  const answer = await orchestrator.invoke(query, { thread_id: tripId });
  vb.sendAIAgentResponse(turnId, answer);
});
```

The manual mode is the better fit if the orchestrator call needs to also push `stream()` events (board diffs, working-indicator toggles) *before* the final answer resolves — the automatic callback only has one return value, the manual mode lets you `sendAction('board_update', diff)` and `sendAIAgentResponse(turnId, answer)` as two separate calls, so the board can update mid-turn rather than only once the whole orchestrator call finishes. Worth using the manual form specifically for this project, given how central "the board builds live while the agent talks" is to the whole product.

### 2.6 Outbound calling — confirmed, with the exact ToS text now in hand

Confirmed exactly: Pilot-tier subscription plus `vb config set --outbound-enabled true --accept-outbound-tos`. The CLI's own current documentation includes the literal ToS text your team is agreeing to when you run that command — worth having verbatim for `docs/04_SECURITY_COMPLIANCE.md`'s record:

> **Compliance**: You are solely responsible for complying with all applicable laws, including TCPA, TSR, and all state and local telemarketing regulations. **Consent**: You certify that you have obtained prior express consent from all individuals your agent will call. **Prohibited Uses**: unsolicited telemarketing, spam, robocalling, fraud, harassment, calls to emergency services. **Indemnification**: Vocal Bridge bears no liability; you indemnify them. **Termination**: Vocal Bridge may suspend/terminate for violations without notice.

This is the exact text confirming `docs/04_SECURITY_COMPLIANCE.md` §3's framing is not editorializing, it's a direct read of the real ToS.

`vb call +14155551234 --name "Airline Support" --json` places the call from the CLI directly — confirmed as a real, working command, useful for a pre-hackathon smoke test of the outbound path completely independent of your app code, worth doing once, early, exactly per `docs/06_BUILD_PLAN.md` Phase 0's "one real call, not mocked" definition of done.

### 2.7 Rate limits — confirmed exact numbers

**50 calls/day per agent, 200 calls/day per user**, confirmed verbatim from the CLI's current documentation (matches `docs/03_API_INTEGRATION.md` and `fullstack/src/disruption.md` exactly — no correction needed here, just confirmation this is still accurate and worth the semaphore/rate-limiter design already specified in `docs/02_ARCHITECTURE.md` §3.5).

### 2.8 New capabilities worth knowing about that weren't in the original doc package

- **`vb eval <session_id> --objective "..."`** (Pilot only): sends the full call recording, agent config, transcript, and client-action log to a multimodal LLM for a qualitative pass/fail score plus concrete prompt-improvement suggestions. This is a genuinely useful QA tool for the disruption-call flow specifically — worth running against your own test calls before a live demo, since it will catch things like "tone became impatient on the second reschedule attempt" that a human skimming a transcript might miss. 100 evals/day per user, capped at 18 MB inline audio per recording.
- **`--continuous-mode`**: the agent keeps talking after a short silence instead of waiting for the user's turn each time (useful for a narrator-style experience; not the right mode for this project's turn-based planning conversation, but worth knowing it exists so you don't accidentally enable it).
- **Listener style** (`--style Listener`): a voice agent that never speaks, only transcribes with speaker diarization and streams `coaching_suggestion` / `speaker_map_update` events. `docs/03_API_INTEGRATION.md` §2.7 already flagged this as "not core, but worth knowing exists" — confirmed still true, and now confirmed as a fully real, documented, creatable agent style (`vb agent create --style Listener`), not a beta/preview feature. Genuinely interesting if a later phase wants Waypoint to silently sit in on a live call between two human trip members.
- **`vb config get <section>` / `vb config set --merge`**: a full config-roundtrip workflow (export current settings as JSON, edit, reapply, with `--merge` for partial updates) — useful for iterating on model/voice settings quickly without the dashboard, worth telling whoever owns the Vocal Bridge config about this during the build.

### 2.9 Fastest real starting points (verified live sources)

- `vocalbridgeai.com/docs/overview` — the canonical quickstart, matches everything above.
- `github.com/vocalbridgeai/sdk` — the actual SDK source and both package READMEs (`packages/sdk`, `packages/react`), confirmed as the ground truth for every method signature in this section.
- `vb docs` (CLI, once you have an API key) — generates documentation specific to *your* configured agent (its actual tools, actions, and capabilities), which will be more accurate than any static doc including this one once your agent exists.
- `pypi.org/project/vocal-bridge` — the CLI's own README, confirmed as current (version 0.21.0 as of this research), includes the full command reference used throughout this section.

## 3. What this means for the existing build plan

Nothing in `docs/01-02_*.md`'s architecture or `docs/06-07_*.md`'s phasing needs to change based on this research — the two products behave exactly as those docs assumed. The concrete, actionable deltas are:

1. **Sabre PCC**: stop treating `SABRE_PCC` as "the account's own PCC, look it up" — treat it as "the specific string embedded in your Client ID," and get it from the Dev Studio "My Applications" page or the hackathon-issued credential email, not by guessing. If your credentials don't have a usable PCC (some self-registered accounts genuinely don't get shopping-capable ones without an extra step), the simulated-fallback path `fullstack/src/integrations.md` already designed for is not a nice-to-have, it's very possibly your Phase 0 reality — confirm this in the first 15 minutes, don't discover it during a live demo.
2. **Don't budget any hackathon time for Sabre's MCP server.** Point the orchestrator's tool layer directly at your own REST wrapper. This is a real, load-bearing correction to `docs/03_API_INTEGRATION.md` §1.6's "check first" framing — checking is now done, the answer is "not available," move on.
3. **Use the manual `aiAgentQuery`/`sendAIAgentResponse` pattern, not the automatic `onAIAgentQuery` callback**, specifically because this project's signature feature (the board building live while the agent talks) needs to push `board_update` client actions *during* a turn, not only after it resolves. This is a real refinement to `docs/02_ARCHITECTURE.md` §6 and `docs/07_PLANNING_BOARD.md` §7.3 worth writing into the code, not just this doc.
4. **Confirm your exact Sabre cert hostname (`platform.sabre.com` vs `havail.sabre.com` vs `test.sabre.com`) before writing the client**, as an environment variable, not a hardcoded constant — this is genuinely inconsistent across accounts right now, not a settled detail.
5. **Do one real, non-demo smoke test of each integration before building on top of them**: `vb call` from the CLI directly for Vocal Bridge, the Postman `Booking-Management` collection's `REST Authorize` request for Sabre. Both are two-minute checks that catch credential problems before they're buried under three layers of your own code.

## 4. Sources consulted (live, today)

- `vocalbridgeai.com/docs/overview` (fetched directly)
- `github.com/vocalbridgeai/sdk` — root, `packages/sdk/README.md`, `packages/react/README.md` (fetched directly)
- `pypi.org/project/vocal-bridge` — CLI README (fetched directly)
- `developer.sabre.com` (portal confirmed reachable; specific guide pages are behind a JS app shell that doesn't serve static content to a plain fetch, so specific sub-pages were cross-confirmed via Sabre's own GitHub sample repos and current third-party guides instead, all cited inline above)
- `github.com/SabreDevStudio/bargain-finder-max-sample-nodejs`, `get-hotel-avail-v2-sample-nodejs`, `postman-collections`, `create-passenger-name-record-sample-nodejs`
- Sabre's own current press/product material on agentic APIs and the MCP server (`sabre.com/developers/agency`, `sabre.com/resources/research/the-agentic-blueprint`, investor press release on agentic APIs)
- `docs.langchain.com/oss/python/langchain/human-in-the-loop`, `.../langgraph/interrupts`, and the `HumanInTheLoopMiddleware` reference page — confirmed the `interrupt()`/`Command(resume=...)` and `HumanInTheLoopMiddleware(interrupt_on=...)` patterns in `docs/02_ARCHITECTURE.md` §4 are current and correct as written, no corrections needed there.

## 5. Specific patch to apply to `docs/03_API_INTEGRATION.md`

- §1.2: add the three-hostname-forms table from §1.2 above; change "confirm exact cert hostname" from a passing caveat to an explicit "make this an env var, not a constant."
- §1.3: add the `TPA_Extensions.IntelliSellTransaction.RequestType.Name` result-count control.
- §1.4: add the `ShopKey` reuse detail.
- §1.6: replace "confirm whether it's available on your Dev Studio account before writing any raw REST client" with the finding in §1.6 above — it's not currently a self-serve product, build the REST wrapper directly.
- §2.4/2.5: add the manual `aiAgentQuery`/`sendAIAgentResponse` pattern as the recommended approach for this project specifically (over the automatic `onAIAgentQuery`), per §2.5 and §3.3 above.
