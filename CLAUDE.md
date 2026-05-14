## Workflow

- Commit directly to `main`. Do not create feature branches or pull requests.
- Push straight to `origin main` after each commit.

## What this repo is

Smartmorphic design system applied to Home Assistant. Three deliverables:

1. `themes/smartmorphic.yaml` — HA theme YAML (light + dark) with full token coverage plus card-mod CSS injection for card internals.
2. `www/smartmorphic-fonts.js` — runtime font loader (DM Sans / Outfit / JetBrains Mono via Google Fonts), referenced by HA's `extra_module_url`.
3. `dashboards/smartmorphic-starter.yaml` — template Lovelace dashboard showcasing the theme via Mushroom cards.

User runs HA OS on a Raspberry Pi. The repo is cloned to `/config/smartmorphic-ha` and the two assets are symlinked into `/config/themes/` and `/config/www/` so `git pull` is the only update step.

## Phase 2 plan

Custom Lovelace cards (Lit web components) for room card, light card, scene chip, status pill. They'll consume the `--smartmorphic-*` CSS variables defined in the theme.
