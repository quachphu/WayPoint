---
name: Call Anything
type: roadmap
status: planned
description: Not just disruptions — ask Waypoint to call any restaurant, hotel, or venue on your behalf, for anything.
effort: medium
requires: ["real-outbound-calling.md"]
---

The outbound call was built for disruptions, but the mechanism (disclosed, gated, transcribed) is general. Once it's real, there's no reason to limit it to flights breaking.

## What it looks like

- "Can you call and see if Zuni has a table for four at 8" becomes a normal request, not a special case.
- "Ask the hotel if we can get a late checkout" turns into a quick, disclosed call and a plain-language answer, no booking or spend implied unless one comes up.
- Any call that does surface a spend or change still runs through the exact same confirm-gate as everything else.

## Key details

- A new, general-purpose node kind or a lightweight "errand" attached to an existing node — a phone call doesn't always need its own board node.
- Same disclosure-first, transcript-as-data, rate-limited infrastructure as the disruption call; this is a new entry point, not new machinery.

~~~
Generalizes `runCall`'s `goal`/`target` beyond the disruption trigger; add a orchestrator tool (`proposeCall`) that raises a `place_call` pending action for arbitrary asks, reusing the existing gate and audit log unchanged.
~~~
