# Product brief

## 1. Goal

Build a voice-first AI travel companion where a user can plan, book, and manage a trip almost entirely by talking to it, with chat and a live visual planning board (`docs/07_PLANNING_BOARD.md`) as an equal, always-in-sync surface. The differentiating bet is that the agent doesn't just describe what it would do, it actually does it: it books through Sabre, and when something breaks (a flight delay, a hotel mix-up), it places a real outbound phone call through Vocal Bridge to fix it, the way a human travel concierge would, and the user watches it happen on the board in real time rather than reading a summary afterward.

## 2. Problem statement

Trip planning today is fragmented across a dozen apps and tabs: flight search, hotel search, a maps app for figuring out logistics between stops, a group chat for coordinating with travel companions, a separate app for splitting the bill, and — when something goes wrong — a phone call that only the human can make, because most airline and hotel systems still don't have a self-serve API for irregular operations. Every leg lives in a different app and none of them talk to each other. When a flight is cancelled at 11pm, the traveler is the integration layer, manually stitching together a new plan from five different screens while stressed and possibly in a foreign country.

## 3. Target user

Primary: a group of friends or a solo traveler planning a multi-day trip who wants a single point of contact for the whole thing, someone who would rather talk out loud ("find us something for dinner near the hotel") than fill out a search form, and who wants a real safety net when travel goes sideways.

Design the first release around a 2-4 day domestic US trip (e.g. LA to San Francisco): the search space is small enough to validate cleanly end to end, and it keeps the Sabre content set (US carriers, US hotel inventory) reliably available in the certification environment while the core product is being proven out. International and longer, more complex trips are a natural extension once the core loop is solid, not a different architecture.

## 4. What makes this different from a chat-based trip planner

The reference point in this space (an existing product called Trippo, not affiliated with this build) already proves that "one shared room that captures photos, plans, and expenses" is a pattern people want. It's chat-first: you paste tickets, you paste a cancellation email, the app updates. That's useful but it's still the user doing the labor of noticing something changed and feeding it to the app.

Waypoint inverts that. Voice is the primary input and output. The agent notices things (a flight status change), initiates contact (calls the user or calls the airline), and only asks the user to confirm a decision, not to do the legwork of gathering the information. Chat stays, as a log and an alternate input, but it's never the only way to interact with the trip.

## 5. Scope: core release vs. later phases vs. explicitly out of scope

### Core release (build this properly, it's the whole product's foundation)

- Voice conversation (Vocal Bridge) as the primary interface for both planning and disruption handling; text chat as a parallel, always-available surface backed by the same state
- Trip planning conversation: user describes a trip in natural language, agent searches real Sabre flight and hotel offers, proposes an itinerary, user confirms before anything books
- The live planning board (`docs/07_PLANNING_BOARD.md`): the trip renders as connected, clickable nodes that update in real time as the agent talks, this is the signature interaction and deserves the same engineering care as the booking logic itself, not a visual afterthought
- Disruption flow end-to-end: user reports (or the app simulates, for testing) a flight delay → agent pulls the existing booking from Sabre → finds rebooking options → places a real outbound call via Vocal Bridge → proposes the new plan → user confirms → agent executes the change → both chat, voice, and the board reflect the update
- A real, deployed environment, reachable by URL, not something that only runs on a laptop

### Later phases (build after the core release is solid, in priority order)

1. Hotel-side disruption handling (agent calls the hotel about a room issue), the second example the hackathon brief itself names alongside the airline-rebooking case
2. Multi-stop itinerary ordering for in-city activities ("show me the best order to see these 4 things today")
3. Group trip support (multiple users in one trip room, matching the reference app's pattern)
4. Photo capture that auto-places on the trip timeline by location/time
5. Expense split and settle-up (cheap to add, proven demand from the reference app)
6. Multilingual voice (the hackathon's own example is a bilingual Japanese/English hotel call)
7. Auto-generated trip recap

### Explicitly out of scope for now

- Real payment processing (simulate the charge, or use Stripe test mode; do not touch real cards)
- Multi-region deployment, autoscaling, or any of the "multi-million user" concerns — that's a real, separate later conversation once the core product is validated with real usage
- Full TCPA production compliance infrastructure (a real consent database, DNC scrubbing across a full user base) — the disclosure script and the per-user consent flag in `docs/04_SECURITY_COMPLIANCE.md` are the right starting point, the fuller infrastructure is worth building as usage grows, not before there are real calls to protect
- Support for international carriers/hotels beyond whatever Sabre's certification environment returns, until there's a reason to move toward production Sabre access

## 6. Core user workflows

### 6.1 First-time planning conversation (voice-primary)

1. User opens the app, taps to start a voice session (Vocal Bridge WebRTC connection established via the app's backend-issued short-lived token).
2. User says something open-ended: "Plan me a long weekend in San Francisco from LA, leaving Friday."
3. Agent asks at most one or two clarifying questions if truly needed (dates if ambiguous, number of travelers), otherwise proceeds with sensible defaults and states them out loud ("I'll assume 2 nights, one traveler, budget mid-range, let me know if that's wrong").
4. Agent calls the flight search tool (Sabre Bargain Finder Max) and hotel search tool (Sabre hotel availability) in parallel.
5. As results come back, the agent narrates a summary out loud *and* pushes a structured update over the data channel so the UI renders a live itinerary card for each leg (flight out, hotel, flight back) as it's decided, not all at once at the end. This is the graph-building-live moment.
6. Agent proposes a complete draft itinerary, states the total cost, and explicitly asks for confirmation before booking anything ("Want me to book this?").
7. On confirmation, agent executes the Sabre booking calls, gets back a PNR (confirmation code), and both voice and chat report success with the confirmation details.
8. If the user says no or asks for a change ("cheaper hotel," "later flight"), agent re-runs the relevant search with the new constraint and returns to step 5. This loop has no fixed limit, the graph structure (see architecture doc) means each iteration only recomputes the affected leg, not the whole trip.

### 6.2 Disruption and rebooking (the flagship scenario, and the hardest one to get right)

1. Trigger: user says "my flight got delayed" (or, for testing without waiting on a real disrupted flight, a pre-seeded test event fires on a command like "simulate the delay").
2. Disruption agent retrieves the existing booking from Sabre (Booking Management API, by confirmation ID) to get current flight details.
3. Disruption agent re-shops (Bargain Finder Max) for alternative flights matching the traveler's remaining itinerary constraints.
4. Disruption agent places an outbound call via Vocal Bridge to the relevant number (see `docs/06_BUILD_PLAN.md`'s closing notes for how to test this without ever calling a real airline). The call opens with a mandatory AI disclosure line. The live transcript streams back into the app in real time and renders in the voice UI, the chat log, and inline in the affected node's detail panel on the planning board (`docs/07_PLANNING_BOARD.md` §6, §8) as it happens.
5. Once the call concludes (or in parallel with it, if the rebooking doesn't strictly require the call to complete first), the agent synthesizes a proposal: "Here's what I found: [option]. Want me to book it, or should I look for something else?"
6. This is a hard interrupt point, the graph pauses and will not execute a booking or a charge without an explicit yes. See `docs/02_ARCHITECTURE.md`, this is implemented as a LangGraph `interrupt()` before the booking node, not a soft suggestion.
7. On confirmation, the agent executes the change through Sabre, updates the shared trip state, and both voice and chat reflect the new itinerary. If the trip has other members (group mode), they see the update land in chat even if they weren't on the call.
8. If the user declines the proposal, the agent asks what they'd like instead and loops back to step 3 with the new constraint.

### 6.3 In-trip, in-the-moment assistance (later phase)

User, mid-trip: "we just landed, find us something for dinner near the hotel." Agent uses the user's current location (client-reported) plus the known hotel location to query nearby options, proposes 2-3, and — if the option requires a reservation and there's no booking API for it — offers to place a call to make the reservation, following the same disclosure-and-confirm pattern as the disruption flow.

## 7. Edge cases to design for explicitly

These are not hypothetical, a coding agent should write handling for each of these, not just the happy path.

| Edge case | Required behavior |
|---|---|
| Outbound call goes unanswered / voicemail | Agent does not leave the traveler's booking details on a voicemail. It reports back to the user that the call didn't connect and offers to retry or try a different channel. |
| Sabre offer expires between shopping and booking (offers have a time-to-live) | Agent re-validates the offer before booking (this is exactly what Sabre's revalidation step is for); if expired, it re-shops silently and re-confirms price with the user before proceeding rather than booking at a stale price. |
| User interrupts the agent mid-sentence with a correction | Voice agent yields immediately (Vocal Bridge's real-time layer is designed for this), the background reasoning agent incorporates the correction into the next turn rather than finishing its original plan. |
| Two channels update at once (user says something by voice while a teammate edits in chat) | Resolved by the event-sourced trip state, not by picking a winner arbitrarily, see `docs/02_ARCHITECTURE.md`. Both events are recorded in order; if they conflict (e.g. two different hotel picks), the agent surfaces the conflict back to the user rather than silently picking one. |
| Low-confidence speech-to-text on a name or number (airport code, confirmation number) | Agent reads back anything safety- or money-critical before acting on it ("I heard SFO to LAX on the 18th, is that right?") rather than silently proceeding on a guess. |
| User asks for something outside what's buildable in scope (e.g. an international carrier not in the cert dataset) | Agent says so plainly rather than hallucinating an offer. Never fabricate flight numbers, prices, or confirmation codes. |
| Disruption call would need to happen outside reasonable calling hours or the destination's time zone | Flag this to the user rather than silently placing a 3am call. A simple time-of-day/time-zone check is the right starting scope; a fuller scheduling system is a later refinement, not a blocker to shipping the core flow. |
| Confirm-gate response is ambiguous ("maybe," "I guess") | Agent asks a direct yes/no follow-up rather than interpreting an ambiguous answer as consent. A booking or a charge never proceeds on anything less than a clear affirmative. |
| Group trip: one member confirms a change another member would object to | Out of scope for the core release (group trips are a later phase, §5), but the architecture must not make this impossible to add later — every booking action should be attributable to the specific user who confirmed it, this falls out naturally from event sourcing, see the architecture doc, so don't build anything in the core release that would make attribution ambiguous later. |

## 8. Success criteria

- [ ] Someone who has never seen the app can complete the full planning conversation (§6.1) using only their voice, and watch the planning board build live, node by node, as it happens.
- [ ] Clicking any node on the board, at any point, opens correct and current detail for that specific piece of the trip, and the voice agent is aware of what was clicked.
- [ ] The disruption flow (§6.2) runs end to end with a real phone call, audibly, and the affected board node visibly reflects the disruption throughout, not just at the end.
- [ ] Nothing books or charges without a visible, explicit confirmation step, verified by an actual test that tries to defeat it, not just manual observation.
- [ ] The same trip state is visible and correct in the voice conversation, the chat panel, and the planning board, simultaneously, from any of the three.
- [ ] The app is reachable at a public URL under real deployment infrastructure, not a laptop with a tunnel to it.
- [ ] Every outbound call opens with an audible AI disclosure line, no exceptions, verified in code, not just in the happy-path script.
