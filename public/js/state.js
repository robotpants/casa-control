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

  // ── UI state ──────────────────────────────────────
  currentRoomId: null,
  editMode: false,
  isDark: window.matchMedia('(prefers-color-scheme: dark)').matches,

  // ── Battery index (aid → { level, low, charging }) ─
  // Battery accessories share the parent device's aid, so we
  // index them on load and surface inline rather than as cards.
  batteries: {},

  // ── Device type map ───────────────────────────────
  // Maps Homebridge humanType to our internal type
  // null = hidden from device list (junk, or surfaced elsewhere)
  typeMap: {
    'Lightbulb': 'light',
    'Switch': 'switch',
    'Fanv2': 'fan',
    'Air Purifier': 'purifier',
    'Air Quality Sensor': 'sensor',
    'Temperature Sensor': 'sensor',
    'Light Sensor': 'sensor',
    'Heater Cooler': 'heater',
    'Stateless Programmable Switch': 'remote',
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
  getAccessory(uniqueId) {
    return this.accessories.find(a => a.uniqueId === uniqueId);
  },

  // ── Get accessories for a room ────────────────────
  getRoomAccessories(roomId) {
    const room = this.rooms.find(r => r.id === roomId);
    if (!room) return [];
    return (room.deviceIds || [])
      .map(id => this.getAccessory(id))
      .filter(Boolean);
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
  getType(accessory) {
    const ht = accessory.humanType;
    if (ht in this.typeMap) return this.typeMap[ht];
    return 'unknown';
  },

  // ── Process raw accessories from Homebridge ───────
  // Dedup, index batteries, then strip hidden types.
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

    return deduped.filter(a => this.getType(a) !== null);
  },

  // ── Battery lookup (parent device → battery info) ─
  getBattery(accessory) {
    if (!accessory) return null;
    return this.batteries[accessory.aid] || null;
  },

  // ── Devices with low battery ──────────────────────
  // "Low" = StatusLowBattery flag OR level < 20%
  getLowBatteryDevices() {
    return this.accessories.filter(a => {
      const b = this.getBattery(a);
      if (!b) return false;
      return b.low || (b.level !== null && b.level < 20);
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
    const hasSavedRooms = this.loadRooms();

    const raw = await API.getAccessories();
    this.accessories = this.processAccessories(raw);

    if (!hasSavedRooms) {
      this.buildDefaultRooms();
    }
  }

};
