---
name: Typography
type: design/typography
description: A rounded, characterful display face paired with a crisp, warm body.
---

```typography
fonts:
  Fredoka:
    src: https://fonts.googleapis.com/css2?family=Fredoka:wght@300..700&display=swap
  DM Sans:
    src: https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..700;1,9..40,300..700&display=swap

styles:
  Display:
    font: Fredoka
    size: 40px
    weight: 600
    letterSpacing: -0.01em
    lineHeight: 1.05
    description: Trip names, the front-door greeting, and big celebratory moments. The most characterful the brand gets.
  Title:
    font: Fredoka
    size: 26px
    weight: 500
    letterSpacing: -0.005em
    lineHeight: 1.1
    description: Panel headers and section titles.
  Headline:
    font: Fredoka
    size: 20px
    weight: 500
    lineHeight: 1.2
    description: Card titles (16px and up), hero prices, primary button labels.
  Body:
    font: DM Sans
    size: 15px
    weight: 400
    lineHeight: 1.5
    description: Conversation, descriptions, all reading text.
  Label:
    font: DM Sans
    size: 13px
    weight: 500
    lineHeight: 1.3
    description: Node titles and meta, inputs, dense UI.
  Overline:
    font: DM Sans
    size: 11px
    weight: 600
    letterSpacing: 0.06em
    case: uppercase
    description: Section labels, presence sublines, roster tags.
```

## Personality in Fredoka, legibility in DM Sans

Two faces with two jobs. **Fredoka** — a rounded, friendly, characterful face — carries the personality: named things (trip names), big moments (the front-door greeting, celebrations), card titles, hero prices, and primary button labels. **DM Sans** — a crisp, warm, highly readable sans — carries everything you actually read: conversation, descriptions, inputs, dense UI, and any text below ~16px.

~~~
Implementation rules:
- **Fredoka only at 16px and up.** Its roundness muddies at small sizes, so anything smaller is DM Sans. This is the single most important rule for keeping the app legible while cute.
- **Two weights per face.** Fredoka 500 and 600; DM Sans 400 and 500/600. Restraint in weight is what keeps "friendly" from tipping into "toy."
- **Preload Fredoka 600 woff2** so the trip title and hero greeting don't reflow on late swap. `display=swap` is in the URL; DM Sans is the fallback for Fredoka, system sans is the ultimate fallback.
- **Optional:** JetBrains Mono for confirmation codes and flight numbers only, where tabular precision reads as trustworthy. Everywhere else, never a monospace.
~~~
