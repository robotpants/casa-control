# Casa Control — TODO

## Theme — Phase 2

Custom Lovelace cards (Lit web components) for the highest-traffic surfaces. The `--smartmorphic-*` CSS variables in `ha/themes/smartmorphic.yaml` are already in place for these to consume.

- **Room card** (highest priority — most visible). Renders a room name, ambient temp, on-count for lights, with a tap_action to navigate to a room detail view. Matches `.room-card` from the legacy CSS (large icon well, active dot with glow, pressed-on look).
- **Light card** with expandable controls — matches `.light-card` (icon well + name + status + toggle, expandable brightness slider with `.brightness` gradient fill).
- **Scene chip strip** — horizontal scrollable row of scene buttons. Active chip = pressed-inset + ember text + chip dot glow.
- **Status pill** — semantic colored pill for inline state badges.
- **Master row** — full-width "master light" / room-level toggle row.

## Theme — Phase 3 (polish)

- **More-info dialog redesign** — replace HA's default expanded entity sheet with a custom Lit component (currently card-mod re-shadows it; full replacement gives layout control).
- **Energy dashboard restyle** — HA's energy view has internal layouts that resist card-mod. Targeted styling pass once we have a routine of using it.
- **Self-hosted fonts variant of `smartmorphic-fonts.js`** — `@font-face` declarations pointing at `/local/fonts/` instead of Google Fonts CDN.

## HA setup follow-ups

- **HACS install** if not already done — required for card-mod + Mushroom.
- **Install card-mod and Mushroom** via HACS. Without these the theme works at ~60% fidelity; with them ~90%.
- **Apply the starter dashboard** (`ha/dashboards/smartmorphic-starter.yaml`) and replace `REPLACE_ME` entity IDs.
- **HomeKit Bridge integration** — if exposing HA back to Apple Home: enable in Settings → Devices & Services → Add Integration → HomeKit Bridge. Pair on iPhone via Home app.

## Migration cleanup

- **Confirm Apple Home rooms re-assigned** after the Homebridge → HA cutover (all accessories show under correct rooms; scenes/automations migrated).
- **Decommission old Homebridge install** on the Pi once HA has run clean for a week (`sudo hb-service uninstall` if still installed).

## Deferred / nice-to-have

- **Spotify card / dashboard surface** — HA has a built-in Spotify integration and a `media_player` card. Replaces what the iOS app would have done. Worth adding to the dashboard once the theme is live.
- **Per-room detail views** — duplicate the "Living Room" view in the starter dashboard for each room with its own entity set.
- **Mobile-first dashboard** — Mushroom is responsive but the `max_columns: 3` setting in the starter is desktop-oriented. Consider a separate `casa-mobile` dashboard if the experience differs enough.

---

## Archived branches

Reference state preserved on long-lived branches; not actively maintained.

- `archive/web-app-pre-ios` — original Node/Express + Homebridge web app, pre-iOS-pivot state.
- `archive/ios-homekit-app` — native SwiftUI HomeKit app + Spotify + Homebridge admin client (pre-HA-pivot state). Includes `ios/SETUP.md` walkthrough.
