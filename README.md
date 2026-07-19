# Waypoint — build spec package

> Working name only, rename freely. This package is written to be fed to a coding agent (Claude Code or equivalent) as the full context needed to build this project properly, end-to-end, from an empty repo to a real deployed product.

## What this is

Waypoint is a voice-first AI travel companion. The user talks to it the way they'd talk to a friend who's good at logistics: "plan me a weekend in San Francisco," "we just landed, find us a place for ramen," "my flight got delayed, figure it out." The agent plans, books, and — when something breaks — actually picks up the phone and calls the airline or hotel to fix it, then reports back. The plan itself is never just described in text: it renders as a live, connected board of the whole trip that builds while the agent talks and expands on click, see `docs/07_PLANNING_BOARD.md`, this is the single most important surface in the product. Chat exists alongside voice as an equal, always-in-sync channel, but voice is the primary input and output.

This project originated for the DeepLearning.AI Voice AI Hackathon, powered by Sabre and Vocal Bridge, which is why Sabre APIs and Vocal Bridge are required integrations throughout this package, not optional ones. The build plan itself, however, is written for building this properly, not for a single event day, see `docs/06_BUILD_PLAN.md`.

**Spec vs. what's actually running.** `docs/01` through `docs/08` are the original pre-build plan, written before a line of code existed, and they describe an aspirational stack (LangGraph `StateGraph`, a Python FastAPI backend). The real hackathon build in `fullstack/` diverged from that on the framework specifics — it's a MindStudio-native TypeScript backend with a hand-rolled Claude tool-loop orchestrator (`fullstack/dist/methods/src/common/agent.ts`), not LangGraph — while keeping every non-negotiable the spec actually cared about: voice-first with chat always in sync, a live connected planning board, and every booking gated behind explicit user confirmation. Treat `docs/01-08` as the design rationale (why the confirm-gate exists, why the board is shaped the way it is, the security model) and `docs/09_SABRE_LIVE_VERIFIED.md` / `docs/10_ARCHITECTURE_DIAGRAM.md` as ground truth for what's actually running today. See "Current build status" below for the specifics.

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
| 8 | `docs/08_SPONSOR_DEEP_DIVE.md` | A fresh, sourced research pass against Sabre's and Vocal Bridge's live current docs — confirms, corrects, and deepens `03_API_INTEGRATION.md` with verified endpoints, credential gotchas, and a hackathon-day action plan |
| 9 | `docs/09_SABRE_LIVE_VERIFIED.md` | Verified by making real authenticated calls against Sabre's cert environment with our actual hackathon credentials — the real working API family, the real MCP servers, and the concrete fix needed in `fullstack`'s Sabre client |
| 10 | `docs/10_ARCHITECTURE_DIAGRAM.md` | Presentation-ready Mermaid diagrams of the system as it actually runs — system overview, a full voice-turn sequence diagram, and the event-sourcing data model |

## Non-negotiables

1. **Sabre APIs and Vocal Bridge are required**, not optional integrations. If either is missing from the final build, the submission doesn't qualify for prizes regardless of how good the rest is.
2. **Every action that spends money or changes a booking pauses for explicit user confirmation.** No exceptions, no "the user probably wants this." This is both a UX requirement and the core safety mechanism against prompt injection through untrusted call transcripts. `docs/02_ARCHITECTURE.md` describes the mechanism as a LangGraph `interrupt()` (the original spec); the actual build implements the same gate as a `pendingActions` table plus a `ConfirmGate` UI component that a booking node writes to and only `approveAction.ts` can clear, on an explicit tap, never inferred from a voice or chat turn. Same guarantee, different plumbing. See `docs/04_SECURITY_COMPLIANCE.md` for why the guarantee itself matters.
3. **Every outbound call opens with an AI disclosure.** Not a nice-to-have, see `docs/04_SECURITY_COMPLIANCE.md`. Vocal Bridge's own terms of service make you solely responsible for TCPA compliance.
4. **Voice is the default; chat is never removed.** Every state-changing event must be visible and actionable from both surfaces, they read and write the same shared trip state.
5. **Ship something deployed**, not something that only runs on `localhost`. A live URL, even a rough one, beats a polished local demo.

## What "done" looks like

Anyone, without any coaching, should be able to:
- Say "plan me a trip to San Francisco this weekend" and watch a real itinerary (real Sabre flight and hotel offers) build live as connected nodes on the planning board while the agent talks through it, then click any node for its full detail.
- Say "my flight got delayed" and watch the disruption agent pull the booking, find alternatives, place a real outbound call, and come back with a proposed new plan that requires an explicit yes before anything rebooks, the affected node on the board visibly changing state throughout.
- See the same conversation and the same trip state reflected in a chat panel, in real time, from either channel.

Everything else in this package is in service of that, built properly, per `docs/06_BUILD_PLAN.md`, not rushed toward it.

## Current build status

What's actually true in `fullstack/` as of this writing, for anyone presenting or picking this up cold:

- **Voice**: Vocal Bridge, in AI Agent mode with continuous conversation — the mic re-arms itself after every agent turn, no click-to-talk between turns. (Not Grok/xAI; that was the original voice layer and has been fully replaced. xAI TTS remains only for the mascot's one-shot narration lines, unrelated to the conversation loop.)
- **Orchestrator**: a hand-rolled JSON tool-loop over Claude Sonnet (`common/agent.ts`), not a LangGraph `StateGraph` — same idea (gather → search → propose → gate → done), different implementation. It carries the last 12 turns of real conversation history, so it doesn't re-ask what it was already told.
- **Reliability guarantee**: the orchestrator can never hand back an empty/silent reply, even if a big request ("plan all 3 days") runs it out of its tool-call budget for one turn — it forces a wrap-up reply summarizing progress so far and asks whether to continue, with a hardcoded fallback if even that fails. This was a real bug (traveler got dead silence after big requests) fixed and verified by code-path inspection.
- **Sabre**: live Flight Shop v1 (`/v1/offers/flightShop`) and Hotels Search v1 (`/v1/hotels/hotelSearch`) against the cert environment with real hackathon credentials — confirmed with authenticated live calls, not simulated. Falls back to a simulated inventory generator only on a genuine error or empty result, and logs when it does (`[sabre] ... fell back to simulated`), never silently. See `docs/09_SABRE_LIVE_VERIFIED.md` for the full verification trail and why the original BFM v5 client in `docs/03` doesn't apply to these credentials.
- **Planning board**: day-by-day swimlanes (Day 1, Day 2, ... rendered per the trip's actual date range), not a flat list. Day index is computed fresh from each node's timestamp and the trip's start date on every read, so it self-heals if the trip's dates get pinned down after a node was already proposed. Connector edges are derived from final chronological adjacency, not creation order.
- **Real enrichment, not placeholders**: activity/hotel cards show a real photo (Wikipedia image lookup with a relevance guard) and real transit info between consecutive stops (OSRM driving/walking duration + distance, geocoded via Nominatim) — no stock images, no invented "5 min walk."
- **Booking safety**: idempotent on both sides — `ConfirmGate.tsx` has a client-side busy guard against double-tapping approve, and `approveAction.ts` checks the action's status server-side before executing, so a flight or hotel can't get double-booked.
- **Data model**: event-sourced (`trip_events` append-only log, pure fold into a materialized `trips` projection), on MindStudio-managed Postgres/Supabase, not the FastAPI + LangGraph-checkpointer stack in `docs/02`.

For a presentation-ready visual of all of the above, use `docs/10_ARCHITECTURE_DIAGRAM.md` directly — it's the one diagram in this package guaranteed to match the code, not the plan.
