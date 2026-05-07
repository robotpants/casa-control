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

  // ── Device type map ───────────────────────────────
  // Maps Homebridge humanType to our internal type
  typeMap: {
    'Lightbulb': 'light',
    'Switch': 'switch',
    'Fanv2': 'fan',
    'Air Purifier': 'purifier',
    'Air Quality Sensor': 'sensor',
    'Temperature Sensor': 'sensor',
    'Heater Cooler': 'heater',
    'Stateless Programmable Switch': 'remote',
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
    return this.typeMap[accessory.humanType] || 'unknown';
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

    // Fetch live accessories
    this.accessories = await API.getAccessories();

    // Filter out junk types
    this.accessories = this.accessories.filter(a => this.getType(a) !== null);

    if (!hasSavedRooms) {
      this.buildDefaultRooms();
    }
  }

};
