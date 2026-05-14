# Casa Control — Home Assistant

Smartmorphic design system applied to Home Assistant. Ships as:

- **A theme** — colors, fonts, shadows, radii via HA's theming system. Light + dark with full OS auto-follow.
- **card-mod CSS injection** — pushes the neumorphic look *into* card internals (icon wells, dividers, buttons, dialogs), not just card surfaces.
- **Mushroom card token overrides** — Mushroom is the recommended card library; this theme tunes its `--mush-*` variables to Smartmorphic exactly.
- **A starter dashboard YAML** — drop-in template with a Casa-shaped layout (greeting, scene chips, status tiles, room grid, room detail view).

## Recommended install (for the dope look)

The theme works standalone, but two HACS frontend modules unlock the full visual fidelity. Install them first, then come back here.

1. **HACS** — if you don't have it already: <https://hacs.xyz/docs/use/download/download/>.
2. After HACS is up, in HA: **HACS → Frontend → Explore & download repositories**, install:
   - **Mushroom** (by piitaya) — modern card pack the theme is tuned for.
   - **card-mod** (by thomasloven) — CSS injector. Without this, the theme still works but only colors/fonts/card-shadows take effect — internals stay default.
3. Restart HA after installing both.

## Install the theme

Assumes HA OS or Container with file access via Samba, File Editor, or Studio Code Server add-on.

### 1. Drop in the files

| Source (this repo)                 | Destination (HA config)              |
| ---------------------------------- | ------------------------------------ |
| `ha/themes/smartmorphic.yaml`      | `config/themes/smartmorphic.yaml`    |
| `ha/www/smartmorphic-fonts.js`     | `config/www/smartmorphic-fonts.js`   |

Create the `themes/` directory if it doesn't exist.

### 2. Register in `configuration.yaml`

Add (or merge into your existing `frontend:` block):

```yaml
frontend:
  themes: !include_dir_merge_named themes
  extra_module_url:
    - /local/smartmorphic-fonts.js
```

### 3. Restart HA

**Settings → System → Restart Home Assistant.** A full restart is required because `extra_module_url` doesn't pick up on a config reload alone.

### 4. Activate

- **Profile** (bottom-left avatar) → scroll to **Themes** → select **Smartmorphic**.
- Set **Theme mode** to **Auto** so it follows your OS light/dark setting.

Hard-refresh the browser (`Cmd+Shift+R` / `Ctrl+Shift+R`) once to clear cached frontend assets.

## Install the starter dashboard (optional)

`ha/dashboards/smartmorphic-starter.yaml` is a template dashboard built around Mushroom cards. It has placeholder entity IDs marked `REPLACE_ME` you'll need to swap.

1. In HA: **Settings → Dashboards → Add Dashboard → New dashboard from scratch**. Give it a title, an icon, and click Create.
2. Open it. Top-right kebab → **Edit dashboard**. In the editor, top-right kebab → **Raw configuration editor**.
3. Paste the entire contents of `smartmorphic-starter.yaml` over the existing YAML. Save.
4. Search the file for `REPLACE_ME` and replace each placeholder with your actual entity IDs (`light.living_room_main`, `sensor.bedroom_temperature`, etc.).
5. To make this dashboard the default: **Settings → Dashboards → click your dashboard → Set as default for all users**.

## What looks good out of the box

After install + activation:

- **Sidebar, app header, dialogs** — all Smartmorphic-themed. Sidebar selected item glows ember.
- **HA built-in cards** — surface, radius, shadow, fonts all updated. Internal layouts still HA's default.
- **Mushroom cards** — read close to perfect. Use these as your default card type for anything new.
- **Scrollbars, focus rings, more-info dialog** — restyled via card-mod.
- **Switches/sliders/toggles** — ember accent everywhere.

## Troubleshooting

**Theme doesn't appear in the dropdown**
- YAML parse error. Check **Settings → System → Logs** filtered for "themes."
- Missing `themes:` line in `configuration.yaml`.

**Fonts look default (Roboto)**
- Hard-refresh the browser.
- Open browser dev tools → Network tab → look for `smartmorphic-fonts.js`. Should be a 200 OK from `/local/smartmorphic-fonts.js`.
- Confirm `extra_module_url` is set and HA was fully **restarted** (not just config-reloaded).

**Card internals (icons, dividers) still look default**
- card-mod isn't installed, OR was installed but HA wasn't restarted after install.
- card-mod versions before 3.4 don't support the `card-mod-theme` block. Update via HACS.

**Mushroom cards look wrong**
- Mushroom version too old to recognize the latest `--mush-*` tokens. Update via HACS.

**Cards have white backgrounds inside otherwise-themed surface**
- Some custom cards bypass `ha-card-background`. Either: switch to the Mushroom equivalent, or wrap the offending card in a `card-mod` style override.

**Shadows clip at the edges of cards**
- HA's view container clips overflow on some card types. card-mod's `card-mod-view-yaml` block already loosens this; if a specific card still clips, it's a card-internal issue (Phase 2 custom cards will fix).

## Hosting fonts locally (optional, privacy)

If you don't want HA hitting Google Fonts:

1. Copy the variable-font TTFs from `ha/www/fonts/` (already bundled in this repo) to your HA `config/www/fonts/`:
   - `DMSans-VariableFont_opsz_wght.ttf`
   - `DMSans-Italic-VariableFont_opsz_wght.ttf`
   - `JetBrainsMono-VariableFont_wght.ttf`
   - `JetBrainsMono-Italic-VariableFont_wght.ttf`
2. Download `Outfit-VariableFont_wght.ttf` from <https://fonts.google.com/specimen/Outfit> and add it to `config/www/fonts/` too.
3. Replace `smartmorphic-fonts.js` with `@font-face` declarations pointing at `/local/fonts/...`. Ask and I'll generate the replacement.

## File layout

```
ha/
  themes/
    smartmorphic.yaml              theme tokens + card-mod CSS
  www/
    smartmorphic-fonts.js          font loader (extra_module_url)
    fonts/                         bundled variable-font .ttf files
                                   (only needed if self-hosting fonts)
  dashboards/
    smartmorphic-starter.yaml      template dashboard
  README.md
```

## What's next (Phase 2+)

- **Custom Lovelace cards** (Lit web components) for the highest-traffic surfaces — room card, light card, scene chip, status pill — built directly against the `--smartmorphic-*` tokens.
- **A more-info redesign** — replace HA's default expanded entity sheet with a custom Lit component.
- **Energy dashboard restyle** — HA's energy view has its own quirks; needs targeted card-mod.

When you have the theme installed and want to start Phase 2, ping me — first card I'd build is the room card.
