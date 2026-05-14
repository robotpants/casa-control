# Smartmorphic HA — TODO

## Phase 2 — custom Lovelace cards

Build Lit web components for the highest-traffic surfaces, consuming the `--smartmorphic-*` CSS variables already defined in the theme.

- [ ] **Room card** — room name, accessory count, ambient temp, ember dot when active. Tap → room detail view.
- [ ] **Light card** — replace HA's default light tile. Expandable for brightness + color temp + color, matches the iOS app's light-card pattern.
- [ ] **Scene chip** — pill that recedes when active. Lives in a horizontal scroll.
- [ ] **Status pill** — semantic chip (`ok` / `warning` / `alert` / `info`) with 18% background + darkened semantic text.
- [ ] **More-info dialog redesign** — replace HA's default expanded entity sheet.

## Polish backlog (theme-only, no custom cards required)

- [ ] **Markdown card subtitle treatment** — give the secondary text under headings a tighter eyebrow style without affecting all markdown.
- [ ] **Active-state detection on tile icons** — current glow is always-on; ideally fades off for `unavailable` / `unknown` states.
- [ ] **Energy dashboard restyle** — HA's energy view has its own quirks; needs targeted card-mod selectors.
- [ ] **Self-hosted fonts variant** — pre-built `smartmorphic-fonts.js` that references `/local/fonts/*` for users who want to avoid Google Fonts CDN.

## Tooling / packaging

- [ ] **HACS-installable** — register the repo as a HACS frontend integration so users can install via the store instead of `git clone`.
