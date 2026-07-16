---
name: Visual Identity
description: The "Golden Hour" aesthetic direction, token system, and component treatments for Waypoint.
---

# Visual Identity

Waypoint's aesthetic is **Golden Hour**: a warm, sunny, playful companion, not a cool professional tool. Bright white cards float like peel-and-stick stickers on a soft peachy daylight canvas, corners are rounded and soft, colors are candy-bright, type is friendly and characterful, and motion is springy and full of small delight. The voice orb is a little sun-drop mascot with a face — the charm of the whole app.

Underneath the charm is a spine of restraint. Waypoint handles real money — flights, hotels, calls to airlines — so the moments that spend money deliberately **calm down**. That register shift (cute everywhere, grown-up when it counts) is what lets the app be genuinely delightful without ever feeling like a toy you can't trust.

## The three principles

- **Delight.** The app should make you smile. Springy motion, a mascot with personality, soft squeezable surfaces, little celebrations when things go right. This is the default register.
- **Clarity.** Every action is unambiguous. A confirm button says "Book this flight," never "Continue." Cute never costs comprehension: prices, dates, and terms stay literal, legible, and full-contrast.
- **Trust when it counts.** For any moment involving real money — the confirm-gate, the live call, prices and terms, failures — the app shifts to a calm register: tighter corners, settle motion, no stickers or confetti, the mascot drops its face. This shift is the mechanism that keeps "cute" from undermining "safe."

## What to avoid, always

- No skeuomorphic travel clichés: no planes taking off, no postcard textures, no boarding-pass motifs. A rounded plane *icon* for wayfinding is fine; hero plane imagery is not.
- No more than one accent color competing for attention on a screen at a time. Tangerine appears only when something is genuinely live.
- No literal emoji baked into the UI chrome as decoration. Personality comes from the mascot, the sticker treatment, motion, and copy — not from an emoji font.
- No cute anywhere near money. No stickers, confetti, tilt, or mascot face on the confirm-gate, the call layer, or price/terms text.
- No celebrating before a commitment succeeds. Confetti fires only after something books, never on the gate, never during a call, never on failure.

## Spacing

A strict 4px scale. Use only these values, nothing in between:

~~~
4, 8, 12, 16, 20, 24, 32, 40, 48, 64 (px)

Minimum 8px between adjacent tap targets. Minimum 44px tap target. Section-level padding: 64px desktop, 32px mobile.
~~~

## The full token system

Colors are defined at the brand level in `src/interfaces/@brand/colors.md`. This is the complete semantic mapping, the source of truth for implementation. Define these as CSS custom properties once and reference them everywhere. Dark mode is a pure token swap; no component hardcodes a hex.

~~~
:root {
  /* surfaces (light) — bright white cards pop off the warm canvas */
  --canvas:        #FCF4ED;      /* app background — warm daylight */
  --surface:       #FFFFFF;      /* cards, nodes, panels */
  --surface-sunk:  #F3EBE1;      /* input wells, Waypoint chat bubble, gate summary */
  --surface-hover: #FBF6F0;
  --border:        #EDE2D5;      /* warm hairline, used sparingly */
  --border-strong: #DFD2C2;      /* dashed 'proposed' outline, dividers */

  /* text */
  --text:          #2A2320;
  --text-2:        #6E6459;
  --text-3:        #A2968A;
  --on-accent:     #FFFFFF;

  /* primary / action / confirmed */
  --primary:        #2B57E8;
  --primary-strong: #1E45CC;     /* pressed + small-text links (AA) */
  --primary-tint:   color-mix(in oklch, var(--primary) 12%, var(--surface));

  /* live / voice / working */
  --live:      #FF7A2E;
  --live-deep: #FF5E1F;          /* orb edge / gradient stop */
  --live-gold: #FFC24D;          /* orb core / gradient stop */
  --live-tint: color-mix(in oklch, var(--live) 14%, var(--surface));

  /* danger / failed */
  --danger:      #F14A52;
  --danger-tint: color-mix(in oklch, var(--danger) 12%, var(--surface));

  /* node status → the four states */
  --status-proposed:  #C6B7A6;
  --status-confirmed: var(--primary);
  --status-working:   var(--live);
  --status-failed:    var(--danger);

  /* presence (candy; identity-scale only) */
  --presence-1:#9A5CF0; --presence-2:#EF4E9B; --presence-3:#1FC29A;
  --presence-4:#10AEC4; --presence-5:#83BE3A; --presence-6:#2FA8E6;

  /* radii — rounded everything */
  --r-xs:10px; --r-sm:14px; --r-md:20px; --r-lg:26px; --r-xl:34px; --r-full:999px;

  /* shadows — warm-tinted, layered, gummy */
  --shadow-sm: 0 1px 2px rgba(42,35,32,.05), 0 2px 6px rgba(42,35,32,.06);
  --shadow-md: 0 3px 8px rgba(42,35,32,.06), 0 10px 24px rgba(42,35,32,.10);
  --shadow-lg: 0 8px 20px rgba(42,35,32,.09), 0 24px 52px rgba(42,35,32,.13);
  --shadow-gate: 0 20px 60px rgba(42,35,32,.22);
  --sticker: 0 0 0 3px var(--canvas), 0 3px 8px rgba(42,35,32,.16);   /* die-cut halo */
  --glow-live: 0 0 0 5px color-mix(in oklch,var(--live) 16%,transparent),
               0 8px 26px color-mix(in oklch,var(--live) 34%,transparent);
  --glow-primary: 0 6px 22px color-mix(in oklch,var(--primary) 28%,transparent);

  /* motion — springy by default */
  --ease-bounce: cubic-bezier(.34,1.56,.64,1);   /* default delight, ~8-10% overshoot */
  --ease-pop:    cubic-bezier(.30,1.7,.5,1);      /* celebration, ~16% overshoot */
  --ease-settle: cubic-bezier(.22,1,.36,1);       /* grown-up, calm, no overshoot */
  --ease-squish: cubic-bezier(.5,.05,.3,1);       /* press */
  --t-fast:140ms; --t-base:220ms; --t-node:260ms; --t-gate:300ms; --t-panel:320ms; --t-celebrate:520ms;
}

[data-theme="dark"] {
  /* warm espresso night — never cold black */
  --canvas:        #1B1611;
  --surface:       #26201A;
  --surface-sunk:  #171310;
  --surface-hover: #2E271F;
  --border:        #3A322A;
  --border-strong: #4A4036;

  --text:          #F7EFE6;
  --text-2:        #C0B4A6;
  --text-3:        #8A7E70;

  --primary:       #6E90FF; --primary-strong:#8AA6FF;
  --primary-tint:  color-mix(in oklch, var(--primary) 20%, var(--surface));
  --live:          #FF934D; --live-deep:#FF7130; --live-gold:#FFCB63;
  --live-tint:     color-mix(in oklch, var(--live) 22%, var(--surface));
  --danger:        #FF6470; --danger-tint: color-mix(in oklch, var(--danger) 20%, var(--surface));

  --status-proposed: #6B5E50;

  /* presence: lighten + slightly trim chroma so they don't buzz on espresso */
  --presence-1:#B084FF; --presence-2:#FF74B4; --presence-3:#43D6B0;
  --presence-4:#3ECADD; --presence-5:#A2D95C; --presence-6:#5CBEF0;

  --shadow-sm: 0 1px 2px rgba(0,0,0,.3), 0 2px 6px rgba(0,0,0,.34);
  --shadow-md: 0 3px 10px rgba(0,0,0,.36), 0 12px 28px rgba(0,0,0,.42);
  --shadow-lg: 0 10px 26px rgba(0,0,0,.44), 0 28px 60px rgba(0,0,0,.5);
  --sticker: 0 0 0 3px var(--surface), 0 3px 10px rgba(0,0,0,.5);
}
~~~

~~~
Dark-mode elevation: lift surfaces (canvas → surface → hover), add a 1px inset rgba(255,255,255,.05) top highlight on cards, and cap accent glow opacity so tangerine/blueberry don't bloom. Presence colors get equal OKLCH lightness (~0.65 light / ~0.74 dark) so no one's dot shouts louder — fairness matters in multiplayer.
~~~

## How "cute" is built

**Rounded everything.** Cards and nodes `--r-lg` (26px), buttons/pills/inputs `--r-full` or `--r-md`, avatars circular. Nothing sharp anywhere in the playful register.

**Depth through soft candy shadows, not borders.** Bright-white cards float on the warm canvas with warm-tinted layered shadows. Borders are a last resort (warm hairline). This is the whole "gummy" feel — surfaces look soft and squeezable.

**The sticker treatment** is the signature "cute without emoji" device: a die-cut halo (`--sticker`, a 3px canvas-colored ring plus a soft shadow) makes an element look like a peel-and-stick sticker. Use it on avatars, the orb, status badges, and the "Booked" stamp. Sparingly.

**Icon chips as node identity.** Each node leads with a rounded colored tile holding a Tabler glyph (`plane`, `bed`, `map-pin`) — app-icon-as-identity. Tabler stroke `1.75` to match the rounder mood.

**Playful accents that don't become clutter:**
- **Resting tilt on badges and stickers, never on nodes.** Nodes stay straight for legibility; their status stickers and stamps tilt −8° to +8° for scrapbook charm.
- **A faint warm dot-grid on the board canvas** (`--text` at ~4-5% opacity, ~22px pitch) — reads "pinnable board," adds texture without faking cork or paper.
- **Confetti / particle bursts reserved for true wins** (the first node lands, the whole trip is booked). Never on a single money confirmation, never on failure.
- **Characterful empty states** use the orb mascot posed, with warm copy ("Nothing pinned yet — tell me where you're headed").

## The mascot

The voice orb is a squishy sun-drop character with a minimal face. Assets (transparent PNGs, served from the web public folder):
- **Idle** (soft, resting face) and **listening** (perked up) orb renders.
- A **"Booked" stamp** sticker for confirmed nodes.
- The **app icon** is the face-forward sun-drop.

~~~
The mascot's face is the app's charm, but per the trust principle it is expressive ONLY in playful modes (front door, idle, listening, success). It goes faceless (fade the face layer to zero, keep the glow) during the call layer and the confirm-gate. The orb is ONE persistent element across front door → docked input bar → call (shared layout, never remounted); drive its face via an opacity variable tied to mode (playful vs calm). Give it the --sticker halo so it pops off any surface.
~~~

## Motion — springy by default, calm when it counts

Three registers:

| Register | Character | Where |
|---|---|---|
| **Bouncy** (default delight) | `--ease-bounce`, spring ~380/24 | node arrival, button press-squish, facepile join, toasts, panel entrance, orb reactions, hover lifts |
| **Pop** (celebration) | `--ease-pop`, spring ~300/18 | first node, trip fully booked, orb greeting, confetti |
| **Settle** (grown-up) | `--ease-settle`, spring ~260/30 | confirm-gate, call layer, money numbers, failure |

~~~
Micro-delight everywhere: hover = translateY(-2px) + shadow grow (--t-base); press = scale(.96) + shadow collapse (gummy squish, --ease-squish). Never block interaction on a bounce.

Build a `.calm` scope that overrides springs → settle and hides decorative layers (stickers, confetti, mascot face, tilt). Money and serious surfaces live inside it.

Failure is caring, not comedic: honest copy, a soft single shake (±3px, once) then settle, an immediate next step. No sad-mascot gags about lost money.

Reduced motion is non-negotiable: under prefers-reduced-motion: reduce, drop ALL overshoot / scale / tilt / confetti to opacity fades. The app must be fully usable and still feel calm-nice without a single bounce.
~~~

## Shared trips: three color roles and the presence palette

Shared Trips has three kinds of state that must never collide:

- **Blueberry (`--primary`)** owns actions and outcomes: buttons, approval, confirmed nodes.
- **Tangerine (`--live`)** owns *the system is live*: the orb, voice, calls, working nodes.
- **Presence colors** own *who is here*: a person's identity and live attention.

Presence borrows the pulse *motion* but never the tangerine hue, so liveness reads as a familiar Waypoint pulse in a person's own color. Presence color is identity-scale only: rings, dots, avatars (≤32px), and name text. It never fills a surface and never competes as the screen's one accent.

### Presence treatments

- **Avatars** are Fredoka initials on a presence-color fill, white text, with the `--sticker` die-cut halo so they read as peel-and-stick. Sizes: 24px facepile, 32px roster, 18-20px node cluster. Initials = first letter of first + last name (one name → one letter).
- **Facepile** in the title bar: up to 4 overlapping avatars (−8px), owner first then most-recently-active, an active member carries the presence halo, overflow collapses to a `+N` pill, a trailing `+` circle opens the invite composer. Join = bounce in (`--ease-pop`) + a small sparkle + a warm toast.
- **Identity is static, liveness is animated.** The filled circle is *who* and never moves; the animated halo is *here now*.
- **On a board node**, present viewers cluster as 18-20px mini sticker-avatars pinned to the node's **top-right**, clear of the top-left icon chip and any working glow. Frontmost viewer carries a soft presence halo. Zoomed out, avatars collapse to a single colored dot per viewer.

~~~
Presence rhythm is gentler than the tangerine working pulse so peripheral vision tells them apart:

--presence-in: 300ms; --presence-out: 600ms;
--presence-pulse: 2800ms;   /* vs working pulse ~2400ms */
--breathe-held: 3000ms;     /* held/waiting-on-a-human node breathe */

@keyframes presence-pulse { 0%{transform:scale(1);opacity:.45} 70%{opacity:0} 100%{transform:scale(1.7);opacity:0} }

Presence "active" = lastSeen within a 10s window (grace, so a dropped 4s poll doesn't strobe a marker off). Fade-in 300ms (opacity + scale 0.9→1); fade-out 600ms (opacity only). Under prefers-reduced-motion: no pulse, a static ring at opacity .5.
~~~

### Waiting on a human is NOT a working state

A node held because it is *waiting for a person to approve* is **quiet neutral**, never Tangerine. Tangerine means the machine is churning; a held node is visibly *paused*. Render it with muted text, an `hourglass` glyph, a slow 3s breathe, and a neutral pill ("Waiting for Maya to approve"). Keep a hard line between "the system is working" (Tangerine, active) and "we're waiting on a human" (neutral, held).

### Conversation attribution & requested-by

The conversation gains a third bubble type beside Waypoint (cream `--surface-sunk`, with the orb avatar) and You (solid Blueberry, white text): **another person** — a light presence-tint fill, Ink body text, and a name label in their presence color. When a companion's message produces a booking proposal, the node, its detail panel, and its confirm-gate carry a "Requested by [name]" chip (presence-color dot + label) so the origin is never lost.

## Iconography

Tabler icons, outline style, **1.75 stroke** (a hair heavier than before, to match the rounder mood), `currentColor`. Node kind icons live in a rounded colored chip: `plane` (flight), `bed` (hotel), `map-pin` (activity), `car` / `train` / `walk` (ground). Loading uses `loader-2` with a CSS spin.

## Component treatments

The full interaction spec for each surface lives in `src/interfaces/web.md`. This section is the visual source of truth.

### Board node

A bright rounded white card (`--r-lg`) on the warm dotted canvas, floating on `--shadow-md`. It leads with a rounded colored **icon chip** (the node kind), a kicker Overline, and a Fredoka title. Nodes are **not draggable** (the board reads chronologically). Status is carried by the chip, a status sticker/stamp, and — for working — a tangerine glow, never a square border stripe.

- **proposed:** dashed `--border-strong` outline, slightly translucent, muted chip — visibly tentative, no accent.
- **working:** `--glow-live` tangerine aura + a gentle breathing squish (scale 1↔1.03, 2.4s) + a tiny spinner in the chip. The only orange on screen.
- **confirmed:** the "Booked" stamp sticker springs on (`--ease-pop`, settling to a −8° tilt) with a small particle tick; the card carries a faint `--glow-primary`.
- **failed:** a `--danger-tint` wash, a caring sticker ("that fare's gone"), and a retry action — calm, a single shake on appear, never jokey.
- **Presence** sticker-avatars pin the top-left corner (clear of the top-right stamp zone). Status changes are color-only, never layout. A rebooked node keeps its id and position.

```wireframe
---
name: Waypoint node — Golden Hour
description: Confirmed hotel node. Icon chip identity, Booked stamp sticker top-right, presence sticker-avatar top-left, rounded gummy white card on the warm dotted canvas.
---
<html lang="en"><head><meta charset="utf-8"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#FCF4ED;display:grid;place-items:center;font-family:"DM Sans",system-ui,sans-serif;padding:40px;
  background-image:radial-gradient(rgba(42,35,32,.05) 1.4px,transparent 1.4px);background-size:22px 22px}
.node{position:relative;width:240px;background:#fff;border-radius:26px;box-shadow:0 8px 20px rgba(42,35,32,.09),0 24px 52px rgba(42,35,32,.12);padding:16px}
.top{display:flex;gap:12px;align-items:center}
.chip{width:44px;height:44px;border-radius:16px;background:#2B57E8;display:grid;place-items:center;flex:none;box-shadow:0 4px 10px rgba(43,87,232,.35)}
.chip svg{width:22px;height:22px;stroke:#fff;stroke-width:1.75;fill:none}
.kick{font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#A2968A}
.ttl{font-family:Fredoka,sans-serif;font-weight:500;font-size:18px;color:#2A2320;margin-top:1px}
.meta{margin-top:12px;padding-top:12px;border-top:1px solid #F1E7DB;display:flex;justify-content:space-between;align-items:baseline}
.price{font-family:Fredoka;font-weight:600;font-size:19px;color:#2A2320}
.per{font-size:12px;color:#A2968A}
.stamp{position:absolute;top:-14px;right:-10px;width:58px;transform:rotate(-8deg);filter:drop-shadow(0 3px 6px rgba(42,35,32,.2))}
.pres{position:absolute;top:-11px;left:14px;width:26px;height:26px;border-radius:50%;background:#9A5CF0;color:#fff;
  font-family:Fredoka;font-weight:500;font-size:11px;display:grid;place-items:center;box-shadow:0 0 0 3px #FCF4ED,0 3px 7px rgba(42,35,32,.18)}
</style></head><body>
<div class="node">
  <img class="stamp" src="https://i.mscdn.ai/df384448-487b-4b39-866e-22f3e209d14f/generated-images/bb2804c4-30bb-4104-89e2-cae57bcc962f.png?w=140"/>
  <div class="pres">JD</div>
  <div class="top">
    <div class="chip"><svg viewBox="0 0 24 24"><path d="M3 12h18M3 12l4-7h10l4 7M6 16h.01M18 16h.01"/></svg></div>
    <div><div class="kick">Stay · 3 nights</div><div class="ttl">Sunset Villa</div></div>
  </div>
  <div class="meta"><span class="price">$214</span><span class="per">/night · confirmed</span></div>
</div>
</body></html>
```

### Voice orb

The mascot is the asset. **Idle:** breathe (scale 1↔1.04, 3s ease-in-out) with the sunny gradient slowly rotating, a `--glow-live` halo, and a blink (quick squish) every ~9s. **Listening:** swap to the perked-up render, halo intensifies, blob wobbles. **Speaking:** rhythmic pulse to speech cadence. It travels front-door → docked input bar as one shared-layout element (springy) and its **face fades to zero the moment it docks to work or the gate opens**, returning only in idle/success. It carries the `--sticker` halo.

### Confirm-gate — the calm island

This is where the app settles down, and that shift is the trust signal. Scrim: warm dark blur (`rgba(27,22,17,.5)` + `backdrop-filter: blur(8px)`). Card: white, **less round than playful cards (`--r-md`, not `--r-xl`)** so it reads solid and official; `--shadow-gate`; rises with the settle spring (no overshoot). Structure: eyebrow ("Confirm booking"); kind-icon chip plus the exact action as a Headline (never a vague verb); an itemized summary in a `--surface-sunk` inset; the irreversible line in plain, high-contrast DM Sans ("$612.00 will be charged to Visa ending 4242."); then two equal-weight 44px buttons — decline left ("Not yet", neutral surface) and affirmative right ("Book it", solid Blueberry). No stickers, no confetti, orb faceless. Prices/dates/terms in plain DM Sans, full contrast, never tinted low-contrast or occluded.

~~~
The gate uses --primary (Blueberry), NOT Tangerine — it is an action, not a voice-state. A spoken "yes" resumes the gate AND must visibly trigger the "Book it" pressed state (scale-to-0.97 + fill → --primary-strong) so screen and voice agree. Transcript text alone NEVER satisfies the gate — that is the prompt-injection defense at the UI layer.

For the companion-without-approval case (Shared Trips), this stays the calm non-blocking "Waiting for [owner]" held state — quiet neutral, not tangerine, never a blocking scrim.
~~~

### Conversation bubbles

Warm and iMessage-familiar. Waypoint = cream `--surface-sunk` bubble with the orb as a 30px avatar; You = solid Blueberry, white text, weight 500; another person = light presence-tint fill, Ink text, a colored name label above. Each bubble has one clipped tail corner. Bubbles spring in (bounce, slight rise). Typing = three bouncing dots in a cream bubble. Streaming text reserves its line height — zero layout shift.

### Live call layer

Grounded but alive. A warm glassmorphic overlay (`backdrop-filter: blur(16px)`, `--surface` at ~92% over the scrim), rounded, rising over the board region only (never the conversation column). The orb is in tangerine "on a call" mode, **faceless and focused**. A pulsing tangerine dot + "On the line with Hotel Zephyr" + a live tabular timer; beneath it the sub-status ("Asking about a late checkout"). A two-sided streamed transcript (Waypoint = tinted bubble; the venue = plain text with a speaker label). A pretty audio waveform is welcome — delight that doesn't touch trust. The layer rises with **settle** motion (a real call, not a toy). On end it dissolves and hands off to the board, where the node runs its working→confirmed resolve; the "rebooked!" celebration fires only *after* the confirmed outcome, never mid-call.

### Node detail panel

A docked panel on the right (~400px, `--r-xl` inboard corners), sliding in with no scrim (not modal; the board stays live). On open, pan the board so the selected node sits just left of the panel. Clicking a different node cross-fades the panel contents. Content: Fredoka title header + status chip + icon chip; grouped sections (dividers, not nested cards): details, a short state history, and actions — any spend/call routes through the confirm-gate. A "Requested by [name]" chip shows when a companion proposed the node. Close via X, Esc, or re-clicking the node.

## Cross-cutting implementation rules

~~~
- Board updates are diffs applied to the live React Flow instance, never full re-renders, so nodes animate via the mount keyframe instead of popping.
- Status change is color-only. Never resize or reposition a node on a status change. A rebooked node keeps its id and position.
- Don't recenter the camera on every event. Gently pan (fitView with padding) only when a NEW node lands off-screen.
- Streaming text never shifts layout, in both the chat column and the call transcript.
- The confirm-gate is the code gate, always shown, always --primary. Voice "yes" resumes it and animates the button; transcript text alone never satisfies it.
- One accent per screen. Call live → board recedes, Tangerine leads. Gate up → Blueberry leads. Tangerine ONLY when genuinely live.
- Buttons never resize during loading: swap the label for a loader-2 spinner at fixed min-width.
- Fredoka only at 16px+, everything smaller is DM Sans. Use --primary-strong for small-text links on white to clear AA.
- 44px minimum tap targets, 8px minimum gap between adjacent targets.
- Dark mode is a token swap; no component hardcodes a hex. Money/serious surfaces live in a `.calm` scope that disables springs, stickers, confetti, and the mascot face.
~~~
