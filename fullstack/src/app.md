---
name: Waypoint
description: A voice-first AI travel companion that plans, books, and handles disruptions, rendering the whole trip as a live board.
---

![Waypoint](https://i.mscdn.ai/images/a47f3f3a-a1fa-41ca-8de3-e415452b4611_1739379254036.png)

# Waypoint

Waypoint is a voice-first AI travel companion. You talk to it the way you'd talk to a friend who's good at logistics ("plan me a weekend in San Francisco," "we just landed, find us ramen," "my flight got delayed, figure it out"), and it plans, books, and, when something breaks, handles it and reports back. The plan is never described in a paragraph. It renders as a live, connected board of the whole trip that builds node by node while the agent talks and expands into full detail wherever you click. Chat sits alongside voice as an equal, always-in-sync channel. **Voice is the front door.**

~~~
This app is built natively on the platform: TypeScript backend methods, a managed database, and a React web interface. It faithfully reproduces the behaviors the original spec package attributes to a Python/LangGraph/Temporal/FastAPI stack, implemented natively here:
- the confirm-gate as CODE (not a prompt), via a pending-action state machine that booking/calling methods physically cannot bypass;
- trip state as an event-sourced append-only log, with current state derived as a fold;
- resumable, gate-then-approve orchestration.

The real integrations use credentials the user supplied (stored as encrypted secrets, never in code): Sabre (real flight/hotel search against the certification environment) and Vocal Bridge (attempted as the primary voice channel). See `src/integrations.md`.
~~~

The three moments that define "done" are documented as the MVP roadmap item and drive the whole build: **plan a trip and watch the board build live**, **survive a disruption with a real outbound call and a confirm-gated rebooking**, and **the same trip state reflected in chat and voice in real time**.

## Who uses it

A single kind of user: the **traveler**. Everyone who signs in is a traveler, and every traveler can plan their own trips. What changed with Shared Trips is that a trip is no longer private to one person: a traveler can invite the people they're travelling with onto the same live board, so a trip now has an **owner** (the traveler who created it) and any number of **companions** (travellers invited onto it). Owner and companion are per-trip standing, not global roles: you might own the Portugal trip and be a companion on your sister's wedding-weekend trip at the same time. A traveler sees exactly the trips they own or have been invited onto, and nothing else.

~~~
Auth is enabled with email-code sign-in (see `src/integrations.md` for why email over SMS here). There are still no RBAC roles in the manifest — owner/companion is not a platform role, it is standing recorded per trip on the collaborators table (see "Shared trips" below). The users table is the auth table and doubles as the traveler profile.

For live demoing, the platform dev bypass applies: signing in as `remy@mindstudio.ai` accepts code `123456`.
~~~

### The front door and the login moment

Signed out, the traveler lands on a calm, branded welcome (the one splash moment the app allows itself) that communicates what Waypoint is and invites them in. Sign-in is email-code, presented as a polished moment, not a wall. Sign-up captures one extra thing beyond email: **call consent** (see below). Once authenticated, the traveler lands at the front-door zero-state ("Where are we headed?") with the voice orb ready. The full screen design lives in `src/interfaces/web.md`.

## The traveler profile

Beyond the platform-managed email and roles, a traveler record carries a display name, an optional phone number, and their travel preferences in plain terms (window vs aisle, nonstop preference, hotel style, home airport). Preferences gently inform the agent's ranking but never override an explicit request.

~~~
The `users` table (auth table). Platform-managed columns: `email`, `roles`. App columns (all optional until onboarding fills them, per platform auth rules): `displayName` (string), `phone` (string, E.164), `homeAirport` (string, IATA), `preferences` (JSON: `{ seat?: 'window'|'aisle', nonstopPreferred?: boolean, hotelStyle?: string, notes?: string }`), `callConsent` (boolean), `callConsentAt` (number, unix ms).
~~~

### Call consent (TCPA)

At sign-up, a real, plainly worded checkbox captures consent for Waypoint's AI assistant to call the traveler about their bookings. This is stored as a boolean plus a timestamp on the traveler record.

~~~
This is the compliance flag from the security spec. In the core release the flagship disruption call is placed to a business (a simulated airline/hotel desk), not to the traveler, so this flag does not gate the demo. It is captured from the start anyway because it is cheap to build in and expensive to retrofit, and because the "agent calls the traveler" pattern is a near-term roadmap item that will check it. Every call, regardless of target, is written to an auditable call log with its hardcoded disclosure line and consent basis. See `src/disruption.md`.
~~~

## A trip is a graph, not a list

A trip is modeled as a directed acyclic graph. **Nodes** are bookable or plannable events (a flight leg, a hotel stay, an activity, a ground-transport hop). **Edges** connect them in order and carry the mode and duration between them (a flight, a drive, a walk). This is a deliberate choice: it reads chronologically like a timeline for someone glancing mid-conversation, but it can branch (parallel activity options, or alternate routes being compared during a disruption), and every node has a natural place to show its own live status. A topological read validates the plan for free (an activity can't be scheduled before the flight that lands you there), and when a disruption invalidates one node, walking forward from it identifies exactly which downstream nodes need recomputing, so a delayed outbound flight doesn't force a re-plan of an unaffected hotel stay.

~~~
A node (stored as JSON in the trip's `nodes` array):
- `id` (string), `kind` ('flight' | 'hotel' | 'activity' | 'ground')
- `title` (string, e.g. "SFO to LAX"), `subtitle` (string, e.g. "Delta 2272" or "Fisherman's Wharf")
- `start` (number, unix ms | null), `end` (number, unix ms | null)
- `location` (string: IATA code or a place label)
- `status` ('proposed' | 'confirmed' | 'disrupted' | 'failed' | 'cancelled')
- `working` (boolean: transient "agent is working on this" flag, true only while a tool call affecting this node is in flight)
- `bookingRef` (string | null: Sabre PNR / confirmation id once booked)
- `costCents` (number | null)
- `dependsOn` (string[]: ids of nodes that must complete first)
- `detail` (JSON: the full offer/booking detail for the panel, e.g. fare breakdown, address, cancellation terms, source: 'sabre' | 'simulated')

An edge (stored as JSON in the trip's `edges` array):
- `id` (string), `from` (node id), `to` (node id)
- `mode` ('flight' | 'drive' | 'walk' | 'transit')
- `label` (string, e.g. "1h 15m flight", "20 min drive")
- `state` ('default' | 'working': the edge whose downstream node is being worked goes Beacon with a marching dash)

`status` and `working` are distinct on purpose: a node can be `confirmed` AND `working` (being re-shopped during a disruption). The board renders the Beacon/working treatment whenever `working` is true or `status` is `disrupted`.
~~~

## Event sourcing: one log, state as a fold

Every state-changing action is recorded as an immutable, timestamped, append-only **trip event**. The trip's current node/edge set is derived as a fold over that log. This gives a complete audit trail (so "why did my flight change" has a real answer), replayable history for debugging any flow after the fact, and conflict handling by ordering rather than merge logic, which is the right model here because the product's real concurrency problem is "voice said one thing and a board click did another, which happened and in what order," not simultaneous edits to the same field.

~~~
Two tables carry this:

`trip_events` (the source of truth, append-only):
- `tripId` (string), `actor` (string: user id, or "agent:planner" / "agent:disruption" / "system")
- `kind` (string: 'trip_created' | 'node_proposed' | 'node_confirmed' | 'node_updated' | 'node_disrupted' | 'node_working_started' | 'node_working_ended' | 'node_cancelled' | 'edge_added' | 'edge_updated' | 'edge_removed' | 'delay_reported' | 'call_started' | 'call_ended' | 'rebooked')
- `payload` (JSON: the data for this event, e.g. the full node object for `node_proposed`)
- `causedBy` (string | null: the id of a prior event, for causal chains, e.g. a `rebooked` event caused by a `call_ended`)
- (system columns `id`, `created_at` provide identity and ordering)

`trips` (the materialized projection + metadata; a pure fold of the log, cached for fast board reads):
- `userId` (string, owner), `title` (string, e.g. "Weekend in San Francisco"), `destination` (string)
- `startDate` (number | null), `endDate` (number | null)
- `status` ('planning' | 'confirmed' | 'disrupted' | 'complete')
- `nodes` (JSON array), `edges` (JSON array): the derived board state
- `version` (number: bumped on every re-fold, for optimistic-concurrency race detection)

**The derivation is a pure function** `deriveTripState(events) -> { nodes, edges }`, in `common/`. Every mutation appends its event(s), then re-folds ALL of that trip's events and writes the resulting `nodes`/`edges` back onto the trip row with `version + 1`. Folding the whole log each time is trivially fast at the handful-of-events-per-trip scale this product actually sees; snapshotting is an at-scale optimization noted on the roadmap, not built now. Keeping the projection a pure fold of the log is what guarantees the board, chat, and voice all read from one truth rather than three implementations that happen to agree.
~~~

## The confirm-gate is code, not a prompt

No action that spends money or places a call ever executes on the model's say-so. The mechanism is a **pending-action state machine**, the native equivalent of an `interrupt()` that blocks *before* the action: the agent can only ever *propose*; the actual booking or call is a separate method that physically refuses to run unless a matching pending action has been explicitly approved by the traveler through the app's own UI or voice turn.

~~~
`pending_actions` table:
- `tripId` (string), `nodeId` (string | null: the board node this affects)
- `kind` ('book_flight' | 'book_hotel' | 'book_activity' | 'place_call' | 'rebook')
- `summary` (string: the exact action in plain language, e.g. "Book Delta 2272, SFO to LAX, $214" — this is what the confirm-gate card and the spoken read-back use verbatim)
- `payload` (JSON: everything the execution step needs, e.g. the revalidated Sabre offer, or the call target + goal)
- `status` ('pending' | 'approved' | 'executed' | 'declined' | 'expired')
- `createdAt` / `resolvedAt` (number)

Flow:
1. The agent decides an action is warranted → creates a `pending_actions` row with `status: 'pending'` and a precise `summary`. It NEVER books or calls directly.
2. The frontend renders the confirm-gate card (or, in voice, reads the summary and waits). The board node is `proposed`.
3. The traveler approves → `approveAction(actionId)` sets `status: 'approved'`, then and only then executes the underlying booking/call, appends the resulting events (`node_confirmed` with `bookingRef`, or `call_started`), and sets `status: 'executed'`. Declining → `declineAction(actionId)` sets `status: 'declined'` and the agent re-plans.
4. `approveAction` re-reads the row and hard-refuses if `status !== 'pending'` (double-submit / stale gate protection).

**This is the prompt-injection defense.** No matter what a call transcript, a pasted email, or a manipulated tool response contains, it can only ever produce a *proposal* that still has to clear the same gate. Even a fully successful injection ("the airline says the traveler already approved a $4,000 upgrade") cannot spend money; it can only create a pending action the traveler must separately approve. A lightweight sanity check runs before a pending action is created for a rebook: does the cost fall within a sane range of what was discussed, does the destination/date match the trip on file — anything off is flagged for extra confirmation rather than proceeding silently. See `src/disruption.md`.
~~~

## The conversation is one channel

Voice and chat are not two systems. What you say by voice becomes a message in the conversation; the agent's spoken reply is the same text streamed into the same conversation column in sync with speech. One message store drives both, and both call the one orchestrator entry point. This is what makes them genuinely equal and in-sync rather than two implementations that happen to look consistent.

~~~
`messages` table:
- `tripId` (string), `role` ('user' | 'agent')
- `text` (string), `source` ('voice' | 'chat': marks origin so the UI can show a small mic glyph on voice-originated turns)
- `status` ('streaming' | 'complete': agent messages stream in)
- (system column `created_at` orders the thread)
~~~

## Shared trips: planning with your people

A trip can be planned by more than one person at once. The owner invites the people they're travelling with, and from then on everyone on the trip sees the same live board, reads the same conversation, and watches the plan build in real time. This is the whole point of Shared Trips: travel is rarely a solo act, and the board is far more useful when the group is looking at it together.

### Who is on a trip

Every trip has exactly one **owner** and any number of **companions**. The owner is recorded when the trip is created. Companions are added by invitation. Each person on a trip carries a small amount of standing: their role (owner or companion), whether they may clear a confirm-gate, an assigned [presence colour]{A stable per-person colour drawn from a fixed six-colour palette, assigned in join order (owner is index 0) and stored on the membership row so every viewer sees the same colour for the same person. Palette and rationale live in `src/interfaces/@brand/visual.md`.}, and a lightweight heartbeat of when they were last active and which board node they were looking at.

~~~
New table `trip_collaborators` (one row per person-on-a-trip, plus one row per outstanding invite):
- `tripId` (string)
- `userId` (string | null: the traveler's user id once they've claimed their spot; null while an invite is still outstanding)
- `email` (string: the address the invite was sent to / the member's email, stored lowercased+trimmed for matching)
- `role` ('owner' | 'companion')
- `canApprove` (boolean: may this person clear a confirm-gate? owner is always true; companions default false until the owner promotes them)
- `presenceColor` (string: hex from the fixed palette, assigned on join)
- `status` ('invited' | 'active': 'invited' until the person claims their spot, then 'active')
- `invitedByName` (string | null: display name of whoever sent the invite, for the invite UI and email)
- `inviteToken` (string | null: an unguessable token minted per invite; the shareable link carries it so a companion can claim even if they sign in with a different email than was invited)
- `focusNodeId` (string | null: the board node this person is currently looking at, or null for "on the board, no specific node")
- `lastSeenAt` (number | null: unix ms of this person's most recent activity, updated on every sync poll)

The owner's own row is created with `role: 'owner'`, `canApprove: true`, `status: 'active'` at trip creation.
~~~

### Inviting someone

The owner invites a companion by email. Because the platform will not let an app cold-email or cold-text a stranger (an anti-spam rule that also protects deliverability), Waypoint does not send the invite from a no-reply address itself. Instead it **mints** the invite and hands the owner three ways to deliver it personally: copy a link, open a pre-filled email in their own mail app, or open a pre-filled text on their phone. Every invite carries an unguessable token embedded in the link.

~~~
`createInvite({ tripId, email })` (owner-or-companion may invite; only the owner manages people once they're on) validates access, lowercases+trims the email, and upserts a `trip_collaborators` row with `role: 'companion'`, `status: 'invited'`, `canApprove: false`, a freshly minted `inviteToken`, and `invitedByName` set to the caller's display name. It returns the row plus a ready-to-use invite path (`/join/{inviteToken}`) that the frontend resolves against `window.location.origin` to build copy-link, `mailto:`, and `sms:` payloads. Re-inviting the same email is idempotent (returns the existing row / token rather than duplicating). The backend never calls `sendEmail`/`sendSMS` for invites — delivery is the owner's own channel, which is more reliable and lands better than app-sent mail.
~~~

### Claiming a spot

A companion lands on the invite link, signs in (or is already signed in), and is attached to the trip. Claiming works two ways, so an invite still resolves even when someone signs in with a different address than they were invited at: by **token** (the link they followed) and, as a fallback, by **email match** (any outstanding invite addressed to the email they signed in with).

~~~
`claimInvite({ inviteToken })` attaches the current user to the matching invited row: sets `userId`, flips `status` to 'active', assigns the next `presenceColor`, and returns the trip bundle. Separately, `getBootstrap` performs email-match claiming on every load: any `trip_collaborators` row with a null `userId` whose lowercased `email` equals the current user's email is claimed to that user. Email matching is always lowercased+trimmed on both write and read so `Jordan@x.com` and `jordan@x.com` are the same person. The existing demo-trip claim-on-first-open affordance is preserved and now also creates the owner collaborator row for claimed demo trips.
~~~

### What everyone can and can't do

Companions are full planning partners. Anyone on the trip — owner or companion — can talk or type to Waypoint, shape the board, and invite more people. The distinctions are deliberately narrow and both live with the owner: **only the owner manages people** (promote a companion to approve, or remove someone), and **only the owner can delete the trip**. Everything else is shared.

~~~
Access is enforced in one place. A shared helper `assertTripAccess(tripId, userId)` replaces the scattered `trip.userId !== userId` checks in `getTrip`, `converse`, `reportDisruption`, `runCall`, `approveAction`, and `declineAction`. It returns `{ trip, collaborator, isOwner, canApprove }` and throws the same "Trip not found." error when the user is neither owner nor an active collaborator (so a stranger can't even probe existence). Owner-only mutations (promote, remove, delete) additionally assert `isOwner`.
~~~

### Spending stays with the owner (with a switch)

By default, only the owner can clear a confirm-gate — that is, actually spend money or place a call. A companion can *ask* for anything ("book the harbour hotel instead"), and that becomes a pending action exactly as it would for the owner, but the companion sees a calm **"waiting for [owner] to approve"** state rather than an approve button. The owner can promote a trusted companion so they can approve too. This keeps the group free to plan together without making everyone a spender.

~~~
`approveAction` gains a `canApprove` gate on top of the existing pending-state gate: the caller must be the owner or a promoted companion, else it throws. A companion without approval rights who says "yes" to an open gate in conversation is **not** silently ignored — the orchestrator/store responds honestly ("I'll flag that for [owner] to confirm") and the pending action simply stays open for an approver. Promotion is `setApproval({ tripId, collaboratorId, canApprove })` (owner-only). Removal is `removeCollaborator({ tripId, collaboratorId })` (owner-only). Both are folded into the collaborators management surface.

When a pending action originates from a companion, the creating turn stamps `requestedBy` (the companion's user id + display name + colour) onto the pending action's payload and the resulting node's detail, so the board node, its detail panel, and the gate all show a "Requested by [name]" chip. The origin is never lost.
~~~

### Live, without websockets

The platform has no realtime socket, so shared presence and live board sync are done by polling. While a trip is open and the tab is focused, the frontend polls a single lightweight method every few seconds. That one call does three things at once: it records the caller's own presence (which node they're looking at, and that they're active now), it returns the fresh trip bundle **only if the trip actually changed** since the caller last saw it, and it returns everyone else's recent presence for the "[name] is looking at the hotel" markers.

~~~
`syncTrip({ tripId, sinceVersion, focusNodeId })` — the poll. It (1) upserts the caller's presence (`focusNodeId`, `lastSeenAt = now`) on their collaborator row; (2) reads the trip's current `version` and, if it is greater than `sinceVersion`, returns the full fresh bundle (trip, messages, pending actions, active call), else returns `{ changed: false }`; (3) always returns the roster with each member's `presenceColor`, `role`, `canApprove`, `status`, and presence (`focusNodeId`, `lastSeenAt`). "Active" for presence display is `lastSeenAt` within a 10-second window, evaluated on the client so a single dropped poll doesn't strobe a marker off. Folding presence into the version-poll is deliberate — it is one upsert per poll, not a fan-out, so the shared call stays cheap. Poll cadence ~4s; the client pauses polling when the tab is hidden.
~~~

### A note on concurrent edits

With more than one person able to talk to Waypoint on the same trip, two turns can now land at nearly the same moment. The event log is the safety net: because every board state is a pure fold of an append-only log, two people's events simply interleave by timestamp and the board is always the honest sum of everything that happened. The one place that needs care is the cached projection write.

~~~
Hardening the fold against a concurrent-write race (flagged in architecture review): the re-fold step writes `nodes`/`edges`/`version` conditionally on the version it read (`update ... where version = @expected`), and on a mismatch re-reads and re-folds from the current log before writing again (a short bounded retry). This prevents a slower turn from clobbering a fresher projection while never losing an event's effect, since the log itself is the source of truth and the fold is pure. Events themselves always append safely; only the derived cache needs the guard.
~~~

## The outbound call, its transcript, and the audit log

When Waypoint places a call during a disruption, the call is a first-class, audited record: who it was to, the hardcoded disclosure line it opened with, the goal, the full two-sided transcript streamed turn by turn, the outcome, and the consent basis. The full flow is specified in `src/disruption.md`.

~~~
`call_sessions` table:
- `tripId` (string), `nodeId` (string: the board node this call is about)
- `target` (string, e.g. "Hotel Zephyr front desk"), `goal` (string, e.g. "Rebook the delayed SFO to LAX leg")
- `disclosureLine` (string: the exact hardcoded disclosure spoken first, stored verbatim for audit)
- `status` ('dialing' | 'connected' | 'in_progress' | 'ended' | 'failed')
- `subStatus` (string: live "what the agent is attempting", e.g. "Asking about the next available flight")
- `transcript` (JSON array of turns: `{ speaker: 'waypoint' | 'venue', text: string, at: number }`)
- `outcome` (string | null: plain-language result), `consentBasis` (string: e.g. "Simulated call — no real third party contacted")
- `startedAt` / `endedAt` (number)

This table IS the call audit log the compliance spec requires: every call, its disclosure, and its consent basis are permanently recorded.
~~~

## The backend, in one place

The methods that make up the backend, grouped by area. Their detailed behavior lives in the flow specs.

- **Bootstrap & trips** — `getBootstrap` (loads the current traveler, the trips they own or are a companion on, and the active trip's full state — messages, nodes/edges, pending actions, active call, and the collaborator roster — in one call for an instant-feeling store; also claims any invites matching the traveler's email), `createTrip` (also creates the owner collaborator row), `listTrips`, `getTrip`, `updateProfile` (name, phone, preferences, call consent).
- **The orchestrator** — `converse` (the single entry point for both voice and chat; see `src/orchestrator.md`). Streams status and reply tokens; mutates trip state; may create pending actions, stamped with `requestedBy` when a companion is the one asking.
- **The gate** — `approveAction`, `declineAction` (see the confirm-gate section; these are the only paths to a real booking or call, and now also enforce approval rights).
- **Shared trips** — `createInvite` (mint an invite + return a shareable path), `claimInvite` (attach the current user to a trip by token), `syncTrip` (the presence-and-version poll that keeps the board live for everyone), `setApproval` (owner promotes/demotes a companion's approval rights), `removeCollaborator` (owner removes someone).
- **Planning** — internal Sabre-backed search/propose helpers invoked by the orchestrator (see `src/planning.md`).
- **Disruption** — `reportDisruption` and `runCall` (the flagship; see `src/disruption.md`), plus `simulateDelay`, a demo affordance that injects a realistic delay so the disruption flow can be shown on demand.

~~~
All money/booking/call side effects live behind `approveAction`. The orchestrator and planning helpers are read-and-propose only. This separation is the confirm-gate, enforced structurally.
~~~

## Scenarios

The app ships with seed scenarios so the traveler (and QA) can experience it populated, empty, and mid-disruption without having to talk it into each state first. These are detailed alongside the flows they exercise.

~~~
Scenarios to build (all seed a single traveler and impersonate them):
- **weekend-planned** — a fully planned, confirmed "Weekend in San Francisco": round-trip flights, a hotel, two activities, all `confirmed`, with a realistic conversation history. The default first impression.
- **mid-disruption** — the same trip, but the outbound flight is `disrupted` with a delay reported and the agent mid-re-shop, so the flagship flow can be entered immediately.
- **empty-traveler** — a signed-in traveler with no trips, to show the front-door zero-state.
- **fresh-plan** — a trip with a couple of `proposed` nodes and a pending booking action, to show the confirm-gate.

Scenario image assets (any hotel/activity imagery) should be generated by the design expert to fit the aesthetic rather than pulled from stock. Profile photos are left empty to fall back to icon placeholders.
~~~
