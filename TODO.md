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

### Matter / smart-home protocol stance
- Audit which devices in the setup support Matter (Hue Bridge does, Lutron doesn't, Levoit/Dreo no). Where possible, prefer Matter-native pairing over plugin bridges to reduce moving parts. Casa Control already speaks to Homebridge generically — Matter support would route through Homebridge's Matter bridge or via a dedicated Matter controller. Discuss separately: does the Pi run a Matter controller? If so, can Casa Control query it directly without Homebridge in the middle?

### Aqara
- **Patch `homebridge-plugin-aqara` for Homebridge v2 compatibility.** Plugin (v0.1.0 by @baranwang) fails to load with `Package subpath './lib/logger' is not defined by "exports"` — uses HB v1 internal API paths that v2 removed. Plan: fork the repo, replace internal imports with the public homebridge API (logger comes in via the platform constructor), install the patched version locally, send PR upstream. Estimate 30 min – 2 hr depending on how many internal imports there are. If it cascades, fall back to the Zigbee2MQTT route ($25 USB stick + homebridge-z2m).

### Infra
- **Upgrade Node.js to v24 LTS** on the Pi to match Homebridge v2's recommendation. Currently v22.20.0 works fine but Homebridge logs a warning. Run `sudo hb-service update-node` then reboot. Do it on a quiet day in case a plugin misbehaves on the new major.

### HomeKit ↔ Casa Control sync (deferred)
- HomeKit rooms live on Apple devices, not in Homebridge. Casa Control would need to be a HAP controller (read pairings, query rooms) to sync. Significant project — only worth it if maintaining rooms in two places becomes painful.
