# Casa Control — iOS (HomeKit) — ARCHIVED

> **Status: archived.** This iOS app was built on top of HomeKit + Homebridge.
> The project pivoted away from Homebridge to Home Assistant as the integration
> layer, and from a native iOS app to a Smartmorphic-themed HA frontend (see
> `../ha/`). This directory is preserved as reference and is not actively
> maintained.
>
> The full pre-archive working state is preserved on the
> `archive/ios-homekit-app` branch. If you want to revive this, branch from
> there.

---

Native SwiftUI app that talks to HomeKit directly, styled to match the
Smartmorphic design system used by the existing web app. Sits alongside the
Node/Homebridge stack: Homebridge keeps adapting non-HomeKit devices (Hue,
Lutron, Ecobee, etc.); this app consumes them as normal `HMAccessory`s plus
adds custom UI/features on top.

> **New to Xcode?** Use [`SETUP.md`](./SETUP.md) instead — it's a beginner-focused step-by-step from "I have a Mac" to "the app runs on my iPhone." The terse version below assumes you've shipped an iOS app before.

## One-time setup on the Mac

1. Open Xcode → File → New → Project → **iOS App**.
   - Product Name: `CasaControl`
   - Interface: SwiftUI
   - Language: Swift
   - Save it *inside* this `ios/` directory (so the `.xcodeproj` lives at
     `ios/CasaControl.xcodeproj` next to this README).
2. Delete the auto-generated `ContentView.swift` and `CasaControlApp.swift`
   that Xcode created. Then drag the files under `ios/CasaControl/` (this
   repo) into the Xcode project navigator — "Copy items if needed" OFF,
   "Create groups", and add to the `CasaControl` target.
3. **Signing & Capabilities** → **+ Capability → HomeKit**.
4. **Info** tab → add key **Privacy - HomeKit Usage Description** with a value
   like `Casa Control uses HomeKit to display and control your home.`
5. **Deployment target:** iOS 17+.
6. Build & run on a real device signed into the same iCloud account as your
   Home. The Simulator can't pair real accessories.

## Fonts

The Smartmorphic system uses DM Sans (body), Outfit (display), JetBrains Mono.
Two of the three are already bundled at `public/fonts/` for the web app — pull
them in:

1. Drag these files into the Xcode project (target: `CasaControl`):
   - `public/fonts/DMSans-VariableFont_opsz_wght.ttf`
   - `public/fonts/DMSans-Italic-VariableFont_opsz_wght.ttf`
   - `public/fonts/JetBrainsMono-VariableFont_wght.ttf`
   - `public/fonts/JetBrainsMono-Italic-VariableFont_wght.ttf`
2. Download Outfit from Google Fonts and add `Outfit-VariableFont_wght.ttf` the
   same way.
3. In **Info** tab, add an array key **Fonts provided by application** with
   each filename listed.
4. The PostScript names referenced in `Theme.FontFamily` are `DMSans-Regular`,
   `Outfit-Regular`, `JetBrainsMono-Regular`. If the variable-font PostScript
   names differ on your system, open Font Book and update `Theme.FontFamily`
   accordingly — SwiftUI falls back to system fonts when a name is missing, so
   the app still runs; it just won't look right.

## Theme + dark mode

`Theme.swift` defines all tokens (colors, fonts, radii, spacing). Colors are
`UIColor(dynamicProvider:)` so they swap automatically with the system
light/dark setting — no manual `colorScheme` toggle needed.

The three depth levels from the CSS spec are exposed as view modifiers:

```swift
.neuRaised()       // primary cards
.neuRaisedSm()     // small chips / buttons
.neuRaisedLg()     // hero cards
.neuPressed()      // recessed wells
.neuPressedSm()    // small inset (icon wells, slider tracks)
```

Plus components: `IconWell`, `SectionLabel`, `SceneChip`, `StatusPill`,
`NeuSlider`, and `NeuToggleStyle` (apply with `.toggleStyle(NeuToggleStyle())`).

## Spotify integration

Pure Web API + OAuth PKCE — no `SpotifyiOS.framework` dependency. Playback
control requires **Spotify Premium** with an active Connect device on the
network; now-playing reads work on free accounts.

1. Create an app at <https://developer.spotify.com/dashboard>.
2. Add a redirect URI: `casacontrol://spotify-callback` (must match exactly).
3. Open `ios/CasaControl/Services/SpotifyClient.swift` and set
   `SpotifyConfig.clientID` to your client ID.
4. In Xcode → Info tab → **URL Types** → add a new entry with URL Schemes =
   `casacontrol`. (This is what lets the auth callback come back to the app.)
5. Build & run, tap **Music** tab → **Sign in with Spotify**.

## Homebridge admin

Talks to `homebridge-config-ui-x`'s REST API (the universal admin UI plugin —
default port 8581). No extra setup on the Pi if you already use that UI in a
browser.

1. Tap the **Bridge** tab → **Configure**.
2. Enter the Pi's LAN IP/hostname + port (default 8581) + TLS toggle.
3. Sign in with your Homebridge UI admin username/password (stored in
   Keychain).
4. The view shows server status (CPU/RAM/uptime), child bridges with restart
   buttons, installed plugins (with update indicators), and a live tail of
   recent logs.

> Note: this is read/admin functionality only — actual device control still
> goes through HomeKit. The Bridge tab is for "is everything healthy?" and
> "restart the Hue child bridge" workflows.

## File layout

```
ios/CasaControl/
  CasaControlApp.swift       app entry
  HomeStore.swift            HMHomeManager wrapper
  Services/
    Keychain.swift           generic password helper
    SpotifyClient.swift      OAuth PKCE + Web API
    HomebridgeClient.swift   config-ui-x REST client
  Theme/
    Theme.swift              tokens (colors, fonts, radii, spacing, shadows)
    Neumorphic.swift         raised/pressed modifiers + IconWell
    NeuToggleStyle.swift     custom Toggle style
    NeuSlider.swift          custom slider (accent/brightness/temp variants)
    Primitives.swift         SectionLabel, SceneChip, StatusPill
    BottomNav.swift          bottom tab bar
  Views/
    RootView.swift           tab container
    HomeView.swift           top-level (header + rooms)
    AccessoryRow.swift       light-card pattern with expandable brightness
    MusicView.swift          Spotify connect + now-playing
    HomebridgeView.swift     server admin (status, child bridges, plugins, logs)
    SettingsView.swift       integrations + about
```

## Next steps (intentionally not built yet)

- Room cards (`.room-card`) + room detail view with master row.
- Scene runner backed by `HMActionSet`, presented as `SceneChip`s.
- Bottom nav / side rail (responsive switch at 768pt).
- Status tiles (4-up KPI grid) on a home dashboard.
- Custom dashboards / favorites stored in `AppStorage` or CloudKit.
- History/logging (HomeKit stores none — write characteristic updates to
  SQLite or CloudKit).
- Widgets + Live Activities.
- Optional direct calls to the Homebridge/Casa Control server for features
  HomeKit can't model.
