---
name: Split the Bill
type: roadmap
status: planned
description: The moment something's booked, Waypoint already knows who owes what — and can ask for it.
effort: small
requires: ["shared-trips.md"]
---

Companions are already on the board watching the plan build. The next thing they think about is money — Waypoint should settle it before anyone has to bring it up.

## What it looks like

- When the owner confirms a booking, Waypoint asks, right in conversation: "Split this four ways with everyone on the trip?" One yes, and it's done.
- A running tally lives quietly on the board — who's paid, who hasn't — visible to everyone, not just the owner.
- Waypoint sends the ask itself, the same channel the invite came through (text or email), with a simple pay link. No spreadsheet, no separate app.

## Key details

- Waypoint never moves money itself — it hands off to a payment link, then listens for confirmation the same way it listens for a confirm-gate reply.
- Splits default to even, but the owner can adjust per-person in one line of conversation: "Actually just split the hotel, I've got the flights."
- Fully opt-in per trip; a solo trip or a trip where the owner's covering everything never sees it.

~~~
New `trip_expenses` table (`tripId`, `nodeId`, `amount`, `splitAmong: userId[]`, `paidBy: userId[]`), populated on booking confirmation. Payment collection itself is out of scope for Waypoint's own rails — generate a Stripe/PayPal-style request link via the AI SDK's payment integrations rather than handling funds directly. Reuses `trip_collaborators` for who's eligible to be split among, and the existing invite-channel (email/SMS) to send the ask.
~~~
