---
name: Your Travel Circle
type: roadmap
status: planned
description: A living memory of every trip you've taken with the people you travel with, and a place to draw on their recommendations.
effort: large
requires: ["shared-trips.md"]
---

Trips are shared now — the people on them are a real graph. This turns Waypoint from a single-trip tool into a travel companion that remembers your people, not just your places.

## What it looks like

- A traveler's profile grows a quiet history: every past trip, who was a companion on it (owner or promoted), and a beautifully simple recap of each (see the trip recap item).
- Planning a new trip, Waypoint can draw on it naturally: "Last time you and Jordan were in Tokyo you both loved that ramen place near Shibuya, want to go back?"
- A standing group — the same set of companion faces from the facepile, recognized across trips — gets a shared, standing recommendation list that Waypoint's ranking quietly weighs the next time that group travels together.

## Key details

- Entirely opt-in and companion-scoped — nothing about one companion's trips with one person is visible to a different companion.
- Built directly on the collaborator identity already established (same person, same color, same face) — this is the payoff for presence work already shipped, not a new identity system.
- This is a genuine moat: the value compounds the longer a group of people uses Waypoint together, and it isn't something a competitor can shortcut without the trip history to back it.

~~~
Builds on `trip_collaborators`. A `travel_memories` derived table keyed by (userId, companionId) aggregating past confirmed nodes/ratings across shared trips, feeding as optional context into the ranking step (`common/rank.ts`) and the orchestrator's system prompt when the same companion set appears on a new trip. Companion identity/color already exists from the shared-board presence work — reuse it rather than re-deriving.
~~~
