---
name: The Real Call
type: roadmap
status: planned
description: Graduate the outbound call from a disclosed simulation to an actual phone call to a real airline or hotel desk.
effort: large
requires: ["proactive-traveler-calls.md"]
---

The simulated call proved the flow is right and the disclosure is non-negotiable. This is where Waypoint actually picks up the phone.

## What it looks like

- Nothing changes about what the traveler sees: the same confirm-gate before dialing, the same hardcoded disclosure line first, the same live transcript streaming into the call layer.
- What changes is who's on the other end — a real airline or hotel phone tree and, eventually, a real human agent, not a second AI persona playing a role.
- Waypoint navigates IVR menus, holds, and transfers, and honestly reports when it can't get through, exactly like the simulated "line busy" case does today.

## Key details

- Ships behind real, per-airline testing; the simulated path stays as the guaranteed fallback and demo mode, never fully retired.
- The prompt-injection defense is even more load-bearing here: a real human on the other end could say anything, and the confirm-gate must hold regardless.
- Outbound daily caps (already specified for the simulated path) become a real cost/quota control, not just a demo guard.

~~~
Wires `runCall` to Vocal Bridge's real outbound telephony instead of the two-AI-personas simulation, keeping the same `call_sessions` schema, hardcoded disclosure, and transcript-as-data handling. IVR navigation likely needs DTMF tone support and hold-music detection. Real airline phone trees are inconsistent enough that this needs its own testing/fallback matrix per carrier.
~~~
