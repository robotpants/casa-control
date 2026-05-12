# Casa Control iOS — Setup Guide (Beginner)

End-to-end walkthrough for getting the iOS app running on your iPhone, starting from "I have a Mac and the repo cloned." Follow in order; nothing here assumes prior Xcode experience.

**Time estimate:** 45–60 min the first time, mostly waiting for Xcode and downloads.

---

## Part 0 — Prerequisites

You need:

- A **Mac** running macOS 14 (Sonoma) or newer.
- **Xcode 15+** from the Mac App Store. It's a ~10 GB download — start it now if you haven't.
- An **Apple ID** signed into Xcode. A free Apple ID is enough to build to your own iPhone, but **HomeKit requires a paid Apple Developer account** ($99/year). Sign up at <https://developer.apple.com/programs> if you haven't already. Builds without it will fail at the HomeKit capability step.
- An **iPhone** signed into the same iCloud account as your HomeKit home, with a USB-C/Lightning cable.
- The repo cloned to your Mac, on branch `claude/homekit-direct-integration-97f0D`:
  ```bash
  git clone https://github.com/robotpants/casa-control.git
  cd casa-control
  git checkout claude/homekit-direct-integration-97f0D
  ```

---

## Part 1 — Create the Xcode project

The repo only contains Swift source files. Xcode generates a `.xcodeproj` (project metadata) which we keep local because it's auto-generated and hand-editing it is painful.

1. Open **Xcode** → **File** → **New** → **Project…**
2. In the template picker, choose **iOS** (top tab) → **App** → **Next**.
3. Fill in the fields exactly:
   - **Product Name:** `CasaControl`
   - **Team:** select your Apple ID (or "Add an Account…" if none listed).
   - **Organization Identifier:** anything reverse-DNS, e.g. `com.yourname` — this combines with the product name to form the bundle ID (`com.yourname.CasaControl`). Write this down; Spotify will need it.
   - **Interface:** **SwiftUI** (important — must match).
   - **Language:** **Swift**.
   - **Storage:** **None**.
   - Leave **Include Tests** unchecked.
4. Click **Next**. In the save dialog, navigate to your cloned repo's `ios/` folder and **save it there**. Result: `casa-control/ios/CasaControl.xcodeproj` and `casa-control/ios/CasaControl/`.
5. Xcode opens the new project. You'll see two auto-generated files in the left sidebar:
   - `CasaControlApp.swift`
   - `ContentView.swift`

   **Delete both.** Right-click each → **Delete** → **Move to Trash**. (Our repo provides replacements with the same name for `CasaControlApp.swift`.)

---

## Part 2 — Add the repo's source files to the project

The Swift files are already on disk under `ios/CasaControl/`, but Xcode doesn't know about them yet. Adding them is drag-and-drop.

1. In **Finder**, open `casa-control/ios/CasaControl/`. You'll see folders: `Services/`, `Theme/`, `Views/`, plus `CasaControlApp.swift` and `HomeStore.swift`.
2. Switch to Xcode. In the left sidebar (Project Navigator), you should see a **CasaControl** folder (yellow icon).
3. Select **all** items in the Finder window (`⌘A`) and drag them onto the **CasaControl** folder in Xcode's sidebar.
4. A dialog appears. Set:
   - **Destination:** **leave "Copy items if needed" UNCHECKED** — the files already live in the repo, we don't want duplicates.
   - **Added folders:** select **Create groups** (not "Create folder references").
   - **Add to targets:** check **CasaControl**.
5. Click **Finish**. Your sidebar should now show `Services`, `Theme`, `Views` folders plus the two top-level Swift files.

> If you accidentally created folder references (blue folder icons) instead of groups (yellow), delete them and redo step 3.

**Sanity check:** press `⌘B` to build. It will fail with errors about HomeKit — that's expected; we add the capability next.

---

## Part 3 — Add capabilities

This is what unlocks HomeKit access.

1. In the sidebar, click the **CasaControl** project (very top, blue icon).
2. In the center pane, select the **CasaControl** target (under "TARGETS").
3. Click the **Signing & Capabilities** tab.
4. Verify **Team** is set to your Apple ID. If it says "None," click the dropdown and pick yours.
5. Click **+ Capability** (top-left of the tab).
6. Search for **HomeKit** and double-click it. A "HomeKit" section appears in the list.

**If you see a red error** at the Team field saying you need a paid developer account: that's because HomeKit is a restricted entitlement. You must enroll in the Apple Developer Program ($99/yr). Personal Team accounts cannot ship HomeKit apps.

---

## Part 4 — Configure Info.plist keys

These tell iOS why we're asking for HomeKit access and register a URL scheme for the Spotify auth callback.

1. Still on the **CasaControl** target, click the **Info** tab.
2. You'll see a list of **Custom iOS Target Properties**. Hover over any row, click the **+** button that appears.
3. Add this key — type it exactly:
   - **Key:** `Privacy - HomeKit Usage Description`
   - **Type:** String
   - **Value:** `Casa Control uses HomeKit to display and control your home.`
4. Now add the URL scheme for Spotify auth callback:
   - Click **+** again.
   - **Key:** `URL types` → expand it.
   - Under **Item 0**, set:
     - **URL identifier:** `com.yourname.CasaControl` (use your bundle ID)
     - **URL Schemes** → **Item 0:** `casacontrol`

That's it for Info.plist for now. Fonts go in here too — see Part 6.

---

## Part 5 — Set the deployment target

The code uses iOS 17 APIs.

1. Project sidebar → **CasaControl** project → **CasaControl** target → **General** tab.
2. Under **Minimum Deployments**, set **iOS** to **17.0** (or higher).

Press `⌘B` again to build. You should now get a clean build (or a few warnings, no errors). If you get errors, jump to **Troubleshooting** at the bottom.

---

## Part 6 — Add fonts (optional but recommended)

Without these the app falls back to system fonts. It works but won't match the Smartmorphic style.

1. In Finder, open `casa-control/public/fonts/`. You'll see:
   - `DMSans-VariableFont_opsz_wght.ttf`
   - `DMSans-Italic-VariableFont_opsz_wght.ttf`
   - `JetBrainsMono-VariableFont_wght.ttf`
   - `JetBrainsMono-Italic-VariableFont_wght.ttf`
2. Download **Outfit** from Google Fonts: <https://fonts.google.com/specimen/Outfit> → Get Font → Download → unzip → find `Outfit-VariableFont_wght.ttf`.
3. Drag all 5 `.ttf` files onto the **CasaControl** folder in Xcode's sidebar. In the dialog:
   - **Copy items if needed:** ✅ checked (these aren't in the repo for Outfit; copying keeps the project portable).
   - **Add to targets:** ✅ CasaControl.
4. Now register them. Target → **Info** tab → **+** → search for **Fonts provided by application** → add it as an array. For each font file, add an item with the **filename** (e.g. `DMSans-VariableFont_opsz_wght.ttf`).

**If the app builds but text looks like system font, the PostScript names don't match.** Open **Font Book** on the Mac, find each font, note the exact PostScript name shown in the info panel, and update `Theme.FontFamily` in `Theme/Theme.swift` (currently `"DMSans-Regular"`, `"Outfit-Regular"`, `"JetBrainsMono-Regular"`). Save, rebuild.

---

## Part 7 — Configure Spotify (optional, only if you want the Music tab)

Skip this if you don't care about Spotify yet — the rest of the app works without it; the Music tab will just show a "set client ID" message.

1. Go to <https://developer.spotify.com/dashboard> and sign in.
2. Click **Create app**. Fill in:
   - **App name:** Casa Control (or whatever)
   - **App description:** anything
   - **Redirect URI:** `casacontrol://spotify-callback` (must match exactly — copy-paste this)
   - **APIs:** check **Web API**
3. Save. On the app's dashboard, click **Settings**. Copy the **Client ID** (long alphanumeric string).
4. In Xcode, open `Services/SpotifyClient.swift`. Near the top, find:
   ```swift
   static let clientID = ""
   ```
   Paste your client ID between the quotes. Save.

---

## Part 8 — Build to your iPhone

The Simulator can't pair with real HomeKit accessories, so you have to run on a physical device.

1. Plug your iPhone into the Mac with a cable. The first time, the phone may show "Trust This Computer?" — tap **Trust** and enter your passcode.
2. In Xcode's top toolbar, click the **device selector** (next to the scheme name, currently says something like "iPhone 15 Pro" simulator). Choose your physical iPhone from the list.
3. Press the **▶ Play** button (or `⌘R`).
4. Xcode will:
   - Compile the app (~30s first time).
   - Install it on the iPhone.
   - Launch it.

**First-run iPhone prompts:**

- iOS may say **"Untrusted Developer."** On the iPhone: **Settings** → **General** → **VPN & Device Management** → tap your Apple ID under "Developer App" → **Trust**. Then tap the app icon to launch it.
- On launch, iOS shows a HomeKit permission prompt. Tap **Allow**.
- The Home tab should populate with your rooms and accessories within a few seconds.

> **Free account caveat:** if you're on a free Apple Developer account, the build expires after **7 days**. After that, the app won't launch until you rebuild from Xcode. Paid accounts get 1-year expiry.

---

## Part 9 — Connect Homebridge

1. Open the app on your iPhone, tap the **Bridge** tab.
2. Tap **Configure**.
3. Fill in:
   - **Host:** your Pi's LAN IP (e.g. `192.168.1.50`) or hostname (e.g. `homebridge.local`).
   - **Port:** `8581` (default for homebridge-config-ui-x).
   - **TLS:** off unless you've explicitly enabled HTTPS on the Homebridge UI.
   - **Username / Password:** your Homebridge admin login (the one you use at `http://homebridge.local:8581` in a browser).
4. Tap **Sign in**. You should land on the server status view with CPU/RAM/uptime tiles.

---

## Part 10 — Connect Spotify

Only if you finished Part 7.

1. Open the app, tap **Music**.
2. Tap **Sign in with Spotify**.
3. A web sheet appears — sign in, approve the requested scopes.
4. The sheet closes; if a song is currently playing on any of your Spotify Connect devices, the now-playing card appears within 5 seconds.

If you tap play/pause and nothing happens: open the Spotify app on any device (phone/desktop/speaker), start a song there, then return to Casa Control. Spotify needs an active "Connect device" to target — this is a Spotify limitation, not the app.

---

## Troubleshooting

**Build error: "No such module 'HomeKit'"**
You skipped Part 3. Add the HomeKit capability.

**Build error: "Cannot find type 'SpotifyClient' in scope" (or similar for new files)**
The new file is on disk but not in the Xcode project. Drag it in (Part 2).

**Build error about provisioning profile / signing**
- Make sure Team is set on the target's Signing tab.
- Toggle **Automatically manage signing** off and back on.
- Quit Xcode, run `xcrun simctl --set previews delete all` in Terminal, reopen.

**App installs but crashes immediately**
Check Xcode's console (bottom pane, `⌘⇧Y` if hidden). The first line of a Swift crash usually says exactly what's missing — most often a missing Info.plist key (Part 4).

**HomeKit shows "No Home Found"**
- The iPhone must be signed into the same iCloud account as your home.
- You must have tapped "Allow" on the HomeKit permission prompt. If you tapped Deny, fix it: Settings → Privacy & Security → HomeKit → toggle Casa Control on.

**Spotify auth: "Spotify auth: no code in callback"**
The URL scheme isn't registered correctly. Re-check Part 4 step 4 — the scheme must be `casacontrol` (no slashes, no colon).

**Homebridge login fails**
- Confirm you can reach `http://<host>:8581` from a browser on the same Wi-Fi.
- Confirm `homebridge-config-ui-x` is installed and running (`sudo hb-service status` on the Pi).
- Username/password are the ones you set up when you first opened the Homebridge UI in a browser, NOT your macOS/iCloud password.

**Fonts not loading**
Open Font Book on Mac → find the font → copy the exact PostScript name → paste into `Theme/Theme.swift` `FontFamily`. Variable fonts often have unexpected PostScript names like `DMSans_28pt-Regular`.

---

## What "done" looks like

After all this you should be able to:

- Open the app on your iPhone.
- See your HomeKit rooms and accessories on the Home tab and toggle/dim lights.
- See Spotify now-playing and control playback on the Music tab.
- See Homebridge server health and restart child bridges on the Bridge tab.
- Manage integration connections on the Settings tab.

Anything not working past that, file an issue or open the Xcode console — most problems show their root cause in the first few lines of output.
