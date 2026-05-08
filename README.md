# Smartmorphic — Claude Code Handoff

A self-contained handoff package for porting the **Smartmorphic** smart-home UI to a real codebase. Everything Claude Code needs to match the visuals is in this folder — no external project references.

## What's in here

```
handoff/
├── smartmorphic.css         ← Single drop-in stylesheet (tokens + components)
├── icons.js                 ← Icon registry (SmartmorphicIcons.I[name] → SVG string)
├── logo-ember.svg           ← Brand mark
├── fonts/                   ← Local font files (DM Sans, JetBrains Mono variable)
├── component-gallery.html   ← Every component, plain HTML — copy-paste source
├── screen-home.html         ← Full home screen example
├── screen-room.html         ← Full room detail screen example
├── screen-devices.html      ← Full devices list screen example
└── README.md                ← This file
```

## Setup

1. Copy `smartmorphic.css`, `icons.js`, and the `fonts/` directory into your asset folder.
2. Link the stylesheet, load the icon registry, and inflate icons:
   ```html
   <link rel="stylesheet" href="smartmorphic.css">
   <script src="icons.js"></script>
   <script>
     document.querySelectorAll('[data-icon]').forEach(el => {
       const svg = SmartmorphicIcons.I[el.dataset.icon];
       if (svg) el.innerHTML = svg;
     });
   </script>
   ```
3. Wrap any icon in `<span class="icon" data-icon="<name>"></span>` and the script will inject the right SVG.

To use a framework-native approach instead, the icon set is a plain object — `SmartmorphicIcons.I` exports `{ home: '<svg…/>', lightbulb: '<svg…/>', … }`. Render however you like.

## Theming

Default theme is light. To switch:

```html
<html data-theme="dark"> … </html>
```

All component styles read from CSS custom properties — switching `data-theme` updates surface, text, and shadows in lockstep. There are no per-component dark-mode overrides to maintain.

## Five inviolable rules

1. **One surface.** Page bg and card bg are the same color (`#e2e4ec` light / `#1a1b22` dark). Cards are distinguished by **shadow only**, never by fill.
2. **Shadow is the language.** Three depth levels: `--neu-raised`, `--neu-raised-sm`, `--neu-pressed`. State changes swap the shadow recipe — they do **not** change fill color.
3. **Accent is rare.** `#e8653a` is reserved for active state, slider fills, focus, and the brand. Always carries an `--accent-glow` halo.
4. **Lucide stroke icons only.** 1.7px stroke, `fill: none`, `stroke: currentColor`. Live inside neumorphic wells. **No emoji, no PNG, no filled icons** (exception: starFill).
5. **No imagery, no background gradients, no patterns, no glassmorphism, no `backdrop-filter`.**

## Component reference

Every class is in `smartmorphic.css` — these are the public ones to compose with:

| Group | Classes |
|---|---|
| Primitives | `.neu-raised` · `.neu-raised-sm` · `.neu-pressed` · `.neu-pressed-sm` |
| Wells | `.icon-well` (modifiers: `.on`, `.lg`, `.sm`) |
| Buttons | `.neu-btn` (round) · `.neu-btn-rect` · `.btn-primary` |
| Toggle | `.toggle` / `.toggle.on` / `.toggle.no-label` (knob always white; off-track `#c4c7d4`) |
| Slider | `.slider-row` > `.slider-label` · `.slider-track` > `.slider-fill` (`.brightness` / `.temp`) > `.slider-knob` · `.slider-value` |
| Chips | `.scene-scroll` > `.scene-chip` (active = pressed inset, accent text — never fills) |
| Pills | `.status-pill.ok` · `.warning` · `.alert` · `.info` (semantic 18% bg + darkened text) |
| Status tiles | `.status-row` > `.status-card` (icon + value + label) |
| Rooms | `.room-grid` > `.room-card` (with `.room-active-dot`) · `.add-room-card` (dashed) |
| Lights | `.light-list` > `.light-card` (toggle `.expanded` to reveal `.light-controls`) |
| Devices | `.dev-summary` · `.dev-group` · `.dev-item` |
| Security | `.sec-banner` · `.cam-card` · `.det-card` |
| Settings | `.settings-item` |
| Layout | `.app` · `.view` · `.bottom-nav` (becomes side rail at ≥768px) |
| Type | `.eyebrow` · `.stat-num` · `.section-label` · `.mono` |
| Animation | `.stagger` (parent — children fade-up 40ms apart) |

## Type system

- **Outfit** — H1, H2, eyebrow/section labels, big numbers (`72°`, `5`)
- **DM Sans** — body, labels, status, controls, H3
- **JetBrains Mono** — Matter cluster IDs, code, log output, technical detail

Heading weights are 500 (display numerals) and 600 (titles) only. Eyebrows are 11px / 600 / **uppercase** / **1.5px tracking** / `var(--text-muted)`.

## Voice / copy

- **Title Case** for room/device/scene names: `Pendant Light`, `Movie Night`, `Good Evening`
- **UPPERCASE + 1.5px tracking** for eyebrows: `QUICK SCENES`, `ROOMS`
- **Sentence case** for sub-copy: `Cameras & detectors`
- Numbers always carry units: `73°F`, `80%`, `4600K`, `Battery 92%`
- No exclamation marks, no marketing voice, no emoji
- Errors are quiet (`Camera offline`), never alarming unless real alarm
- Empty state: `No devices in this room yet.` — not `Add your first device!`

## Interaction rules

- **Press** = `transform: scale(0.96–0.98)` + swap raised → pressed shadow. 0.15s ease-out.
- **Hover** = pointer cursor + shadow softens. **Buttons do not change fill on hover.**
- **Selected** = pressed inset + accent text color. The chip recedes; never fills.
- **Stagger fade-up** on view enter, 40ms apart (use `.stagger` on parent).
- Loops reserved for: live-camera dot pulse (2s) and active-room dot pulse (2.4s). No bounce, no parallax, no scroll-driven animations.

## Layout

- Mobile-first, single column up to 768px, `max-width: 480px`.
- 768px+: 80px left side rail + content with 32–40px padding.
- Bottom nav becomes side rail on tablet+ — always pinned, never hamburger-hidden.
- Inner content max-widths: 640–900px to avoid stretched rows.

## Available icons

`SmartmorphicIcons.I` exposes 50+ glyphs. Pull names from `icons.js`. Substitution rule: missing icons come from Lucide (`https://unpkg.com/lucide-static@latest/icons/<name>.svg`) — never mix families.

## Pre-flight checklist for new UI

Before merging anything new, verify:

1. Single surface? (Yes — never a card on a card with different fills.)
2. Shadow expresses depth/state — not color?
3. Accent reserved for active/focus only?
4. All icons Lucide-stroke inside wells?
5. Type using DM Sans (body) / Outfit (display) / JetBrains Mono (technical)?
6. None of: emoji, gradients-on-bg, photography, glassmorphism, filled icons, hover fill-changes?

If any answer is no, redo it.
