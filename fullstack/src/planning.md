---
name: Planning
description: How a trip gets planned, from a first utterance to a confirm-gated booking, backed by real Sabre inventory.
---

# Planning

This is the first of the three flagship moments: the traveler says "plan me a weekend in San Francisco," and a real itinerary builds live on the board while Waypoint talks it through, then any node clicks open to full detail. Booking anything always passes the confirm-gate.

## The worked flow

1. **"Plan a weekend in San Francisco."** The board is empty; a transient "Searching flights" hint appears at the top before any node exists. `converse` creates the trip (title "Weekend in San Francisco", destination inferred) and runs the agent turn.
2. **First flight decided.** `searchFlights` returns a ranked shortlist; the agent picks the best two or three to say out loud, and `proposeNode` fades in an outbound flight node in `proposed` state. Waypoint says something concrete ("Best nonstop is Delta at 6:40 for $214").
3. **Hotel decided.** `searchHotels` runs; a hotel node appears, connected to the flight by a labeled edge ("18 min drive"). Return flight added similarly.
4. **Activities.** `suggestActivities` proposes one or two located activity nodes for the day, connected in chronological order.
5. **The traveler wants it.** "Book the flight and hotel." The agent revalidates the chosen offers and calls `proposeBooking` for each, raising the confirm-gate with an exact summary. Nothing is booked yet.
6. **Confirm-gate → confirmed.** The traveler approves each (or a spoken "yes"); `approveAction` books via Sabre and the nodes transition `proposed → confirmed` (bar color only, no layout jump), each gaining a booking reference. Declining sends the agent back to re-propose.
7. **Detail on demand.** Clicking any node opens the detail panel beside the board with the full offer: fare/rate breakdown, times, address, confirmation reference, cancellation terms.

~~~
The "no layout jump on confirm" rule is load-bearing (see `src/interfaces/@brand/visual.md`): proposed→confirmed changes only the status gauge color, never node size or position, so the traveler's mental map of the board survives the transition mid-conversation.
~~~

## Normalized inventory shape

Sabre results and simulated fallback results share one shape so the rest of the app never branches on source.

~~~
`FlightOffer`:
- `id` (string, Sabre offerId or generated), `source` ('sabre' | 'simulated')
- `carrier` (string, e.g. "Delta"), `flightNumber` (string), `origin` / `destination` (IATA)
- `departAt` / `arriveAt` (number, unix ms), `durationMin` (number), `stops` (number)
- `priceCents` (number), `fareBrand` (string), `ttl` (number | null: offer expiry)
- `raw` (JSON: the original offer, kept for revalidation/booking)

`HotelOffer`:
- `id`, `source`, `name`, `neighborhood`, `address`, `checkIn` / `checkOut` (number)
- `nightlyCents`, `totalCents`, `rating` (number), `cancellable` (boolean), `raw`

`ActivitySuggestion`:
- `id`, `name`, `category`, `neighborhood`, `blurb`, `suggestedAt` (number | null), `sourceUrl` (string | null)

The Sabre client (`common/sabre.ts`, `src/integrations.md`) and a `common/simulate.ts` generator both produce these. `common/rank.ts` scores and orders them.
~~~

## Ranking

The agent shows only the best two or three options. Ranking is a hand-tuned weighted score, not a model: it weighs price, total duration, stop count, and match to the traveler's stated preferences (nonstop preferred, seat, hotel style) and the current request. Sabre already returns price-ranked results; this re-ranks the top slice against preferences so "the best one" reflects *this* traveler.

~~~
Keep `rank.ts` simple and legible: normalize each factor to 0-1, apply fixed weights (price and duration dominate; preference match is a tie-breaker/booster), sort descending. This is the right tool at this stage; a learned ranker is a roadmap item once there is real usage data.
~~~

## Booking (only via the gate)

`proposeBooking` never books. It revalidates the offer (mandatory, see `src/integrations.md`) and writes a `pending_actions` row. The actual booking happens only inside `approveAction`, which re-checks the pending row, calls the Sabre booking (or simulated confirmation in the fallback / cert path), writes a `node_confirmed` event carrying the `bookingRef` and final `costCents`, and re-folds. If revalidation shows the fare moved, the summary reflects the new price and the traveler must approve the new number; a silent re-price never happens.

~~~
Cert-environment bookings and simulated bookings both produce a realistic confirmation reference and move the node to `confirmed`. The distinction (`detail.source`) is recorded but not dramatized to the traveler. No real money moves in either case; the gate is treated as if it does.
~~~

## Edge cases

~~~
- **Fare expired mid-conversation** → revalidate, surface the new price, re-gate. Never book stale.
- **No results for the route/dates** → say so plainly and offer the nearest alternative (different day, nearby airport), do not invent a flight.
- **Traveler changes their mind after proposing** → decline the pending action, re-propose; the board node stays `proposed` or is removed, never left in a half-booked state.
- **Sabre unreachable** → fall back to simulated inventory transparently; the flow completes. Logged via console.error.
- **Ambiguous request** ("somewhere warm next month") → the agent asks one concise clarifying question rather than guessing a city.
- **Activity scheduled before arrival** → the topological read on the graph catches the ordering violation; the agent fixes the sequence rather than proposing an impossible plan.
~~~
