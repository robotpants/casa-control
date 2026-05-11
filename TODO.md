# Casa Control — TODO

## Bugs

### Watching (recently misbehaved)
- **Devices won't turn OFF** — appeared to fix itself after a casa-control systemd restart on May 8. Server-side diagnostic logging captured all PUTs returning 200 OK once the issue cleared, suggesting the bug was a stale auth token or a desynced Hue eventstream rather than a code path. Logging is still in place (`server.js` logs `wrote On=X, response shows On=Y` for every accessory write) so if it returns we can immediately see whether Homebridge accepts but doesn't apply, or fails silently. If it reproduces, that disparity tells us where to look.

## Features

### Ecobee
- Get API key from ecobee.com/developers
- Get refresh token via PIN flow
- Install `homebridge-ecobee-status` (and `homebridge-ecobee3-sensors` if room sensors)
- Wire into Casa Control rooms (it'll surface automatically once Homebridge sees it; typeMap already includes Thermostat)
- **Full thermostat UI in Casa Control**: target-temp slider, heat/cool/off mode buttons, away/home toggle. Currently only shows on/off + temp readout via the generic light-card path.

### Battery status page
- **Dedicated page listing every battery-powered device with current level.** Sort by level ascending so worst-off floats to the top. Reuse `.status-pill.battery` variants (ok/warning/alert) for visual cue. Tap a row to open the device's manage modal. Surfaces low batteries proactively instead of relying on the home-view banner (which only shows the top 3 worst). Source data is already wired up — `State.getBattery(acc)` + `State.getLowBatteryDevices()` for the "needs attention" filter, plus a "show all" mode that includes healthy batteries.

### Scenes
- **Scene support**: define + run scenes (e.g., "Movie Night" sets Living Room lights to 20% warm + turns off Office). Open questions: store locally in Casa Control (simple, no Homebridge dependency) vs. integrate with Homebridge scenes/automations (slower to set up but visible across Apple Home / other clients). Likely start local, expose as buttons on the home view.

### Matter
- **Set up a Matter controller on the Pi** — current state: Pi runs no Matter controller (confirmed via `systemctl` and Homebridge logs). Apple Home is the user's only Matter controller. Result: Matter devices (Aqara, future Matter-native gear) are invisible to Casa Control because nothing on the Pi can see them. Three viable paths, ranked:
  1. **Home Assistant Matter Server in Docker** (most realistic now). `ghcr.io/home-assistant-libs/python-matter-server`. Apple Home shares each Matter device to it via multi-admin. Casa Control would then need a small client to query it (or a Homebridge plugin to bridge it).
  2. **Homebridge v2 native Matter controller mode** when stable. Cleanest because Casa Control's existing pipeline picks everything up automatically.
  3. **Casa Control speaks Matter directly** (`@project-chip/matter.js`). Architecturally cleanest, biggest build.
- Once a controller exists: Matter devices can be added to **both** Apple Home and Casa Control via Matter multi-admin sharing. Each controller gets independent control; nothing is exclusive.
- Audit existing devices for Matter support (Hue Bridge supports it; Lutron doesn't; Levoit/Dreo don't) so we know which ones could move off plugin bridges once the controller is in place.

### Aqara
- **Patch `homebridge-plugin-aqara` for Homebridge v2 compatibility.** Plugin (v0.1.0 by @baranwang) fails to load with `Package subpath './lib/logger' is not defined by "exports"` — uses HB v1 internal API paths that v2 removed. Plan: fork the repo, replace internal imports with the public homebridge API (logger comes in via the platform constructor), install the patched version locally, send PR upstream. Estimate 30 min – 2 hr depending on how many internal imports there are. If it cascades, fall back to the Zigbee2MQTT route ($25 USB stick + homebridge-z2m).

### Infra
- **Upgrade Node.js to v24 LTS** on the Pi to match Homebridge v2's recommendation. Currently v22.20.0 works fine but Homebridge logs a warning. Run `sudo hb-service update-node` then reboot. Do it on a quiet day in case a plugin misbehaves on the new major.

### HomeKit ↔ Casa Control sync (deferred)
- HomeKit rooms live on Apple devices, not in Homebridge. Casa Control would need to be a HAP controller (read pairings, query rooms) to sync. Significant project — only worth it if maintaining rooms in two places becomes painful.
