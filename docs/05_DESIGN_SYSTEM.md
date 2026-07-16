# Design system

The brief: aesthetic like Notion and Apple. These two are actually complementary, not competing, references, Notion contributes the structural calm (generous whitespace, a disciplined spacing scale, soft layered surfaces), Apple contributes the interaction philosophy (clarity, deference, depth) that matters specifically for a voice-primary interface, where the UI has to feel alive while someone's talking without ever competing with the conversation. This doc gives concrete, implementable tokens, not mood-board language, a coding agent should be able to build directly from this.

## 1. The three principles this app actually needs, translated from Apple's HIG

- **Clarity**: every piece of UI text is unambiguous about what will happen. A confirm button never says "Continue," it says "Book this flight" or "Call the airline." This matters more than usual here because voice already carries ambiguity risk (see the confirm-gate read-back requirement in `01_PRODUCT_BRIEF.md` §7), the visual layer should remove ambiguity, not add to it.
- **Deference**: the interface recedes while the agent is talking or a call is in progress. No modal, no attention-grabbing animation competes with the live transcript or the itinerary building on screen, those are the content, the chrome around them stays quiet.
- **Depth**: use layering and subtle motion, not decoration, to communicate state. The clearest use case in this app: an active voice/call session sits in a translucent layer above the itinerary, exactly like Apple's current "Liquid Glass" material philosophy of a functional layer floating above and giving way to content, not a decorative effect.

## 2. Tokens

### 2.1 Spacing

4px base unit, Notion's scale, use only these values, nothing in between:

```
4, 8, 12, 16, 20, 24, 32, 40, 48, 64   (px)
```

Minimum 8px between adjacent tap targets. Section-level padding: 64px desktop, 32px mobile.

### 2.2 Typography

System font stack for native feel and zero load cost, mirroring both references' actual practice (Notion leans on system fonts for UI chrome, Apple's guidance is SF Pro but system-ui is the correct web equivalent):

```css
font-family: -apple-system, "SF Pro Text", "Inter", system-ui, sans-serif;
```

Type scale (Apple's named scale, adapted for web px):

| Role | Size | Weight |
|---|---|---|
| Large title (trip name) | 34px | 500 |
| Title (section headers) | 22px | 500 |
| Headline (card titles, e.g. a flight leg) | 17px | 500 |
| Body (default text, transcript) | 16px | 400 |
| Subhead / secondary | 14px | 400 |
| Caption (timestamps, metadata) | 12px | 400 |

Two weights only, 400 and 500. Never bold-heavier than 500, it reads as heavy/generic against this typeface at these sizes.

### 2.3 Color

Adaptive, not fixed, both references treat color this way (Apple's semantic system colors, Notion's light/dark surface pairs). Define as CSS custom properties so dark mode is a token swap, not a rewrite:

```css
:root {
  --surface-0: #ffffff;      /* page background */
  --surface-1: #f6f5f4;      /* card background, Notion's off-white */
  --text-primary: #000000;
  --text-secondary: #3c3c43; /* ~60% opacity equivalent */
  --accent: #097fe8;         /* primary action, links */
  --accent-voice: #d85a30;   /* reserved for anything voice/call-state related, warm and distinct from the primary accent so an active call is unmistakable at a glance */
  --success: #34c759;
  --danger: #ff3b30;
  --border: rgba(0,0,0,0.08);
}
[data-theme="dark"] {
  --surface-0: #0b0b0a;
  --surface-1: #171715;
  --text-primary: #f6f5f4;
  --text-secondary: #a8a7a2;
  --border: rgba(255,255,255,0.09);
  /* accent, accent-voice, success, danger stay the same hue, Apple's semantic colors are designed to hold up on dark backgrounds unchanged */
}
```

### 2.4 Radius & elevation

- 4px for inputs and small controls
- 8-12px for cards
- No sharp corners anywhere, no rounded corners on single-sided borders (a left-accent border stays square)
- Shadows are soft and low-opacity, composed of two subtle layers rather than one hard drop-shadow, this is what makes Notion's elevation feel like a soft lift rather than a UI-kit default. Use elevation sparingly, reserve it for the one thing that should currently have the user's attention (an active proposal card, the in-progress call panel), not on every card uniformly.

### 2.5 Motion

Subtle, purposeful, never decorative. Two motion moments actually matter in this app: the itinerary card that appears/updates live during planning (a gentle fade-and-settle, under 200ms, so it reads as "this just arrived" without being distracting while someone's mid-sentence), and the active-call indicator (a slow, calm pulse, not a frantic one, on the voice/call accent color, communicating "live" the way a recording light does, without demanding attention).

## 3. Component specs for this app specifically

### 3.1 Voice presence indicator

Not a waveform gimmick. A single, calm circular indicator that has exactly three states: idle (static, low-opacity outline), listening (soft pulse, `--accent-voice`), speaking (slightly faster, still calm, same color). This is the one piece of UI on screen at all times during a voice session, it needs to be legible from across a room, and it needs to never look alarming, even during a disruption call.

### 3.2 The planning board

This is the app's signature surface, and it has its own full specification in `docs/07_PLANNING_BOARD.md`, layout rules, node and edge anatomy, the click-to-detail interaction, and exactly how it wires bidirectionally to Vocal Bridge's Client Actions. Everything else in this document (the color tokens for node status, the motion tokens for how nodes animate in, the Deference principle governing how the detail panel behaves) is written to be consumed by that spec directly, treat this document as the token/principle source and `docs/07_PLANNING_BOARD.md` as the authoritative component spec for the board itself.

### 3.3 Confirm-gate card

This is the single most important component in the app, since it's the visual form of the `interrupt()` mechanism in `docs/02_ARCHITECTURE.md` §4. It must, without exception: state the exact action in plain language ("Book Delta 2272, LAX to SFO, $214"), never use a vague label on the affirmative button ("Book this," not "Confirm" or "OK"), and offer an equally visible decline/change path, not a buried "cancel" link. This card gets elevation (§2.4) precisely because it's the one moment the interface should stop deferring and ask for the user's full attention.

### 3.4 Live call panel

Appears only while an outbound call is active (the disruption flow). Two zones: a live transcript (both sides labeled, streamed turn by turn) and a compact status line showing what the agent is trying to accomplish on the call. Rendered in the translucent "layer above content" treatment described in §1's Depth principle, giving way to the itinerary underneath once the call ends rather than staying pinned.

## 4. What to explicitly avoid

- No onboarding carousel, no marketing-style hero section inside the app itself, the app is a tool, not a landing page.
- No skeuomorphic travel-brand decoration (plane icons taking off, postcard textures). Both reference languages are precise and restrained, lean into that, not into "travel app" visual clichés.
- No more than one accent color competing for attention in a single screen at a time, this is what keeps the confirm-gate and the voice indicator legible as *the* things that matter when they appear.
