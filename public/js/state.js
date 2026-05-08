/* ── Casa Control · state.js ──────────────────────────
   Single source of truth for all device and room state.
   Nothing renders directly from here — UI reads State
   and calls API, then updates State on success.
   ───────────────────────────────────────────────────── */

const State = {

  // ── Raw accessory data from Homebridge ────────────
  accessories: [],

  // ── Room definitions (persisted to localStorage) ──
  rooms: [],

  // ── Favorites (persisted to localStorage) ─────────
  favorites: [],

  // ── Per-device custom display names (persisted) ───
  // Map of uniqueId → custom name. Falls back to accessory.serviceName.
  deviceNames: {},

  // ── Per-device type overrides (persisted) ─────────
  // Map of uniqueId → type string ('light', 'switch', 'fan', etc.).
  // Lets users force a switch/outlet to render as a light, etc.
  deviceTypes: {},

  // ── User preferences (persisted) ──────────────────
  prefs: {
    accent: null,                          // hex string or null = default ember
    themeMode: 'auto',                     // 'auto' | 'light' | 'dark'
    houseName: 'Casa Control',
    weatherZip: null,
    weatherLat: 34.1164,
    weatherLon: -118.3390,
    weatherCity: 'Los Angeles, CA',
  },

  // Available accent presets
  ACCENT_PRESETS: [
    { key: 'ember',  name: 'Ember',  hex: '#e8653a', glow: 'rgba(232,101,58,0.35)' },
    { key: 'amber',  name: 'Amber',  hex: '#e8b83a', glow: 'rgba(232,184,58,0.35)' },
    { key: 'green',  name: 'Green',  hex: '#3abf7a', glow: 'rgba(58,191,122,0.35)' },
    { key: 'blue',   name: 'Blue',   hex: '#3a8ee8', glow: 'rgba(58,142,232,0.35)' },
    { key: 'purple', name: 'Purple', hex: '#9b59b6', glow: 'rgba(155,89,182,0.35)' },
    { key: 'pink',   name: 'Pink',   hex: '#e84a7a', glow: 'rgba(232,74,122,0.35)' },
    { key: 'teal',   name: 'Teal',   hex: '#3abfb8', glow: 'rgba(58,191,184,0.35)' },
  ],

  // Human-readable labels for picker UI
  TYPE_LABELS: {
    light:    'Light',
    switch:   'Switch / Outlet',
    fan:      'Fan',
    purifier: 'Air Purifier',
    heater:   'Heater / Cooler',
    sensor:   'Sensor',
    remote:   'Remote',
  },

  // ── UI state ──────────────────────────────────────
  currentRoomId: null,
  editMode: false,
  isDark: window.matchMedia('(prefers-color-scheme: dark)').matches,

  // ── Battery index (aid → { level, low, charging }) ─
  // Battery accessories share the parent device's aid, so we
  // index them on load and surface inline rather than as cards.
  batteries: {},

  // ── Sibling services index (primary uid → [accessory, ...]) ─
  // Multi-button remotes (Hue Dimmer = 4 buttons) and other
  // multi-service devices show as one card with siblings tucked
  // under the primary. The aid is the physical-device identifier.
  siblings: {},

  // Type priority for picking the primary service per aid group.
  // Earlier in the list wins.
  TYPE_PRIORITY: ['light', 'switch', 'fan', 'purifier', 'heater', 'sensor', 'remote', 'unknown'],

  // ── Capability tracking ───────────────────────────
  // Characteristics Casa Control actually does something with.
  SUPPORTED_CHARS: new Set([
    'On', 'Active',
    'Brightness', 'RotationSpeed',
    'ColorTemperature', 'Hue', 'Saturation',
    'CurrentTemperature',
    'BatteryLevel', 'StatusLowBattery', 'ChargingState',
    'FilterLifeLevel',
  ]),

  // Characteristics that exist but aren't user-facing features
  // (metadata, identifiers, status flags). Skipped from the count
  // so coverage isn't artificially diluted.
  META_CHARS: new Set([
    'Identifier', 'Name', 'ConfiguredName',
    'Manufacturer', 'Model', 'SerialNumber',
    'FirmwareRevision', 'HardwareRevision', 'Version',
    'StatusFault', 'StatusActive', 'StatusTampered', 'StatusJammed',
    'IsConfigured', 'ServiceLabelIndex', 'ServiceLabelNamespace',
  ]),

  // Returns { handled: [...], missing: [...] } — only counts
  // user-facing feature characteristics (skips META).
  getCapabilities(accessory) {
    const chars = (accessory.serviceCharacteristics || []).map(c => c.type);
    const handled = [];
    const missing = [];
    const seen = new Set();
    for (const t of chars) {
      if (seen.has(t)) continue;
      seen.add(t);
      if (this.META_CHARS.has(t)) continue;
      if (this.SUPPORTED_CHARS.has(t)) handled.push(t);
      else missing.push(t);
    }
    return { handled, missing };
  },

  // ── Device type map ───────────────────────────────
  // Maps Homebridge humanType to our internal type
  // null = hidden from device list (junk, or surfaced elsewhere)
  typeMap: {
    'Lightbulb': 'light',
    'Switch': 'switch',
    'Outlet': 'switch',
    'Fan': 'fan',
    'Fanv2': 'fan',
    'Air Purifier': 'purifier',
    'Heater Cooler': 'heater',
    'Thermostat': 'heater',
    'Air Quality Sensor': 'sensor',
    'Temperature Sensor': 'sensor',
    'Humidity Sensor': 'sensor',
    'Light Sensor': 'sensor',
    'Motion Sensor': 'sensor',
    'Occupancy Sensor': 'sensor',
    'Contact Sensor': 'sensor',
    'Leak Sensor': 'sensor',
    'Smoke Sensor': 'sensor',
    'Carbon Monoxide Sensor': 'sensor',
    'Carbon Dioxide Sensor': 'sensor',
    'Stateless Programmable Switch': 'remote',
    'Programmable Switch': 'remote',
    'Battery': null,
    'Protocol Information': null,
    'Service Label': null,
  },

  // ── Default room definitions ───────────────────────
  // Maps serviceName patterns to rooms
  // Used on first load before user customizes
  defaultRoomMap: [
    { id: 'living',   name: 'Living Room',    icon: 'sofa',    devices: ['Living Room Main Lights', 'Living Room Purifier', 'Air Circulator', 'Living Room Pico', 'Living Room Purifier Air Quality'] },
    { id: 'bedroom',  name: 'Master Bedroom', icon: 'bed',     devices: ['Master Bedroom Main Lights', 'Bedroom Purifier', 'Master Bedroom Anna\'s Lamp Remote 1', 'Master Bedroom Nick’s Lamp Remote', 'Master Bedroom Main Lights Remote'] },
    { id: 'office',   name: 'Office',         icon: 'monitor', devices: ['Office Main Lights', 'Tower Fan', 'Heater', 'Office Pendant Pico'] },
    { id: 'kitchen',  name: 'Kitchen',        icon: 'chefHat', devices: ['Kitchen Under Cabinet', 'Kitchen Pico'] },
    { id: 'patio',    name: 'Patio',          icon: 'tree',    devices: ['Patio Patio Lights Remote'] },
    { id: 'garage',   name: 'Garage',         icon: 'garage',  devices: ['Garage Wall Lights'] },
  ],

  // ── Persist rooms to localStorage ─────────────────
  saveRooms() {
    try { localStorage.setItem('cc-rooms', JSON.stringify(this.rooms)); } catch(e) {}
  },

  loadRooms() {
    try {
      const saved = localStorage.getItem('cc-rooms');
      if (saved) { this.rooms = JSON.parse(saved); return true; }
    } catch(e) {}
    return false;
  },

  // ── Persist favorites to localStorage ─────────────
  saveFavorites() {
    try { localStorage.setItem('cc-favs', JSON.stringify(this.favorites)); } catch(e) {}
  },

  loadFavorites() {
    try {
      const saved = localStorage.getItem('cc-favs');
      if (saved) { this.favorites = JSON.parse(saved); }
    } catch(e) {}
  },

  // ── Persist device name overrides to localStorage ─
  saveDeviceNames() {
    try { localStorage.setItem('cc-names', JSON.stringify(this.deviceNames)); } catch(e) {}
  },

  loadDeviceNames() {
    try {
      const saved = localStorage.getItem('cc-names');
      if (saved) { this.deviceNames = JSON.parse(saved); }
    } catch(e) {}
  },

  // ── Persist device type overrides to localStorage ─
  saveDeviceTypes() {
    try { localStorage.setItem('cc-types', JSON.stringify(this.deviceTypes)); } catch(e) {}
  },

  loadDeviceTypes() {
    try {
      const saved = localStorage.getItem('cc-types');
      if (saved) { this.deviceTypes = JSON.parse(saved); }
    } catch(e) {}
  },

  // ── Persist user prefs (accent color, weather location) ─
  savePrefs() {
    try { localStorage.setItem('cc-prefs', JSON.stringify(this.prefs)); } catch(e) {}
  },

  loadPrefs() {
    try {
      const saved = localStorage.getItem('cc-prefs');
      if (saved) { this.prefs = { ...this.prefs, ...JSON.parse(saved) }; }
    } catch(e) {}
  },

  // Apply the chosen accent color to CSS custom properties
  applyAccent() {
    const preset = this.ACCENT_PRESETS.find(p => p.hex === this.prefs.accent);
    if (preset) {
      document.documentElement.style.setProperty('--accent', preset.hex);
      document.documentElement.style.setProperty('--accent-glow', preset.glow);
    } else {
      document.documentElement.style.removeProperty('--accent');
      document.documentElement.style.removeProperty('--accent-glow');
    }
  },

  // Auto-detected type (no override applied) — used by the picker UI
  // to show "Auto-detect (X)" so users know what'd happen if they clear
  // their override.
  autoType(accessory) {
    const ht = accessory.humanType;
    if (ht in this.typeMap) return this.typeMap[ht];
    return 'unknown';
  },

  // ── Get the user-facing name for an accessory ─────
  // Custom name (from localStorage) wins. Otherwise, if the
  // accessory has hidden siblings (e.g. multi-button remote), strip
  // the per-button suffix so we show the device name, not a button.
  displayName(accessory) {
    if (!accessory) return '';
    const custom = this.deviceNames[accessory.uniqueId];
    if (custom) return custom;
    if ((this.siblings[accessory.uniqueId] || []).length) {
      // Bundled — prefer the physical-device name from accessoryInformation
      // (cleaner than stripping suffixes from the per-button serviceName).
      const physName = accessory.accessoryInformation?.Name;
      if (physName) return physName;
      return this.cleanName(accessory.serviceName);
    }
    return accessory.serviceName;
  },

  // ── Build rooms from accessory data ───────────────
  // Called on first load if no saved rooms exist
  buildDefaultRooms() {
    this.rooms = this.defaultRoomMap.map(r => ({
      ...r,
      deviceIds: this.accessories
        .filter(a => r.devices.includes(a.serviceName))
        .map(a => a.uniqueId)
    }));
    this.saveRooms();
  },

  // ── Get accessory by uniqueId ──────────────────────
  // Looks up primaries first; if the id belongs to a hidden sibling,
  // returns the primary so old localStorage references still resolve.
  getAccessory(uniqueId) {
    const found = this.accessories.find(a => a.uniqueId === uniqueId);
    if (found) return found;
    for (const [primaryUid, sibs] of Object.entries(this.siblings)) {
      if (sibs.some(s => s.uniqueId === uniqueId)) {
        return this.accessories.find(a => a.uniqueId === primaryUid);
      }
    }
    return undefined;
  },

  // ── Get accessories for a room (deduped) ──────────
  getRoomAccessories(roomId) {
    const room = this.rooms.find(r => r.id === roomId);
    if (!room) return [];
    const seen = new Set();
    const result = [];
    for (const id of (room.deviceIds || [])) {
      const acc = this.getAccessory(id);
      if (acc && !seen.has(acc.uniqueId)) {
        seen.add(acc.uniqueId);
        result.push(acc);
      }
    }
    return result;
  },

  // ── One-time migration: rewrite uid references from siblings → primaries
  // Saved rooms / favorites / name overrides may point at hidden sibling
  // uids from before bundling existed. Resolve them through getAccessory
  // so everything points at the right primary going forward.
  _migrateUidReferences() {
    const resolveList = (ids) => {
      const seen = new Set();
      const out = [];
      for (const id of (ids || [])) {
        const a = this.getAccessory(id);
        if (a && !seen.has(a.uniqueId)) {
          seen.add(a.uniqueId);
          out.push(a.uniqueId);
        }
      }
      return out;
    };
    let dirty = false;
    for (const r of this.rooms) {
      const fixed = resolveList(r.deviceIds);
      if (JSON.stringify(fixed) !== JSON.stringify(r.deviceIds)) {
        r.deviceIds = fixed;
        dirty = true;
      }
    }
    if (dirty) this.saveRooms();

    const fixedFavs = resolveList(this.favorites);
    if (JSON.stringify(fixedFavs) !== JSON.stringify(this.favorites)) {
      this.favorites = fixedFavs;
      this.saveFavorites();
    }

    const newNames = {};
    let nameDirty = false;
    for (const [uid, name] of Object.entries(this.deviceNames || {})) {
      const a = this.getAccessory(uid);
      if (a) {
        if (a.uniqueId !== uid) nameDirty = true;
        newNames[a.uniqueId] = name;
      } else {
        nameDirty = true;
      }
    }
    if (nameDirty) {
      this.deviceNames = newNames;
      this.saveDeviceNames();
    }
  },

  // ── Get characteristic value from accessory ───────
  getCharValue(accessory, type) {
    const char = (accessory.serviceCharacteristics || []).find(c => c.type === type);
    return char ? char.value : null;
  },

  // ── Check if accessory is on ───────────────────────
  isOn(accessory) {
    const on = this.getCharValue(accessory, 'On');
    if (on !== null) return on === 1 || on === true;
    const active = this.getCharValue(accessory, 'Active');
    if (active !== null) return active === 1 || active === true;
    return false;
  },

  // ── Get device type ────────────────────────────────
  // User override wins; otherwise auto-detect from humanType.
  getType(accessory) {
    const override = this.deviceTypes[accessory.uniqueId];
    if (override) return override;
    const ht = accessory.humanType;
    if (ht in this.typeMap) return this.typeMap[ht];
    return 'unknown';
  },

  // ── Process raw accessories from Homebridge ───────
  // Dedup → index batteries → strip hidden types → group by aid
  // (one primary per physical device, siblings tucked away).
  processAccessories(raw) {
    const seen = new Set();
    const deduped = (raw || []).filter(a => {
      if (seen.has(a.uniqueId)) return false;
      seen.add(a.uniqueId);
      return true;
    });

    this.batteries = {};
    for (const a of deduped) {
      if (a.humanType !== 'Battery') continue;
      const chars = a.serviceCharacteristics || [];
      const find = t => chars.find(c => c.type === t);
      const level    = find('BatteryLevel')?.value;
      const low      = find('StatusLowBattery')?.value;
      const charging = find('ChargingState')?.value;
      this.batteries[a.aid] = {
        level: level == null ? null : Math.round(level),
        low: low === 1,
        charging: charging === 1,
      };
    }

    const filtered = deduped.filter(a => this.getType(a) !== null);

    // Group by physical device. Hue uses one shared aid for a Dimmer's
    // 4 buttons (caught by aid). Lutron Pico exposes each button as its
    // own aid but shares Manufacturer + Model + SerialNumber across all
    // buttons of one physical remote — caught by the SN-based key.
    const groups = {};
    for (const a of filtered) {
      const key = this._groupKey(a);
      (groups[key] = groups[key] || []).push(a);
    }

    this.siblings = {};
    const primaries = [];
    for (const group of Object.values(groups)) {
      if (group.length === 1) {
        primaries.push(group[0]);
        continue;
      }

      // Bucket by internal type. For each type we keep one primary;
      // any additional same-type services are siblings of that primary.
      // This collapses Hue Dimmer's 4 button entries to 1 card,
      // while still surfacing a light + sensor on the same physical
      // device as two separate controllable cards.
      const byType = {};
      for (const a of group) {
        const t = this.getType(a);
        (byType[t] = byType[t] || []).push(a);
      }
      for (const t of this.TYPE_PRIORITY) {
        if (!byType[t]) continue;
        const sorted = byType[t].slice().sort((a, b) => (a.iid || 0) - (b.iid || 0));
        const primary = sorted[0];
        primaries.push(primary);
        if (sorted.length > 1) {
          this.siblings[primary.uniqueId] = sorted.slice(1);
        }
      }
    }

    return primaries;
  },

  // Sibling accessories under the same physical device
  getSiblings(accessory) {
    if (!accessory) return [];
    return this.siblings[accessory.uniqueId] || [];
  },

  // ── Group key for an accessory ────────────────────
  // Prefer Manufacturer + Model + SerialNumber when all are reliably
  // present (catches Lutron Pico — same SN across button accessories
  // with different aids). Fall back to aid for plugins that don't
  // expose accessoryInformation.
  _groupKey(a) {
    const info = a.accessoryInformation || {};
    const mfg = (info.Manufacturer || '').trim();
    const model = (info.Model || '').trim();
    const sn = (info.SerialNumber || '').trim();
    if (mfg && model && sn && sn.length >= 4) {
      return `phys:${mfg}|${model}|${sn}`;
    }
    return `aid:${a.aid}`;
  },

  // Strip trailing button suffixes from a service name
  // (Hue Dimmer "X On" / "X Dim Up" → "X").
  cleanName(name) {
    return (name || '').replace(/\s+(On|Off|Dim Up|Dim Down|Up|Down|Button \d+|\d+)$/i, '');
  },

  // ── Battery lookup (parent device → battery info) ─
  getBattery(accessory) {
    if (!accessory) return null;
    return this.batteries[accessory.aid] || null;
  },

  // ── Devices with low battery ──────────────────────
  // "Low" = StatusLowBattery flag OR level < 20.
  // Deduped by aid so multi-button remotes (Hue Dimmer, etc.)
  // show as one physical device instead of one entry per button.
  getLowBatteryDevices() {
    const seen = new Set();
    return this.accessories.filter(a => {
      const b = this.getBattery(a);
      if (!b) return false;
      if (!(b.low || (b.level !== null && b.level < 20))) return false;
      if (seen.has(a.aid)) return false;
      seen.add(a.aid);
      return true;
    });
  },

  // ── Get all controllable accessories ──────────────
  getControllable() {
    return this.accessories.filter(a => this.getType(a) !== null && this.getType(a) !== 'unknown');
  },

  // ── Count active lights ────────────────────────────
  getActiveLightCount() {
    return this.accessories
      .filter(a => this.getType(a) === 'light' && this.isOn(a))
      .length;
  },

  // ── Favorites ─────────────────────────────────────
  isFav(uniqueId) {
    return this.favorites.includes(uniqueId);
  },

  toggleFav(uniqueId) {
    if (this.isFav(uniqueId)) {
      this.favorites = this.favorites.filter(id => id !== uniqueId);
    } else {
      this.favorites.push(uniqueId);
    }
    this.saveFavorites();
  },

  // ── Update accessory value in local state ─────────
  // Call this after a successful API write
  updateCharValue(aid, iid, value) {
    const acc = this.accessories.find(a => a.aid === aid);
    if (!acc) return;
    const char = (acc.serviceCharacteristics || []).find(c => c.iid === iid);
    if (char) char.value = value;
    // Also update values map
    if (acc.values) {
      const key = char ? char.type : iid;
      acc.values[key] = value;
    }
  },

  // ── Initialize ────────────────────────────────────
  async init() {
    this.loadFavorites();
    this.loadDeviceNames();
    this.loadDeviceTypes();
    this.loadPrefs();
    this.applyAccent();
    const hasSavedRooms = this.loadRooms();

    const raw = await API.getAccessories();
    this.accessories = this.processAccessories(raw);

    if (!hasSavedRooms) {
      this.buildDefaultRooms();
    } else {
      // Migrate any sibling-uid references in saved data → primary uids.
      this._migrateUidReferences();
    }
  }

};
