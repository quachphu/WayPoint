---
name: The Trip Recap
type: roadmap
status: planned
description: When a trip ends, Waypoint turns the whole event log into a beautiful, shareable recap — without being asked.
effort: small
requires: []
---

Every trip already has a complete, timestamped record of everything that happened, including the disruption it survived. That's a story, not just a log — Waypoint should tell it.

## What it looks like

- A day or two after a trip's last node completes, Waypoint sends a short recap: where you went, what you did, a couple of photos if any were shared in conversation, and, if there was one, the disruption it talked its way through.
- Presented as a clean, single-page shareable card — the kind of thing worth sending to the person you traveled with.
- If the trip had companions, they're credited by name and color right on the card — the same facepile identity from the live board, now telling the story together instead of just watching it build.
- Entirely generated from the trip's own event log; nothing new has to be tracked to build this.

## Key details

- Opt-in by default off/on toggle in profile preferences; never a surprise.
- On a shared trip, the recap goes to every companion, not just the owner — each gets the same card, framed as "your trip," not "the owner's trip."
- The disruption becomes a feature, not a footnote: "Your flight got delayed three hours. Waypoint called the airline and got you on an earlier one instead." is exactly the kind of line that sells the product to whoever reads it next.

~~~
A cron interface that finds trips with `status: 'complete'` and no recap sent, folds the `trip_events` log into a short generated summary (`generateText`), and renders it as a static shareable page. For shared trips, pull companion identity/color straight from `trip_collaborators` rather than re-deriving. Natural seed for referral growth if the recap is a public, brand-clean link.
~~~
