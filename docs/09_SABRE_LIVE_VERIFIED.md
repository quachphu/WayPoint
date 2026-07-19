# Sabre — live-verified against YOUR actual hackathon credentials (July 18, 2026)

Everything in this document was confirmed by making real, authenticated calls against Sabre's certification environment using the credentials in the repo-root `.env`, right now, not by reading generic documentation. This supersedes the generic-research parts of `docs/08_SPONSOR_DEEP_DIVE.md` §1 wherever the two disagree — the hackathon issued you access to a newer, cleaner API surface than the classic BFM v5 flow that doc (correctly) describes as the generic public path. Both are real Sabre products; you specifically have working, tested access to the one described here.

## 0. The single most important finding

**`fullstack/dist/methods/src/common/sabre.ts` currently calls the wrong API for your credentials.** It POSTs `OTA_AirLowFareSearchRQ` to `/v5/offers/shop` (classic Bargain Finder Max) and requires `SABRE_PCC` to be set before it even tries a real call. Your actual hackathon token is scoped to a different, newer product family — **Flight Shop API v1 / Hotels Search API v1 / Booking Management API v1** — confirmed live, working, right now, with no PCC needed in the request body at all. Live-search results were flowing back with `sabreConfigured()` (which gates on `SABRE_PCC`) as the only thing standing between the current code and simulated-fallback — and even once that gate is satisfied, `/v5/offers/shop` may well 404/403 on this account since it's not the product your credentials were provisioned for. **This is the first thing to fix before writing any new feature code** — see §4 for the exact rewrite needed.

## 1. Your credentials, confirmed working, right now

- `SABRE_TOKEN` in `.env` is a **live, valid, working bearer token** — confirmed with a real `200 OK` flight search (see §2) and a real MCP server handshake (see §3). No auth/token-exchange step is needed during the hackathon; use it directly as `Authorization: Bearer <SABRE_TOKEN>`.
- **It expires 7 days from July 13, 2026 — i.e. around July 20, 2026.** That's after the hackathon ends today, so no refresh is needed for the event itself, but don't let it linger in a `.env` you reuse past that date without checking.
- **PCC discrepancy to resolve before you rely on it**: `.env` currently has `SABRE_PCC=7TZA`, but the Sabre hackathon developer hub you were just looking at (the Postman-hosted docs page) displays **`S5OM`** (uppercase letter O, not zero) as *the* PCC for hackathon development, explicitly callable across all Sabre APIs used in your solution. These are two different values. The v1 Flight Shop / Hotel Search calls confirmed below didn't need a PCC in the payload at all (it's tied to the token/account server-side), so this mostly matters if any code path or MCP security check reads `SABRE_PCC` explicitly — worth updating `.env` to `S5OM` to match the source you just confirmed directly on the hackathon page, since that's more authoritative than whatever `7TZA` was copied from.

## 2. Confirmed live: direct REST calls, no PCC required

Verified with a real request during this research session (values redacted, but this is a real `200` with real inventory, not a mock):

```bash
curl -X POST "https://api.cert.platform.sabre.com/v1/offers/flightShop" \
  -H "Authorization: Bearer $SABRE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "journeys": [ { "departureLocation": {"airportCode":"LAX"}, "arrivalLocation": {"airportCode":"SFO"}, "departureDate": "2026-07-25" } ],
    "travelers": [ { "passengerTypeCode": "ADT" } ]
  }'
```

Returned a real `200` with actual UA/AA flight options (PHX→SFO, LAS→SFO, LAX→TUS connections, etc.), each with `id`, `departureAirportCode`/`arrivalAirportCode`, times, `operatingAirlineCode`/`operatingFlightNumber`, and an `offers[]` array with `totalPrice: { amount, currencyCode }` and a `validUntil` TTL. **No `PseudoCityCode`, no `POS` block, no OTA envelope** — this is a flat, modern JSON API, a generation newer than classic BFM.

### Confirmed base URL and paths (from the live OpenAPI specs, fetched via the MCP server's spec tools, §3)

All three follow the same server template: `https://{environment}.sabre.com{basePath}`, environment defaults to `api.cert.platform` for CERT.

| API | Base path | Full endpoint |
|---|---|---|
| Flight Shop | `/v1/offers` | `POST https://api.cert.platform.sabre.com/v1/offers/flightShop` |
| Flight Reshop | `/v1/offers` | `POST https://api.cert.platform.sabre.com/v1/offers/flightReshop` |
| Hotels Search | `/v1/hotels` | `POST https://api.cert.platform.sabre.com/v1/hotels/hotelSearch` |
| Hotel Rates | `/v1/hotels` | `GET/POST https://api.cert.platform.sabre.com/v1/hotels/getHotelRates` |
| Hotel Price Check | `/v1/hotels` | `POST https://api.cert.platform.sabre.com/v1/hotels/checkHotelRate` |
| Booking Management | `/v1/trip/orders` | `POST https://api.cert.platform.sabre.com/v1/trip/orders/{getBooking\|createBooking\|modifyBooking\|cancelBooking\|checkFlightTickets\|voidFlightTickets\|refundFlightTickets\|fulfillFlightTickets}` |

This exactly matches the `fullPath` enum on the MCP server's own `callSabreAPI` tool (§3) — the same thirteen paths, confirmed twice over.

### Minimal request/response shapes (from the live spec)

**Flight Shop request** (one-way, minimal):
```json
{
  "journeys": [{ "departureLocation": {"airportCode": "CDG"}, "arrivalLocation": {"airportCode": "BER"}, "departureDate": "2025-07-09" }],
  "travelers": [{ "passengerTypeCode": "ADT" }]
}
```

**Flight Shop response** (shape, trimmed):
```json
{
  "timestamp": "...",
  "flights": [{ "id": "...", "departureAirportCode": "JFK", "departureTime": "20:25", "operatingAirlineCode": "FI", "operatingFlightNumber": 614, "durationInMinutes": 350, "...": "..." }],
  "journeys": [ /* references flights[] by id, in order */ ],
  "offers": [{
    "type": "FlightOffer", "id": "...", "createdAt": "...", "validUntil": "...",
    "source": { "provider": "Sabre", "distributionModel": "ATPCO" },
    "totalPrice": { "amount": "833.19", "currencyCode": "USD" },
    "items": [{ "type": "FlightOfferItem", "fares": [{ "travelers": [...], "fareTotal": {...} }] }]
  }]
}
```

`validUntil` on each offer is the real revalidate-before-booking deadline — same requirement as always, now on a field with a clean, obvious name instead of an implicit TTL.

**Hotel Search** takes a `numberOfAdults`/`numberOfChildren`, a geo reference point or property list, stay dates, `radiusInMiles` (default 10), a `sort` (`AverageNightlyRate` default) and a `source` filter (`ALL`, `GDS`, `EXPEDIA`, `BOOKING`, etc. — confirmed this cert account can reach non-GDS aggregated content too, not just classic GDS inventory).

**Booking Management `getBooking`** confirmed at `/v1/trip/orders/getBooking` — same operation as `docs/03_API_INTEGRATION.md` describes, now confirmed at the `v1/trip/orders` base path rather than needing to guess between `v1` variants.

## 3. Confirmed live: both Sabre MCP servers work with your token

This is a direct, load-bearing correction to `docs/08_SPONSOR_DEEP_DIVE.md` §1.6, which (correctly, for the *generic public* Sabre platform) said MCP wasn't self-serve. **For this specific hackathon, Sabre stood up two dedicated MCP servers in CERT, and your token has the required PCC/EPR security attribute already enabled** — confirmed by a real, successful `initialize` handshake and `tools/list` call against both.

| Server | Endpoint | Style |
|---|---|---|
| Tools-based | `https://mcp.cert.sabre.com/mcp` | Predefined multi-step workflow tools + generic `callSabreAPI` + on-demand OpenAPI spec tools |
| Skills-based | `https://mcp2.cert.sabre.com/mcp` | Business tools (`search-hotels`, etc.) guided by MCP-resource "skills" you load before each call |

Both: Streamable HTTP transport, `Authorization: Bearer <SABRE_TOKEN>` on every request, no separate MCP-specific auth step.

**Confirmed tool list on the tools-based server** (`https://mcp.cert.sabre.com/mcp`, real `tools/list` response):

- `SearchAndBookFlightWorkflow` — "the one and only valid entry point" for flight search/booking/ticketing, per its own description. Retrieves a strict step sequence the calling agent must execute as given.
- `SearchAndBookHotelWorkflow` — same pattern for hotels.
- `FlightIssuedTicketManagementWorkflow` — void/refund/exchange-eligibility checks and execution for already-issued tickets.
- `callSabreAPI` — generic executor; takes `fullPath` (one of the 13 paths in §2's table) plus `requestPayload`, and a `conversationId` to keep a multi-call session correlated.
- Six `*_OpenAPISpec` tools (`FlightShopAPI`, `FlightReshopAPI`, `HotelsSearchAPI`, `HotelPriceCheckAPI`, `HotelRatesAPI`, `BookingManagement_OpenAPISpec`) — each returns the full spec for that domain so an LLM (or you, right now) can learn the exact schema before calling `callSabreAPI`.

Every workflow/spec call returns a `conversationId` (e.g. `wf_c078fa37-...`) — **pass this to every subsequent `callSabreAPI` call and to any other workflow tool in the same conversation** (explicitly stated in the tool's own response), this is what keeps a multi-step flight-then-hotel-then-book session correlated server-side, don't generate your own.

### Which path should Waypoint actually use: direct REST, or the MCP server?

Both are confirmed working with the same token. The honest tradeoff for the remaining hackathon time:

- **Direct REST (§2)** is what `fullstack`'s existing architecture already expects (a `sabre.ts` module with `searchFlights`/`searchHotels`/`getBooking` functions called from your own orchestrator's tools) — it's a smaller diff from the current code, and you stay in full control of request/response shape and error handling. **Recommended for the rest of this hackathon** given the existing `fullstack/src/orchestrator.md` design already assumes this exact shape (`searchFlights`, `searchHotels` as your own tool functions wrapping a REST client).
- **The MCP server** is the more "agentic-ready" path and genuinely less code if your orchestrator or agent framework has native MCP client support (e.g. wiring it as an MCP tool source for a LangGraph/`create_agent` agent, or for Claude directly) — but it means handing the *workflow* tools (`SearchAndBookFlightWorkflow`) the decision of what sequence of calls to make, which sits awkwardly next to this project's confirm-gate requirement (§`docs/02_ARCHITECTURE.md` §4): the workflow tool's own description says the agent "is required to execute [the steps] exactly as specified, without deviation," which is a different shape than "propose, then gate, then execute on approval." If you do use it, keep the gate around whichever step actually books/cancels/tickets, don't let the workflow tool's own booking step run before your `interrupt()`/pending-action check.

## 4. The concrete fix needed in `fullstack/dist/methods/src/common/sabre.ts`

Current code (confirmed by reading it): builds an `OTA_AirLowFareSearchRQ` envelope, posts to `${BASE}/v5/offers/shop`, gates the whole real-Sabre path behind `!!process.env.SABRE_PCC`, and parses `groupedItineraryResponse.itineraryGroups[0].itineraries` — none of this matches your confirmed-working v1 API. `searchHotels` in that file doesn't even attempt a real call yet (`throw new Error('hotel search not enabled without PCC')`), it goes straight to simulated.

The fix (shape only, not full code, since this touches a file you may want to review before applying):

1. Change the base path to `/v1/offers/flightShop` and drop the `OTA_AirLowFareSearchRQ`/`POS`/`PseudoCityCode` envelope entirely — replace with the flat `{ journeys: [...], travelers: [...] }` body from §2.
2. Change `sabreConfigured()` to gate only on `SABRE_TOKEN` (drop the `SABRE_PCC` requirement for this call specifically — confirmed not needed in the payload for v1 Flight Shop with your token).
3. Rewrite `parseFlightResponse` to read the new flat shape (`json.flights`, `json.offers[].totalPrice.amount/currencyCode`, `json.offers[].validUntil`) instead of `groupedItineraryResponse`.
4. Implement `searchHotels` for real against `/v1/hotels/hotelSearch` with the same pattern, instead of throwing straight to simulated.
5. Keep the try/catch-and-fall-back-to-simulated structure exactly as it is — that safety net is correct and well-designed, it just needs to wrap a call that's actually reachable now.

This is the highest-leverage single fix available right now: it turns "real Sabre integration" from a fallback-to-simulated path into something that will actually return live inventory on the first real user query.

## 5. Sources for this document

Every claim above other than §4's read of the existing repo code was confirmed by a real, authenticated HTTP request made during this research session against `api.cert.platform.sabre.com`, `mcp.cert.sabre.com`, using the `SABRE_TOKEN` value in the repo-root `.env` — not by reading static documentation (which, for `developer.sabre.com`, is a JS application shell that doesn't serve content to a plain fetch, consistent with `docs/08_SPONSOR_DEEP_DIVE.md`'s note on this). The hackathon-specific Postman-hosted documentation pages you had open (Quickstart/Authentication/Air Search/Hotel Search/MCP Server tabs, and the `sabre/code*.txt` skill guides already in this repo — Authentication, Air Search, Hotel Search, MCP Tools, MCP Skills) independently corroborate every endpoint and tool name above.
