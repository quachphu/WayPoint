---
name: Colors
type: design/color
description: The Waypoint "Golden Hour" palette — a warm daylight canvas with bright candy accents.
---

```colors
Canvas:
  value: "#FCF4ED"
  description: The app background. Soft warm daylight with a hint of peach, like late-afternoon sun on a wall. Friendly and warm, never the cool gray of a tool and never AI-editorial cream.
Cloud:
  value: "#FFFFFF"
  description: Elevated surfaces — cards, board nodes, panels. Bright pure white so surfaces pop off the warm canvas like peel-and-stick stickers.
Ink:
  value: "#2A2320"
  description: Primary text. A warm near-black, softened so it feels friendly on the peachy canvas instead of harsh.
Blueberry:
  value: "#2B57E8"
  description: Actions and outcomes. Every primary button, link, and the confirmed-booking status. Bright, confident, "locked in." The cool half of the brand.
Tangerine:
  value: "#FF7A2E"
  description: Live and voice. The orb's hue, the live-call state, and the working/in-progress node status. "Happening now." The one color that means the system is alive — never decorative.
Cherry:
  value: "#F14A52"
  description: Failed bookings and destructive actions only. Clear but caring, never alarmist. Kept a clear hue apart from Tangerine so live never reads as an error.
```

## The whole game: three colors, three jobs

Waypoint's identity got a warm, playful reinvention — sunny canvas, candy accents, rounded and characterful — but underneath the charm it keeps a strict three-way color separation, because the app is glanceable and voice-first and the signals have to stay unmistakable.

- **Blueberry (cool)** owns actions and outcomes: primary buttons, links, and the **confirmed** node status. "Locked in."
- **Tangerine (warm)** owns live: the voice orb, live calls, and the **working** node status. "Happening now." It is a functional signal light, never sprinkled for decoration.
- **Presence** is a set of six candy identity colors for the people on a shared trip (avatars, facepile, presence markers). Identity-scale only — rings, dots, avatars, and name text, never a surface fill.

~~~
One hard rule, enforced in review: **only one accent competes for attention per screen.** Tangerine appears only when something is genuinely live (a call, the orb listening, a node the agent is working on). When a call is live, the board recedes and Tangerine owns the screen. The confirm-gate uses Blueberry (an action), not Tangerine, even when voice triggered it. Presence colors never dominate — they stay at identity scale so the three roles never blur.

Tangerine (hue ~28°) is kept a clear distance from Cherry danger (hue ~2°) on purpose: voice and "live" must never read as an error.
~~~

## The presence palette

Six candy colors for the people on a shared trip, spaced around the wheel to stay clear of the Blueberry and Tangerine zones so a presence marker is never mistaken for an action or for system-live. Assigned in join order, owner first, stored on the membership row so every viewer sees the same color for the same person.

~~~
--presence-1: #9A5CF0;  /* Grape */
--presence-2: #EF4E9B;  /* Bubblegum */
--presence-3: #1FC29A;  /* Mint */
--presence-4: #10AEC4;  /* Lagoon */
--presence-5: #83BE3A;  /* Lime */
--presence-6: #2FA8E6;  /* Sky — assigned last, the nearest to Blueberry */

Normalized toward equal OKLCH lightness (~0.65 light, ~0.74 dark) so no one's dot shouts louder than another's — fairness matters in multiplayer. In dark mode they lift and trim chroma so they don't buzz on the espresso surface.
~~~

## Dark mode: warm espresso, never cold black

Dark mode is a cozy warm night — an espresso canvas (`#1B1611`), lifted surfaces, and the accents brightened (Blueberry `#6E90FF`, Tangerine `#FF934D`). Never a cold pure black. Surfaces lift through elevation (canvas → surface → hover) with a faint inset top highlight, and accent glows are capped so Tangerine and Blueberry don't bloom.

The full semantic token system (surfaces, text tiers, borders, accent tints, radii, shadows, glows, node-status tokens) for both light and dark mode lives in `src/interfaces/@brand/visual.md`. Dark mode is a pure token swap: no component hardcodes a hex.
