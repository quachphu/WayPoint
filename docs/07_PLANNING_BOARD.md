# The planning board

This is the signature feature. Everything else in this product can look like a competent travel app; this is the piece that shows a judge, a user, or anyone watching over a shoulder that a real agent is doing real work, not a chatbot printing text. It's also the direct descendant of your own sketch: the boxes-and-arrows flow you drew (agent → sub-agents → a chain of decisions → a confirm step) is exactly the visual language this board uses, just applied to the actual end-user surface instead of an internal architecture diagram.

## 1. Concept, in one paragraph

The trip is never shown as a plain list. It's a live board: each stop or leg is a node, each connection between them (a flight, a drive, a walk) is a labeled edge, and the whole thing builds in real time while the agent is talking, not after. Nodes appear as decisions are made, change color as their status changes, and show a small transient indicator while the agent is actively working on them. Clicking any node opens its full detail without leaving the board, and that click is not just a UI event, it's also told to the voice agent, so the conversation and the visual selection are one shared context, not two systems that happen to share a screen.

## 2. Why a graph board, not a map or a plain timeline

A literal map is geography-first, and geography isn't what makes a trip easy to follow. A single-city trip collapses into an unreadable cluster of pins; a multi-city trip spreads out in ways that hide the actual order of events. A plain vertical timeline (list of cards top to bottom) is closer, but can't represent branching, parallel options during planning, or alternate routes during a disruption, and has no natural home for showing the agent visibly at work on one specific piece of the plan. A node-and-edge board does both: it reads left-to-right (or top-to-bottom on narrow screens) in chronological order like a timeline, but can branch, and gives every node a place to show its own live status. The map still exists, one tap away, for when actual geography genuinely matters (e.g. "how far is this hotel from that museum").

## 3. Layout rules

- Primary flow reads chronologically, left to right on wide screens, top to bottom on narrow ones. This is a deliberate choice against a force-directed or freeform graph layout: comprehensibility for someone glancing at the screen mid-conversation matters more than an elegant automatic layout.
- Branch only where the trip actually branches: parallel activity options on the same day, or alternate routes being compared during a disruption. A single-path trip is a single flowing line.
- Each node carries a small place label/icon as a geographic hint without committing to real coordinates. Tapping through to the full map view is always one action away.

## 4. Node anatomy

- Kind icon: flight, hotel, activity, or ground transport, using the icon language from `docs/05_DESIGN_SYSTEM.md`
- Title and time
- A left accent bar communicating status at a glance, using the exact color tokens already defined: gray = proposed, `--accent` = confirmed, `--accent-voice` = disrupted or actively being worked on, `--danger` = failed and needs attention
- A transient "agent is working on this" indicator: appears only while a tool call affecting this specific node is in flight (re-shopping during a disruption, searching for the first flight option), and disappears the moment it resolves. This is the direct nod to your sketch's agent/sub-agent boxes, a visible trace of the agent's process, scoped to the one node it's actually working on, rather than a permanent architecture diagram cluttering the trip view.

## 5. Edge anatomy

Labeled with mode and duration ("1h 15m flight," "20 min drive"). An edge redraws (not just repositions, actually re-renders with a brief transition) when the sequence changes, e.g. a rebooking that changes which flight connects to which hotel stay.

## 6. Detail panel (the click-to-expand behavior you asked for)

Clicking a node opens a panel adjacent to the board, not a full-screen modal, so the board itself stays visible and in context (this is the Deference principle from `docs/05_DESIGN_SYSTEM.md` §1 applied directly: the board is the content, the panel serves it, not the other way around). The panel shows everything about that node: full booking details, cost, confirmation reference, and, when relevant, the specific history that led to its current state, including an inline live call transcript if a disruption call is or was in progress for this node (reusing the live call panel component from `docs/05_DESIGN_SYSTEM.md` §3.4, anchored to the node rather than floating globally).

## 7. The technical mechanism, concretely

### 7.1 Rendering

Use **React Flow** (`@xyflow/react`). This is the standard library for exactly this brief, interactive, draggable, clickable nodes and edges with custom node components, built-in pan/zoom, and animated transitions, rather than hand-rolling SVG positioning and hit-testing.

### 7.2 Data source

The board renders directly from the `TripNode` DAG and the `TripEventLog`, already specified in `docs/02_ARCHITECTURE.md` §3.1-3.2. It is a view of that data, not a second data model that has to be kept in sync by hand. Every time a `TripEvent` lands and the derived trip state changes, the board's node/edge set is recomputed from the same fold that produces canonical state everywhere else in the app.

### 7.3 Live updates: Vocal Bridge Client Actions, confirmed bidirectional

Vocal Bridge's own documentation confirms the exact mechanism needed here, and it runs both directions on the same data channel that carries the voice conversation:

**Agent → board** (the backend pushes a graph diff every time trip state changes):

```javascript
vb.on('agentAction', ({ action, payload }) => {
  if (action === 'board_update') {
    applyGraphDiff(payload); // { added: [...], updated: [...], removed: [...] }
    // apply as a diff against the existing React Flow instance, not a full
    // re-render, so nodes animate into their new state instead of popping
  }
});
```

**Board → agent** (a click tells the voice agent what the user is looking at, this is the part that makes the click-to-detail interaction feel like one system instead of two):

```javascript
// user clicked a node on the board
await vb.sendAction('board_node_selected', {
  node_id: node.id,
  kind: node.kind,
  status: node.status,
});
// the agent now has this in context — if the user follows up with
// "why did this change," it already knows which node "this" refers to
```

Configure both actions (name, description, direction) via the agent's client-actions configuration (`vb config set --client-actions-file actions.json`, or the equivalent dashboard UI), following the same pattern documented for Vocal Bridge's own `show_product` / `navigate` examples, adapted to this app's node/trip vocabulary instead.

### 7.4 Chat parity

Chat and voice share one orchestrator entry point (`docs/02_ARCHITECTURE.md` §2), so if the board is also rendered inside the chat surface (recommended, since it reinforces "one shared trip state, two channels"), a click there fires the identical event, not a parallel implementation. There should be exactly one `board_node_selected` handler in the codebase, not one per surface.

## 8. Worked example, start to finish

1. User: "Plan a weekend in San Francisco." Board is empty. A transient "searching flights" indicator appears at the top of the board before any node exists yet.
2. First flight offer decided → a node fades in (proposed state) per the motion tokens in `docs/05_DESIGN_SYSTEM.md` §2.5.
3. Hotel decided → a second node appears, connected by a labeled edge.
4. User confirms the full itinerary → both nodes transition proposed → confirmed (accent bar color change only, no layout jump, this matters for not breaking the user's mental map of the board mid-conversation).
5. Later: "My flight got delayed." The flight node transitions confirmed → disrupted (`--accent-voice`, gentle pulse), and its transient working-indicator reappears while the disruption agent re-shops and places the outbound call.
6. User clicks that node during the call: the detail panel opens showing the live transcript inline, and `board_node_selected` tells the agent the user is watching this specific node, so if they interrupt with "wait, what about the hotel," the agent already has the right node in context rather than needing it re-explained.
7. Call resolves, user confirms the new flight → the node updates in place (same node id, new details) and transitions back to confirmed.

## 9. What this replaces

This supersedes the plain vertical-timeline description originally sketched in `docs/05_DESIGN_SYSTEM.md` §3.2 and the brief mention in `docs/02_ARCHITECTURE.md` §6, both now point here as the authoritative spec for this component. Everything else in those two documents (tokens, the rest of the component set, the underlying data model) still applies unchanged, this document is additive detail on the one component that deserved much more depth than a single subsection.
