---
name: Text Waypoint Like a Friend
type: roadmap
status: planned
description: No app, no login screen — just text a phone number, the way you'd text a friend who's good at logistics.
effort: small
requires: []
---

Voice is the front door, but a phone number is a front door too, and it's the one that works from anywhere without opening anything.

## What it looks like

- A traveler texts a Waypoint phone number: "we just landed, find us ramen" and gets a real answer back, the same brain, in the same voice.
- A link back to the live board rides along in the reply for anything worth seeing, not just reading.
- Fully continuous with the app: a trip planned by text shows up on the board exactly like one planned by voice.

## Key details

- This is the natural rescue channel for exactly the moments Waypoint is built for — stuck at an airport, phone nearly dead, no patience to open an app.
- Confirm-gates still apply: texting "book it" satisfies the gate the same way a spoken "yes" does today.

~~~
An SMS/webhook interface that calls the same `converse` method with `source: 'sms'` (a new source alongside `voice`/`chat`), routed to/from a provisioned number via the SDK's SMS integration. Reuses the entire orchestrator, event log, and confirm-gate; the SMS reply is just another rendering of the same reply text.
~~~
