---
name: Straight to Your Wallet
type: roadmap
status: planned
description: The moment something's confirmed, it's already in Apple/Google Wallet and on the calendar — no exporting, no copy-pasting.
effort: quick
requires: []
---

The confirmation reference shouldn't live only inside Waypoint. The instant something books, it belongs everywhere the traveler already looks.

## What it looks like

- A flight or hotel transitions to `confirmed` and a wallet pass and calendar event appear automatically, no action needed.
- The detail panel gains a quiet "Add to Wallet" / "Add to Calendar" affordance for anyone who wants it manually too.
- If a disruption later changes the booking, the wallet pass and calendar event update in place — the same "no layout jump, same identity, new details" principle the board already follows.

## Key details

- Covers flights (boarding-pass-style pass), hotels (check-in reminder), and activities (calendar event with address).
- This is a small build with outsized trust payoff: it's the kind of detail that makes a product feel finished.

~~~
On `node_confirmed`/`rebooked` events, generate a `.pkpass` (Apple Wallet) and an `.ics` calendar attachment from the node's `detail`, surfaced via a signed download link. Update-in-place on rebook by reusing the same pass/calendar identifier keyed to the node id.
~~~
