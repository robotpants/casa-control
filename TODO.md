# Casa Control — TODO

## Bugs
- **Master Bedroom TV Light**: state mismatch (UI shows off when light is on) and can't turn off via toggle. Likely Hue plugin reporting stale state. Console showed no errors. Fire-and-forget toggle didn't fix it. Needs Network-tab inspection of the PUT request.
- **Pico bundling pulled lights out of Lutron-switch rooms**: when serial-number-based grouping landed, lights driven by Lutron switches (Caseta) seem to have been re-keyed to a different primary uniqueId and the room migration didn't carry them across. Diagnose via the device debug panel — compare a missing light's `sn` / `aid` fields before and after.

## Features

### Ecobee
- Get API key from ecobee.com/developers
- Get refresh token via PIN flow
- Install `homebridge-ecobee-status` (and `homebridge-ecobee3-sensors` if room sensors)
- Wire into Casa Control rooms (it'll surface automatically once Homebridge sees it; typeMap already includes Thermostat)
- **Full thermostat UI in Casa Control**: target-temp slider, heat/cool/off mode buttons, away/home toggle. Currently only shows on/off + temp readout via the generic light-card path.

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

### Home Assistant migration path (opportunistic)
- **Why this is on the radar:** Homebridge's plugin ecosystem is volunteer-run and thin in places. Plugins for niche devices (current pain: `homebridge-plugin-aqara` broken on HB v2, author MIA) tend to rot. HA has ~1,300 first-party core integrations, paid maintainers via Nabu Casa, and HACS as a fallback for the long tail. For sustainability over 5+ years, HA's integration layer is the safer bet.
- **Strategy:** don't migrate, *coexist*. HA runs alongside Homebridge on the Pi (or in Docker). The iOS app still consumes only HomeKit, so the swap is invisible to it.
- **Architecture once both are running:**
  - HA's `HomeKit Bridge` integration exposes HA entities as HomeKit accessories.
  - Devices stay on whichever bridge handles them better.
  - Casa Control sees a unified HomeKit world; doesn't know or care which bridge a device came from.
- **Migration triggers (move a device when one of these hits):**
  1. Its Homebridge plugin breaks and the author isn't responsive (Aqara today).
  2. HA has a clearly better integration (more entities exposed, better state modeling).
  3. The device is Matter-native and Homebridge v2 native Matter isn't ready yet (covered by the Matter section above).
- **Setup steps (when ready):**
  1. Install HA OS or HA Container on the Pi. HA Container (Docker) is lightest — `ghcr.io/home-assistant/home-assistant:stable`.
  2. Add integrations for the devices being migrated.
  3. Enable HA's `HomeKit Bridge` integration → pair it to Apple Home (separate pairing from Homebridge — they're two distinct HomeKit bridges).
  4. Remove the corresponding Homebridge plugin so the same device isn't double-bridged.
  5. Verify in Casa Control that the device still appears and works.
- **What stays on Homebridge indefinitely:** HomeKit-flavored stuff where Homebridge's ecosystem is stronger — HKSV camera plugins, Pico-remote scene exposure, Shortcuts trigger fakes, anything where the plugin was clearly written by/for HomeKit users.
- **What this unlocks beyond plugin sustainability:** HA's recorder gives free historical data (sensor history, energy graphs) — could replace the "build our own logger" item if we ever want history features in Casa Control. HA also gets us a real automation engine for server-side rules that don't depend on the phone being home.
