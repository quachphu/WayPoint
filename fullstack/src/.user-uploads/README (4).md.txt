# Waypoint — build spec package
> Working name only, rename freely. This package is written to be fed to a coding agent (Claude Code or equivalent) as the full context needed to build this project properly, end-to-end, from an empty repo to a real deployed product.
## What this is
Waypoint is a voice-first AI travel companion. The user talks to it the way they'd talk to a friend who's good at logistics: "plan me a weekend in San Francisco," "we just landed, find us a place for ramen," "my flight got delayed, figure it out." The agent plans, books, and — when something breaks — actually picks up the phone and calls the airline or hotel to fix it, then reports back. The plan itself is never just described in text: it renders as a live, connected board of the whole trip that builds while the agent talks and expands on click, see `docs/07_PLANNING_BOARD.md`, this is the single most important surface in the product. Chat exists alongside voice as an equal, always-in-sync channel, but voice is the primary input and output.
This project originated for the DeepLearning.AI Voice AI Hackathon, powered by Sabre and Vocal Bridge, which is why Sabre APIs and Vocal Bridge are required integrations throughout this package, not optional ones. The build plan itself, however, is written for building this properly, not for a single event day, see `docs/06_BUILD_PLAN.md`.
## How to use this package
Read in this order. Each doc is self-contained but builds on the one before it.
| Order | File | What's in it |
|---|---|---|
| 1 | `01_PRODUCT_BRIEF.md` | Goal, target user, problem statement, feature scope, full user workflows, edge cases, definition of done |
| 2 | `docs/02_ARCHITECTURE.md` | System design, data structures & algorithms with rationale, data models, the agent graph |
| 3 | `docs/03_API_INTEGRATION.md` | Concrete, tested integration details for Sabre, Vocal Bridge, AgentPhone, and Google Maps — real endpoints, real auth flows, real request shapes |
| 4 | `docs/04_SECURITY_COMPLIANCE.md` | Auth, secrets, prompt injection defense, and the TCPA outbound-calling compliance requirements (read this before wiring up any outbound call) |
| 5 | `docs/05_DESIGN_SYSTEM.md` | Visual language — Notion's structural calm plus Apple's clarity/depth — as concrete tokens and component specs |
| 6 | `docs/06_BUILD_PLAN.md` | Phased build plan in dependency order, each phase with a real definition of done |
| 7 | `docs/07_PLANNING_BOARD.md` | The signature feature, full spec: the live, connected trip board, why it's shaped this way, and exactly how it wires to Vocal Bridge's bidirectional Client Actions |
## Non-negotiables
1. **Sabre APIs and Vocal Bridge are required**, not optional integrations. If either is missing from the final build, the submission doesn't qualify for prizes regardless of how good the rest is.
2. **Every action that spends money or changes a booking pauses for explicit user confirmation.** No exceptions, no "the user probably wants this." This is both a UX requirement and the core safety mechanism against prompt injection through untrusted call transcripts. See `docs/02_ARCHITECTURE.md` for the mechanism (LangGraph `interrupt()`) and `docs/04_SECURITY_COMPLIANCE.md` for why.
3. **Every outbound call opens with an AI disclosure.** Not a nice-to-have, see `docs/04_SECURITY_COMPLIANCE.md`. Vocal Bridge's own terms of service make you solely responsible for TCPA compliance.
4. **Voice is the default; chat is never removed.** Every state-changing event must be visible and actionable from both surfaces, they read and write the same shared trip state.
5. **Ship something deployed**, not something that only runs on `localhost`. A live URL, even a rough one, beats a polished local demo.
## What "done" looks like
Anyone, without any coaching, should be able to:
- Say "plan me a trip to San Francisco this weekend" and watch a real itinerary (real Sabre flight and hotel offers) build live as connected nodes on the planning board while the agent talks through it, then click any node for its full detail.
- Say "my flight got delayed" and watch the disruption agent pull the booking, find alternatives, place a real outbound call, and come back with a proposed new plan that requires an explicit yes before anything rebooks, the affected node on the board visibly changing state throughout.
- See the same conversation and the same trip state reflected in a chat panel, in real time, from either channel.
Everything else in this package is in service of that, built properly, per `docs/06_BUILD_PLAN.md`, not rushed toward it.