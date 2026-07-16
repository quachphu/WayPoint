---
name: Waypoint Calls You
type: roadmap
status: planned
description: For the moments that matter, Waypoint calls the traveler directly, the same way it already calls the airline.
effort: small
requires: []
---

The call-consent checkbox has been sitting on every traveler's profile since day one, waiting for this. Waypoint already knows how to run a disclosed, transcribed, audited call — now it places that call to the traveler, not just on their behalf.

## What it looks like

- For anything urgent enough to interrupt a day (a cancelled flight, a same-day gate change, a hotel that lost the reservation), Waypoint calls instead of just messaging, if the traveler consented at sign-up.
- The call opens with the same kind of plain disclosure the airline calls use, adapted ("Hi, it's Waypoint, calling about your 6:40 flight..."), states the situation, and offers to text a link back to the live board.
- If they don't pick up, it falls back to the message/briefing channel — the call is an escalation, never the only path.

## Key details

- Strictly gated by the `callConsent` flag already on the traveler record; no consent, no call, ever.
- Reuses the entire `call_sessions` audit infrastructure built for the airline call — disclosure, transcript, consent basis — just with `target` set to the traveler.
- Frequency-capped hard: this is for genuinely urgent moments, never a marketing channel in disguise.

~~~
Extends `runCall`'s target beyond "venue" to "traveler," gated on `users.callConsent`. Reuses the daily outbound-call rate limiter already specified in `src/disruption.md`. Trigger sources: `reportDisruption` for high-severity cases, and the day-of concierge's flight-status check.
~~~
