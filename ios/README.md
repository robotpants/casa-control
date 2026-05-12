# Casa Control — iOS (HomeKit)

Native SwiftUI app that talks to HomeKit directly, styled to match the
Smartmorphic design system used by the existing web app. Sits alongside the
Node/Homebridge stack: Homebridge keeps adapting non-HomeKit devices (Hue,
Lutron, Ecobee, etc.); this app consumes them as normal `HMAccessory`s plus
adds custom UI/features on top.

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

## File layout

```
ios/CasaControl/
  CasaControlApp.swift       app entry
  HomeStore.swift            HMHomeManager wrapper
  Theme/
    Theme.swift              tokens (colors, fonts, radii, spacing, shadows)
    Neumorphic.swift         raised/pressed modifiers + IconWell
    NeuToggleStyle.swift     custom Toggle style
    NeuSlider.swift          custom slider (accent/brightness/temp variants)
    Primitives.swift         SectionLabel, SceneChip, StatusPill
  Views/
    HomeView.swift           top-level (header + rooms)
    AccessoryRow.swift       light-card pattern with expandable brightness
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
