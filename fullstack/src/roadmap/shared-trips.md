---
name: Shared Trips
type: roadmap
status: done
description: Invite the people you're traveling with onto the same live board, so everyone sees the plan build in real time.
effort: medium
requires: []
history:
  - date: 2026-07-16
    note: Shipped and verified. Owners invite companions via a tokenized link, delivered by copy-link, pre-filled email, or pre-filled text (no cold-send — the invite is minted server-side and claimed on sign-in, by token or by matching email). Companions land on the same live board and can plan and talk to Waypoint freely; everyone sees the plan build in real time over ~4s polling. Presence is per-person in identity colors — a facepile in the title bar, live avatar clusters on the board node someone is viewing, and attributed messages in conversation. Spending stays with the owner by default: only the owner, or a companion the owner promotes, can clear a confirm-gate; otherwise a companion's request becomes a pending action with a quiet "waiting for the owner" held state, never a hard block. Owner-only powers are managing people (promote/remove) and deleting the trip. Added a `collaborators` table, five methods (invite, claim, sync/presence, set-approval, remove-collaborator), a centralized access helper, and a concurrency guard on the shared board's projection.
---

A trip almost never belongs to one person alone. Waypoint was single-traveler by design for the MVP; this was the first crack in that wall, done carefully — and it held.

## What it looks like

- The trip owner invites a companion — copy a link, or send a pre-filled email or text. The companion taps in, signs in, and lands on the same board, live.
- Anyone can talk or type to plan; the board updates for everyone watching, the same way voice and chat already stay in sync for one person.
- Presence is visible everywhere: a facepile of who's on the trip, live cursors-of-attention on whatever board node someone's looking at, and every message in conversation attributed to its person, in their color.
- Only the owner (or a companion the owner promotes) can actually clear a confirm-gate — seeing the plan build is shared, spending money is not, by default. A companion's ask becomes a calm "waiting for the owner" state, not a wall.

## Key details

- A trip gains a `collaborators` list; every companion's `converse` calls append to the same one event log, same one board.
- Invites are tokenized and claimed on sign-in (by token or by matching email) rather than cold-sent, since the platform blocks that path.
- A companion without booking rights can still request things in conversation; requests become pending actions the owner approves or declines.
- Owner-only powers: promote/remove a companion, delete the trip.

~~~
Shipped: `trip_collaborators` table (`tripId`, `userId`, `role: 'owner'|'companion'`, `canApprove: boolean`), five methods (invite, claim, sync/presence, set-approval, remove-collaborator), a centralized access helper used by every trip-scoped method, claim-on-sign-in by token or email, and a concurrency guard on the shared board's projection so simultaneous writers can't desync it. Presence polls at ~4s alongside the existing board sync. The event-sourced model (`trip_events.actor`) absorbed multi-writer support additively, no rearchitecture needed.
~~~
