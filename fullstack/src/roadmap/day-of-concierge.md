---
name: The Day-Of Concierge
type: roadmap
status: planned
description: The morning of, Waypoint proactively briefs the traveler — gate, weather, traffic to the airport — before they even think to ask.
effort: medium
requires: ["price-watch.md"]
---

The best travel companion doesn't wait to be asked. On travel days, Waypoint reaches out first.

## What it looks like

- The morning of a flight, hotel check-in, or activity, Waypoint sends a short, useful briefing unprompted: "Your flight's on time, gate B12. Traffic to SFO looks light, leave by 4:15. It'll be 62 and clear in San Francisco."
- If something's already off (a real delay, bad weather at the destination) the briefing leads with that, and it's the same voice that would open a disruption conversation.
- The traveler can just talk back — "actually can we leave earlier" — and it's a normal `converse` turn from there.

## Key details

- One briefing per travel-day event, not a running feed of notifications.
- Delivered as a message in the existing conversation (and, once outbound calling to the traveler exists, optionally as a call) — never a separate notification system to maintain.
- Pulls from the flight status check already used for disruption detection, plus a weather/traffic lookup for the relevant leg.

~~~
A cron interface that scans for nodes with `start` within the next ~18 hours and no briefing sent yet (a new `briefingSentAt` field), composes a short message via the orchestrator's voice, and appends it as an agent-authored message with `source: 'system'`. Natural precursor to `proactive-alerts-call.md` — same trigger, different channel.
~~~
