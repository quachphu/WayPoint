---
name: Forward It, Waypoint Builds It
type: roadmap
status: planned
description: Forward a confirmation email or upload a PDF and Waypoint turns it straight into board nodes, no retyping.
effort: medium
requires: []
---

Half of every trip already exists in an inbox somewhere. Waypoint should read it, not make the traveler retype it.

## What it looks like

- Forward a flight confirmation, hotel receipt, or event ticket PDF to Waypoint (or drop it into chat).
- Within seconds, real nodes appear on the board — flight, hotel, show, whatever it was — already `confirmed`, with the booking reference and detail panel filled in.
- If the trip doesn't exist yet, Waypoint creates it and infers the title/destination from the document.
- If it's ambiguous (missing a date, unclear which trip it belongs to), Waypoint asks one concise question rather than guessing.

## Key details

- Works from email forward, upload, or a photo of a printed itinerary.
- Anything imported gets `detail.source: 'imported'` so it's honest in the audit trail even though it renders identically to a Waypoint-made booking.
- Imported nodes still participate in disruption handling — a delay on an imported flight triggers the same re-shop-and-call flow as one Waypoint booked itself.
- This is the natural front door for travelers who already booked elsewhere and just want Waypoint to take over from here.

~~~
Uses the Landing AI key already provisioned for document extraction (`LANDING_AI_KEY`, noted but unused in `src/integrations.md`). Parse to the same normalized node shape used elsewhere so downstream code (disruption, board rendering) never branches on origin. A new `trip_events` kind (`node_imported`) keeps the event log honest about provenance.
~~~
