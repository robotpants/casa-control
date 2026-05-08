/* ── Casa Control · api.js ────────────────────────────
   All Homebridge API calls. Nothing else lives here.
   All requests go through the local Express proxy.
   ───────────────────────────────────────────────────── */

const API = {

  // ── Accessories ───────────────────────────────────

  // ── Internal: fetch with timeout (kills hung requests) ─
  async _fetch(url, opts = {}, timeoutMs = 8000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(url, { ...opts, signal: ctrl.signal });
    } finally {
      clearTimeout(t);
    }
  },

  // Get all accessories
  // refreshServices=true forces Homebridge to actively query every
  // child bridge — without it the response is main-bridge cache only,
  // and Lutron/Dreo/Levoit child bridges are invisible.
  async getAccessories() {
    const res = await this._fetch('/api/accessories?refreshServices=true');
    if (!res.ok) throw new Error('Failed to fetch accessories');
    return res.json();
  },

  // Set a characteristic value on an accessory
  // uniqueId is the Homebridge accessory uniqueId (hex string)
  // charType is the characteristic type name (e.g. "On", "Brightness", "RotationSpeed")
  // Throws on HTTP failure or echo mismatch (server flags _mismatch=true
  // when the plugin acked but didn't apply the new value — most often the
  // plugin is in a bad state and the user needs to know, not see a UI lie).
  async setCharacteristic(uniqueId, charType, value) {
    const res = await this._fetch(`/api/accessories/${uniqueId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        characteristicType: charType,
        value
      })
    });
    if (!res.ok) throw new Error(`Failed to set characteristic ${charType} on ${uniqueId}`);
    const body = await res.json();
    if (body && body._mismatch) {
      const err = new Error(`Plugin ignored ${charType}=${value} (echoed ${body._echoed})`);
      err.mismatch = true;
      throw err;
    }
    return body;
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

  // ── Casa Control prefs bundle (cross-device sync) ─
  async getPrefs() {
    const res = await this._fetch('/api/prefs', {}, 5000);
    if (!res.ok) throw new Error('Prefs fetch failed');
    return res.json();
  },

  async putPrefs(payload) {
    const res = await this._fetch('/api/prefs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }, 5000);
    if (!res.ok) throw new Error('Prefs save failed');
    return res.json();
  },

  // ── Pi health stats (served by our own Express server) ─
  async getPiStats() {
    const res = await fetch('/api/pi-stats');
    if (!res.ok) throw new Error('Pi stats fetch failed');
    return res.json();
  },

  // ── Weather (Open-Meteo, no key needed) ──────────
  // Returns full forecast: current conditions, 24h hourly, 7-day daily.
  async getWeather(lat = 34.1164, lon = -118.3390) {
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      current: [
        'temperature_2m', 'relative_humidity_2m', 'apparent_temperature',
        'is_day', 'weather_code', 'wind_speed_10m', 'wind_direction_10m',
        'wind_gusts_10m', 'precipitation', 'cloud_cover'
      ].join(','),
      hourly: 'temperature_2m,precipitation_probability,weather_code,is_day',
      daily: [
        'weather_code', 'temperature_2m_max', 'temperature_2m_min',
        'sunrise', 'sunset', 'uv_index_max',
        'precipitation_probability_max', 'precipitation_sum'
      ].join(','),
      temperature_unit: 'fahrenheit',
      wind_speed_unit: 'mph',
      precipitation_unit: 'inch',
      timezone: 'America/Los_Angeles',
      forecast_days: 7,
    });
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!res.ok) throw new Error('Weather fetch failed');
    return res.json();
  }

};
