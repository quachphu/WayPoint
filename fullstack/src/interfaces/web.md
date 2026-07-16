---
name: Web Interface
description: The Waypoint web app — how voice, the live board, and chat coexist on one screen.
---

# Web Interface

Waypoint is one screen, not a set of pages. The board is the star; the conversation (voice and chat, unified) sits beside it; the confirm-gate, the call layer, and the detail panel appear over the board as the moment demands. It must feel like a beautifully restrained native app, on both desktop and mobile. All visual values (color, type, spacing, radius, motion, per-component treatments) come from `src/interfaces/@brand/`; this spec covers structure, behavior, and states.

~~~
Stack: Vite + React + React Flow (`@xyflow/react`) for the board. State in a single Zustand store hydrated once by `getBootstrap`, so navigation and node clicks are instant and rendered from memory (never a spinner for data already loaded). Mutations are optimistic where safe (a board click, opening a panel) and reconciled against `converse`/`approveAction` results. Live board updates arrive via the `stream()` contract in `src/orchestrator.md` and are applied as diffs to the live React Flow instance. Set the mobile-friendly viewport meta (no user scaling) and `defaultPreviewMode: "desktop"` (this is a desktop-first planning tool that also works beautifully on mobile).
~~~

## The signed-out welcome (the one splash moment)

Before sign-in, a calm branded welcome: the Waypoint mark, the Display-font line ("Where are we headed?" or a short brand statement), one plain sentence of what it is, and a single clear "Get started." No carousel, no feature grid, no marketing hero stack. This is the entry point into the experience and sets the tone; it should feel like an invitation, not a gate.

## The login and sign-up moment

Email-code auth, presented beautifully (see the platform auth guidance). Sign-in feels like being welcomed back; sign-up feels like joining something.

~~~
- Email entry → "Send code" → a clean transition (not a page reload) to the six-digit code step, with the address shown and a resend option on a cooldown timer.
- Code entry is six individual digit boxes: auto-advance, auto-submit on paste, large tap targets, inline immediate error states, a subtle success animation, and NO layout shift when the loading/success/error state resolves.
- Sign-up (first time an email is seen) adds a plainly worded call-consent checkbox ("Waypoint's AI assistant may call me about my bookings") and an optional display name; these write to the traveler profile. Consent is stored with a timestamp.
- Always allow canceling out of the flow (wrong email, wrong account).
- Dev bypass for demos: `remy@mindstudio.ai` / code `123456`.
- After verification, transition straight into the app shell (skeleton board if anything is still loading), never a blank screen.
~~~

## The app shell — desktop

Two fixed zones, board dominant. See the desktop shell wireframe in `src/interfaces/@brand/visual.md`.

- **Left: the Conversation column (~360-400px, fixed).** Voice and chat are one channel here. A scrolling message list (user turns right-aligned in an `--accent-tint` bubble; agent turns left, plain, streaming in; a small mic glyph marks voice-originated turns) sits above a fixed input bar containing the text field and the voice orb side by side. The orb is the persistent session element, present the whole time. White surface.
- **Right: the Board (fills remaining width).** A fixed trip-title bar on top (the trip name in Display 34px Bricolage, with meta beneath: "Mar 14-16 · 2 nights · 4 stops"), then the off-white dotted canvas. The detail panel docks over this zone's right edge; the call layer overlays this zone only, never the conversation column, so the traveler can keep talking or typing during a call.
- A collapse control on the conversation column lets the board go full-width for watching the plan build.

## The app shell — mobile

The board is the canvas; conversation is a sheet; the orb is always present.

~~~
- Board full-screen; chronology flips to top-to-bottom (React Flow layout direction), per `src/disruption.md`/board layout rules.
- A persistent voice orb floats center-bottom as an elevated control, the one element on screen the entire session.
- A conversation sheet pulls up from the bottom (drag handle, iOS-like physics) for chat, coexisting with voice; the board dims slightly behind it.
- Detail = bottom sheet (~85% height, drag-to-dismiss: past 40% or release velocity > 500px/s commits; otherwise spring back). Call layer = translucent bottom sheet (~72% height, board dimly visible above). Never stack all three: a live call supersedes an open detail sheet.
- Trip-title bar becomes a compact top bar with the trip name and a back/trips affordance.
~~~

## The front-door zero-state

Before a trip has any nodes, the board area is the front door (voice is the door): the greeting in Display ("Where are we headed?"), the subline ("Say it, or type it. I'll handle the logistics."), and the voice orb enlarged and centered, listening-ready. No carousel. The moment the first node fades in, the greeting recedes and the board takes over.

~~~
A traveler with existing trips lands on their most recent active trip, not the zero-state. A trips switcher (a light menu from the title bar) lists their trips; "New trip" returns to the front door. `empty-traveler` scenario shows the pure zero-state.
~~~

## The planning board

The signature surface. Full node/edge/working-indicator/detail-panel treatments are in `src/interfaces/@brand/visual.md`; the data model is in `src/app.md`. Behavior summary:

- Renders directly from the trip's derived `nodes`/`edges`. It is a view of that state, recomputed from the same fold as everything else, never a second data model kept in sync by hand.
- Reads chronologically (left-to-right desktop, top-to-bottom mobile). Nodes are not draggable. Pan and zoom (scroll/pinch) and selection are on. Branch only where the trip branches (parallel activities, alternate disruption routes).
- Nodes fade-and-settle in as they are proposed (the ≤200ms arrival moment), staggered when several arrive together; a new edge draws after its target node settles. Applied as diffs, never full re-renders.
- Status changes are color-only on the inset gauge, never layout. A rebooked node keeps its id and position.
- The camera gently pans (fitView with padding) only when a new node lands off-screen; it never recenters mid-read.
- Clicking a node opens the detail panel beside the board and reports focus context to the agent (one handler for board and any chat-embedded board).

## The conversation column

- One message store drives voice and chat. A voice utterance and a typed message are the same kind of message; the agent's spoken reply is the same streamed text shown here.
- Agent replies stream token-by-token with a subtle streaming edge; streaming never shifts layout (reserve line height, pin-to-bottom only when near the bottom). Use a streaming-markdown renderer so mid-stream markdown doesn't break.
- Optimistic send: the user's message appears instantly on send; a calm typing indicator appears in the agent's slot immediately, before the first token.
- The input bar: an auto-growing textarea (not a single-line input), a clear send affordance, and the voice orb. Disabled-with-spinner (fixed width, no resize) while a turn is streaming, with the orb reflecting listening/speaking state. Placeholder in Waypoint's voice, not "Type a message…".

## The voice experience

Voice is primary. The orb (idle/listening/speaking, treatment in `src/interfaces/@brand/visual.md`) is the always-present session element. Behavior:

~~~
- Voice is abstracted behind one client interface (`src/integrations.md`) so the UI is identical whether real Vocal Bridge or the browser Web Speech fallback backs it. Presence-state events drive the orb.
- Tapping the orb toggles listening. Captured speech becomes a user message (`source: 'voice'`) and calls `converse`; the streamed reply is spoken as it arrives and shown in the column simultaneously.
- The confirm-gate read-back: when a pending action is raised during a voice turn, Waypoint speaks the exact `summary` and the gate card appears. A spoken "yes"/"book it" resumes the gate (calls `approveAction`) AND visibly triggers the button's pressed state, so screen and voice agree. Transcript text alone never satisfies the gate.
- Graceful mic-permission handling: if denied or unsupported, fall back to text without breaking the layout, and tell the traveler plainly.
~~~

## The confirm-gate

The visual form of the code gate (`src/app.md`), treatment in `src/interfaces/@brand/visual.md`. It appears (scrim + elevated card, Heading accent) whenever a `pending_actions` row with a matching gate is raised, whether triggered by voice or chat. "Book it"/"Call the airline"/"Rebook this flight" approves (`approveAction`); "Not yet" declines (`declineAction`). The affirmative and decline are equal-weight. The button shows a fixed-width spinner while executing; on success the card dismisses and the affected node transitions in place. One gate at a time; if several are pending they queue.

**The gate only blocks someone who can act on it.** On a shared trip, the scrim-and-card gate is shown to approvers (the owner, and any promoted companion). A companion without approval rights is never trapped behind a scrim: instead the affected node shows a **quiet held badge** ("Waiting for [owner] to approve"), a matching line appears in the conversation, and they keep browsing freely. The held state is neutral, never Beacon (see `src/interfaces/@brand/visual.md`) — it reads as *paused, waiting on a human*, not *the system is working*. When the gate originated from a companion's request, the card (and the node's detail panel) carry a "Requested by [name]" chip. Approve and decline resolve for everyone at once, with the same node resolve animation playing on every screen.

## The live call panel

The translucent layer over the board during a disruption call (treatment in `src/interfaces/@brand/visual.md`). Driven by the `call_sessions` row and the `runCall` stream: status line (target + live timer + Beacon pulse), sub-status (what Waypoint is attempting), and the two-sided transcript streaming turn by turn with the first turn always the hardcoded disclosure. On call end it fades and gives way to the board as the node resolves. It also renders inline, anchored to the node, inside the detail panel (same component).

## The node detail panel

Opens beside the board (desktop) or as a bottom sheet (mobile), never a modal, no scrim (treatment in `src/interfaces/@brand/visual.md`). Shows the node's full detail: booking/offer specifics, cost, confirmation reference, a short "why this changed" history derived from the node's events, and actions ("Reschedule," "Call venue," "Cancel") that route through the confirm-gate. When a call is or was in progress for this node, the call panel renders inline here. Clicking a different node cross-fades the contents rather than reopening.

## Shared trips: people, presence, and live sync

Everything that makes a trip shared lives inside the existing shell — nothing gets its own page or a full-screen modal, because the whole point is to keep the board visible while you manage people and watch them plan.

- **Facepile + Share in the title bar.** Right of the trip name, left of the trips menu: a solo trip shows a single "Share" pill; a shared trip shows the collaborator facepile with a trailing `+` ghost circle. Clicking either opens the People panel.
- **The People panel** opens in the same docked slot the node-detail panel uses (right on desktop, bottom sheet on mobile), cross-fading with whatever was there — the board stays visible behind it. One column, two zones: an **invite composer** on top (a reassuring lede — "Bring someone onto this trip. They can see the board and suggest ideas, only approvers can book." — an email field with a Heading-filled "Invite" button, and under a divider two equal ghost buttons, "Copy link" and "Text invite"), over a **roster** below (each member: avatar, name, a role/approval tag, a presence subline like "Looking at Sunset Villa" or "Active 4m ago", and, for the owner only, a `⋯` menu to promote/remove). Outstanding invites show as neutral rows ("Invited, not joined yet") with resend/revoke.

~~~
- Invite delivery is the owner's own channel (platform can't cold-send): "Copy link" swaps to "Copied ✓" with reserved width (no reflow) and reverts after ~1.6s; "Text invite" / the email button build `sms:`/`mailto:` payloads from the invite path resolved against `window.location.origin`. See `createInvite` in `src/app.md`.
- Promote confirmation is Heading-tinted ("Jordan can now approve bookings"), not the person's color — promotion is granting a power, a Heading concept.
- The panel header is Headline (system 500), NOT Bricolage. Keep the Display face reserved for the trip name and front door.
~~~

- **Presence on the board.** When another member is looking at a node, a small cluster of their presence-color mini-avatars pins to that node's top-right (treatment and coexistence-with-working rules in `src/interfaces/@brand/visual.md`). Someone on the board but not on a specific node shows in the roster as "On the board" and places no node marker. Presence fades on a 10s grace window so a dropped poll never strobes it.
- **Attributed conversation.** Messages from other members render left-aligned with a 16px presence-color avatar and their name in their color; the body stays Ink. Your own turns and Waypoint's are unchanged.
- **Live sync.** While a trip is open and the tab is focused, the store polls `syncTrip` (~4s) with the last-seen `version` and the node currently in focus. The poll writes the caller's presence and, only when `version` advanced, applies the fresh bundle as a store update (board diffs in place, no full re-render, no camera jump). Polling pauses when the tab is hidden and resumes on focus. This is how a companion's booking request, an owner's approval, and everyone's presence all appear on every screen within a few seconds without websockets.

~~~
Claiming: a visitor who follows an invite link (`/join/{token}`) is routed to sign-in if needed, then `claimInvite` attaches them and drops them on the shared trip. Already-signed-in visitors claim immediately. `getBootstrap` also claims any invite matching the signed-in email, so following the link is not strictly required. After claiming, the URL is cleaned.
~~~

## Data, performance, and errors

~~~
- `getBootstrap` hydrates the store once: traveler, trips, active trip's nodes/edges, messages, pending actions, active call. Everything renders from memory after that.
- Board/board-diff updates come from the `converse`/`runCall` streams and are applied to the store + live React Flow instance. `version` reconciliation: if a diff looks out of order, re-pull `getTrip`.
- Optimistic UI for local interactions (selecting a node, opening a panel, sending a message). Server-truth for anything that mutates trip state.
- Loading uses skeletons that mirror the layout (board canvas with a couple of ghost nodes, conversation with ghost bubbles), never a blank page or a centered spinner.
- Errors surface as calm toasts/inline messages in Waypoint's voice ("I couldn't reach the airline just now. Want me to keep trying?"), never raw error codes. Uncaught errors are auto-reported by the platform; caught errors get a human message and a console.error for the logs.
- Dark mode: a token swap (`data-theme`), respected from system preference with a manual toggle available. Reduced-motion honored throughout.
~~~
