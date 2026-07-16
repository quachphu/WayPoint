---
name: The Multi-City Architect
type: roadmap
status: planned
description: Plan a real multi-city trip — three countries, six legs, shifting logic — and watch the board branch and reflow to match.
effort: large
requires: []
---

The board was built to branch. This is where that pays off: trips that aren't a single line, planned in one conversation.

## What it looks like

- "Two weeks, Tokyo then Seoul then back" produces a board that actually reads as three chapters, not one long undifferentiated chain.
- Ask to compare routes ("is it better to fly Tokyo to Seoul or take the ferry") and the board shows both as parallel branches side by side until one is chosen, exactly the way disruption alternatives already do.
- Real routing and walking/transit times between activities on the same day, not estimated durations — this is where the "roadmap item" real Places/Directions integration (noted in the integrations spec) lands.
- Rebalancing a multi-city trip ("actually let's cut Seoul to two nights") cascades cleanly: the forward-walk from the changed node recomputes only what's downstream, exactly as disruption handling already does.

## Key details

- Board layout rules extend to city "chapters" — a subtle chapter divider on the canvas, not a new visual language.
- Group of nodes per city can collapse to a single summary node when zoomed out, expand on click, so a 20-node trip doesn't overwhelm the canvas.
- Everything here reuses the existing DAG model and topological validation; this is about scale and real-world routing data, not a new data model.

~~~
Adds real Places/Directions data (no key currently supplied; this is the trigger to provision one) to replace the current AI-web-search activity suggestions with actual walk/transit times for edge labels. Board: a "chapter" grouping concept in the React Flow layout pass, collapsible groups via React Flow's built-in group nodes. The DAG and event-sourcing model need no changes, only more nodes/edges per trip and a layout algorithm that chunks by destination.
~~~
