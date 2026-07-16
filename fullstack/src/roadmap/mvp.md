---
name: Waypoint MVP — The Three Flagship Moments
type: roadmap
status: done
description: Plan a trip on a live board, survive a real disruption with a confirm-gated outbound call, and watch voice and chat stay in perfect sync.
effort: large
requires: []
---

# Waypoint MVP — The Three Flagship Moments

The founding build. Waypoint went from an idea to a voice-first travel companion that plans real trips, handles them breaking, and never spends a dollar or dials a number without an explicit yes. Built, verified, and polished end to end.

## What shipped

- **Plan a trip, watch it build.** Say "plan me a weekend in San Francisco" and a live node-and-edge board fills in while the agent talks — flights, a hotel, activities — backed by real Sabre inventory (with a resilient simulated fallback), ranked against the traveler's own preferences.
- **Survive a disruption.** Report a delay (or trigger the demo affordance) and Waypoint re-shops alternatives, proposes placing a call, then runs a live, streamed, fully disclosed simulated outbound call to the airline — opening with the hardcoded AI disclosure line, never the model's discretion — before proposing the rebook. Nothing rebooks without an explicit approval.
- **One brain, two channels.** Voice and chat both run through a single orchestrator entry point. What's said becomes what's typed becomes what's shown on the board — one event-sourced trip log, no seams.
- **The confirm-gate, enforced as code.** Every booking and every call is structurally impossible to trigger without a traveler's explicit yes, including under a maximally adversarial call transcript.
- **Ships polished, not just working.** Email-code auth, four seeded scenarios (weekend-planned, mid-disruption, empty-traveler, fresh-plan) so the product can be experienced in any state on demand, full light/dark theming, and interaction polish throughout (motion, streaming, empty/error states).

## Why it matters

This is the proof that an AI travel companion can *act*, not just describe. The board makes the agent's work visible instead of a wall of text; the outbound call is the moment competitors can't fake; the confirm-gate is what makes acting on a traveler's behalf trustworthy enough to actually use. Verified end to end, this is no longer a demo of an idea — it's a real, trustworthy product surface ready to grow from.

## What's next

Several capabilities were deliberately deferred, not cut, and are noted throughout the spec: ticket-import via document extraction, a learned preference ranker, real Places/Directions-backed activity ordering, event-log snapshotting at scale, and the "Waypoint calls the traveler" pattern (the call-consent flag is already captured and waiting). The roadmap below picks up exactly there.

## History

- **2026-07-16** — MVP shipped: live planning board, the disruption + outbound call flow, and unified voice/chat via the event-sourced trip log.
- **2026-07-16** — Verified and polished end to end: all three flagship moments confirmed working together, confirm-gate enforced in code, Sabre wired with simulated fallback, four seeded scenarios, email-code auth, light/dark theming, and full interaction polish shipped.
