---
name: Price Watch
type: roadmap
status: planned
description: Waypoint keeps an eye on fares after you book and speaks up the moment there's money to save or a seat to grab.
effort: small
requires: []
---

Booking isn't the end of Waypoint's job. Fares move; Waypoint should notice before the traveler has to think to check.

## What it looks like

- After a flight or hotel confirms, Waypoint quietly keeps checking the same route/dates in the background.
- Fare drops past a meaningful threshold, or a better nonstop opens up: the traveler gets a proactive message ("Your Delta flight just dropped $40. Want me to see if I can get the difference refunded, or would you rather switch?").
- Nothing changes automatically. Any action still clears the confirm-gate.

## Key details

- Runs on a scheduled check per booked trip, not constant polling.
- Only flags changes worth acting on (a real dollar or comfort threshold), never noise.
- Quietly stops watching once the trip has started.

~~~
A cron interface polling `searchFlights`/`searchHotels` against each `confirmed` node's route/dates for trips with a future `startDate`, comparing to `costCents` on file. A meaningful delta creates an unprompted agent message (reusing the `messages` table with `source: 'system'`-style origin) rather than a pending action, since nothing should book itself.
~~~
