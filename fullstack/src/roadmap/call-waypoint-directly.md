---
name: Just Call Waypoint
type: roadmap
status: planned
description: Dial a phone number and talk to Waypoint the way you'd call a friend — full parity with the app, no screen required.
effort: large
requires: ["sms-companion.md", "real-outbound-calling.md"]
---

Everything Waypoint can do by voice in the browser, available over an actual phone call, inbound. This is voice-first taken to its logical conclusion: sometimes there's no app to open at all.

## What it looks like

- A traveler dials a Waypoint number from any phone, anywhere, and has a real spoken conversation: plan a trip, report a delay, approve a rebooking, all by voice, no screen.
- Hang up and open the app later, and the board reflects everything decided on the call, because it's the exact same `converse` and event log underneath.
- Confirm-gates work by voice alone here too: an explicit spoken "yes" is what clears the gate, recorded the same way an in-app voice approval is.

## Key details

- This is the highest-leverage "new surface" bet: it makes Waypoint usable in the exact moments it's most needed (stranded at a gate, phone in a pocket, hands full).
- Requires real inbound telephony, not just the outbound capability built for airline calls — a meaningfully bigger lift than the SMS companion.

~~~
Inbound call handling via Vocal Bridge (or equivalent inbound telephony), transcribing in real time and calling `converse` with `source: 'phone'`. Needs caller identification (phone-number match to a traveler record, falling back to a spoken verification step) since there's no session cookie on a phone call. Reuses the entire orchestrator; this is new surface plumbing, not new agent logic.
~~~
