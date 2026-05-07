/* ── Casa Control · api.js ────────────────────────────
   All Homebridge API calls. Nothing else lives here.
   All requests go through the local Express proxy.
   ───────────────────────────────────────────────────── */

const API = {

  // ── Accessories ───────────────────────────────────

  // Get all accessories
  async getAccessories() {
    const res = await fetch('/api/accessories');
    if (!res.ok) throw new Error('Failed to fetch accessories');
    return res.json();
  },

  // Set a characteristic value on an accessory
  // uniqueId is the Homebridge accessory uniqueId (hex string)
  // charType is the characteristic type name (e.g. "On", "Brightness", "RotationSpeed")
  async setCharacteristic(uniqueId, charType, value) {
    const res = await fetch(`/api/accessories/${uniqueId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        characteristicType: charType,
        value
      })
    });
    if (!res.ok) throw new Error(`Failed to set characteristic ${charType} on ${uniqueId}`);
    return res.json();
  },

  // Get a single accessory
  async getAccessory(uniqueId) {
    const res = await fetch(`/api/accessories/${uniqueId}`);
    if (!res.ok) throw new Error(`Failed to fetch accessory ${uniqueId}`);
    return res.json();
  },

  // ── Convenience wrappers ──────────────────────────

  // Toggle a switch/light on or off
  // finds the On or Active characteristic automatically
  async setOnOff(accessory, value) {
    const chars = accessory.serviceCharacteristics || [];
    const onChar = chars.find(c => c.type === 'On' || c.type === 'Active');
    if (!onChar) throw new Error('No On/Active characteristic found');
    return this.setCharacteristic(accessory.uniqueId, onChar.type, value ? 1 : 0);
  },

  // Set brightness (0-100)
  async setBrightness(accessory, value) {
    const chars = accessory.serviceCharacteristics || [];
    const char = chars.find(c => c.type === 'Brightness');
    if (!char) throw new Error('No Brightness characteristic found');
    return this.setCharacteristic(accessory.uniqueId, char.type, value);
  },

  // Set fan rotation speed (0-100)
  async setRotationSpeed(accessory, value) {
    const chars = accessory.serviceCharacteristics || [];
    const char = chars.find(c => c.type === 'RotationSpeed');
    if (!char) throw new Error('No RotationSpeed characteristic found');
    return this.setCharacteristic(accessory.uniqueId, char.type, value);
  },

  // ── Weather (Open-Meteo, no key needed) ──────────
  async getWeather(lat = 34.1164, lon = -118.3390) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=America/Los_Angeles`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Weather fetch failed');
    return res.json();
  }

};
