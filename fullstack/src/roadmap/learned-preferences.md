---
name: The Ranker That Learns
type: roadmap
status: planned
description: Waypoint's flight and hotel picks get sharper every trip, learning from what you actually book, not just what you say you want.
effort: medium
requires: []
---

The current ranking is a sensible, hand-tuned formula: price, duration, stops, stated preference. It's honest about being a placeholder. This is the upgrade once there's real signal to learn from.

## What it looks like

- Nothing looks different. Waypoint still shows two or three options and leads with the best one — but "best" quietly gets better calibrated to this specific traveler over time.
- A traveler who always picks the pricier nonstop over a cheaper one-stop, even when they said "flexible on cost," gets that reflected without ever having to restate the preference.
- Declines matter as much as bookings: an option proposed and turned down repeatedly stops getting proposed.

## Key details

- Never overrides an explicit in-the-moment request ("book the cheapest one this time") — learned preference is a tie-breaker, exactly like the stated preferences are today.
- Fully explainable: the detail panel can always answer "why did you suggest this" in plain language.

~~~
Replace/augment `common/rank.ts`'s fixed weights with a per-traveler weight vector fit from historical `proposeBooking`-accepted vs. `declineAction`-declined outcomes (logged already in `pending_actions`). Simple online learning (e.g. weight nudges per outcome) is enough at this stage; no need for a full ML pipeline. Falls back to the current hand-tuned weights for any traveler without enough history.
~~~
