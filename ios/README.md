# Casa Control — iOS (HomeKit)

Native SwiftUI app that talks to HomeKit directly. Sits alongside the existing
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
   repo) into the Xcode project navigator — check "Copy items if needed" OFF,
   "Create groups", and add to the `CasaControl` target.
3. Signing & Capabilities → **+ Capability → HomeKit**.
4. Info tab → add key **Privacy - HomeKit Usage Description** with a value
   like `Casa Control uses HomeKit to display and control your home.`
5. Deployment target: iOS 17+ (uses observation-friendly SwiftUI patterns).
6. Build & run on a real device signed into the same iCloud account as your
   Home. The Simulator can't pair real accessories.

## What's here

- `CasaControlApp.swift` — app entry, injects the `HomeStore`.
- `HomeStore.swift` — `HMHomeManager` wrapper as an `ObservableObject`.
  Tracks the primary home, accessories, and republishes when characteristics
  change.
- `Views/HomeView.swift` — accessory list grouped by room.
- `Views/AccessoryRow.swift` — power toggle + brightness for lights; readout
  for everything else. Starting point — extend per service type.

## Next steps (intentionally not built yet)

- Scene runner backed by `HMActionSet`.
- Custom dashboards / favorites stored in `AppStorage` or CloudKit.
- History/logging (HomeKit stores none — write characteristic updates to
  SQLite or CloudKit).
- Widgets + Live Activities.
- Optional direct calls to the Homebridge/Casa Control server for features
  HomeKit can't model (rich JSON state, charts, etc.).
