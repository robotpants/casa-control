# Casa Control — Home Assistant

Smartmorphic design system applied to Home Assistant. Phase 1 ships the
**theme** (colors, fonts, shadows, radii via HA's theming system). Later
phases add **custom Lovelace cards** so the neumorphic single-surface look
extends to every card on a dashboard.

## What you get in Phase 1 (theme only)

- All HA UI surfaces (cards, sidebar, app header, dialogs) recolored to the
  Smartmorphic palette in both light and dark modes.
- DM Sans / Outfit / JetBrains Mono fonts loaded for the entire frontend.
- HA cards re-shadowed with the paired light/dark neumorphic recipe (no
  fill differentiation, depth via shadow only).
- Ember accent (`#e8653a`) on active states, switches, sliders, focus.
- Custom CSS variables (`--smartmorphic-neu-raised`, `--smartmorphic-accent-glow`,
  etc.) exposed for future custom-card work in Phase 2.

**What it won't do:** restructure HA's built-in card layouts. Cards like
Entities, Tile, and Glance will look themed but not Smartmorphic. That's
Phase 2 (custom Lovelace cards). For best Phase-1 results pair this with
**Mushroom cards** (install via HACS) — Mushroom respects most of these
variables and gets close to the target look without custom code.

## Install

These steps assume HA OS or HA Container running, with file access via the
**Samba**, **File Editor**, or **Studio Code Server** add-ons.

### 1. Drop the theme file in

Copy `ha/themes/smartmorphic.yaml` to:

```
config/themes/smartmorphic.yaml
```

If the `themes/` directory doesn't exist yet, create it.

### 2. Drop the font loader in

Copy `ha/www/smartmorphic-fonts.js` to:

```
config/www/smartmorphic-fonts.js
```

The `www/` directory is served at `/local/` by HA.

### 3. Register the theme and font loader in `configuration.yaml`

Edit `config/configuration.yaml` and add (or merge with your existing
`frontend:` block):

```yaml
frontend:
  themes: !include_dir_merge_named themes
  extra_module_url:
    - /local/smartmorphic-fonts.js
```

If you already have a `frontend:` block, just add the `extra_module_url`
list to it. The `themes:` line you may already have.

### 4. Restart Home Assistant

**Settings → System → Restart Home Assistant.** (Just reloading themes is
not enough — `extra_module_url` requires a full restart.)

### 5. Activate the theme

After restart:

- **Profile** (bottom-left avatar) → scroll to **Themes** → select
  **Smartmorphic**.
- Below that, set **Theme mode** to **Auto** so it follows your OS
  light/dark preference. (Or pin to one mode.)

You should see the UI recolor immediately. If fonts still look like the
default (Roboto), hard-refresh the browser (`Cmd+Shift+R` / `Ctrl+Shift+R`)
to clear the cached frontend.

## Troubleshooting

**Theme doesn't appear in the dropdown**
- The YAML is malformed. HA logs the parse error: **Settings → System →
  Logs**, filter for "themes."
- The `themes:` line is missing from `configuration.yaml`.

**Fonts look like Roboto (HA default)**
- Hard-refresh the browser to clear cached frontend (`Cmd+Shift+R`).
- Confirm `/local/smartmorphic-fonts.js` loads — open the browser console
  on any HA page, you should NOT see a 404 for that file.
- Confirm `extra_module_url` was set and HA was fully **restarted** (not
  just config-reloaded).

**Cards still have white backgrounds**
- A custom card (HACS-installed) may be ignoring `ha-card-background`. Most
  Mushroom cards respect it; some older custom cards don't. Use card-mod or
  switch the card type.

**Shadows look wrong / hard edges**
- Some cards stack `ha-card` inside other containers that clip overflow.
  This is a known HA quirk; will be addressed by custom cards in Phase 2.

## Hosting fonts locally (optional)

If you'd rather not depend on Google Fonts CDN (privacy, offline use):

1. Download the variable-font TTFs:
   - `DMSans-VariableFont_opsz_wght.ttf` (already in this repo at
     `public/fonts/`)
   - `JetBrainsMono-VariableFont_wght.ttf` (also in `public/fonts/`)
   - `Outfit-VariableFont_wght.ttf` — download from
     <https://fonts.google.com/specimen/Outfit>
2. Copy all three to `config/www/fonts/`.
3. Replace the contents of `smartmorphic-fonts.js` with `@font-face`
   declarations pointing at `/local/fonts/<filename>.ttf`. Ask and I can
   generate the replacement.

## What's next (Phase 2+)

- Custom Lovelace cards (Lit web components) for room card, light card,
  scene chip, status pill — replacing HA's built-ins where the neumorphic
  shape matters most.
- A starter dashboard YAML that lays out the cards in the Casa Control idiom
  (home greeting, room grid, status tiles).
- Eventually: every dashboard surface uses Smartmorphic cards exclusively,
  no HA built-ins in active flows.

The custom CSS variables in `themes/smartmorphic.yaml`
(`--smartmorphic-neu-raised`, etc.) are already in place so Phase 2 cards
can reference them without redefining the design tokens.
