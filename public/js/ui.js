/* ── Casa Control · ui.js ─────────────────────────────
   Theme, toast, modals, and other pure UI utilities.
   No API calls, no state writes live here.
   ───────────────────────────────────────────────────── */

const UI = {

  // ── Theme ─────────────────────────────────────────
  applyTheme() {
    const theme = State.isDark ? 'dark' : '';
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    document.documentElement.style.background = State.isDark ? '#1a1b22' : '#e2e4ec';
    document.body.style.background = State.isDark ? '#1a1b22' : '#e2e4ec';
    this.updateThemeIcons();
  },

  toggleTheme() {
    State.isDark = !State.isDark;
    this.applyTheme();
  },

  updateThemeIcons() {
    const iconName = State.isDark ? 'moon' : 'sun';
    document.querySelectorAll('[data-theme-icon]').forEach(el => {
      el.innerHTML = ic(iconName, 18);
    });
    const toggle = document.getElementById('settingsThemeToggle');
    if (toggle) toggle.classList.toggle('on', State.isDark);
  },

  // ── Toast ──────────────────────────────────────────
  toast(msg, duration = 1800) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translateX(-50%) translateY(20px)';
    }, duration);
  },

  // ── Modal ──────────────────────────────────────────
  openModal(html) {
    const overlay = document.getElementById('modalOverlay');
    const content = document.getElementById('modalContent');
    if (!overlay || !content) return;
    content.innerHTML = html;
    overlay.classList.add('open');
  },

  closeModal() {
    const overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.classList.remove('open');
  },

  // ── Loading state ──────────────────────────────────
  showLoading(msg = 'Loading...') {
    const el = document.getElementById('loadingState');
    if (el) { el.textContent = msg; el.style.display = 'flex'; }
  },

  hideLoading() {
    const el = document.getElementById('loadingState');
    if (el) el.style.display = 'none';
  },

  // ── Error state ────────────────────────────────────
  showError(msg) {
    const el = document.getElementById('errorState');
    if (el) { el.textContent = msg; el.style.display = 'flex'; }
    this.hideLoading();
  },

  // ── Stagger animation ──────────────────────────────
  stagger(container) {
    if (!container) return;
    Array.from(container.children).forEach((el, i) => {
      el.style.animationDelay = `${i * 0.04}s`;
    });
  },

  // ── Weather icon helper ────────────────────────────
  // Optional isDay flag swaps clear-sky icon to moon at night.
  weatherIcon(code, isDay = true) {
    if (code === 0) return isDay ? 'sun' : 'moon';
    if (code <= 3) return isDay ? 'cloudSun' : 'cloud';
    if (code <= 48) return 'cloud';
    if (code <= 67) return 'cloudRain';
    if (code <= 77) return 'cloud';      // snow — fallback to cloud
    if (code <= 82) return 'cloudRain';  // rain showers
    if (code <= 99) return 'cloudRain';  // thunder
    return 'cloud';
  },

  weatherLabel(code) {
    if (code === 0) return 'Clear';
    if (code <= 2) return 'Mostly Clear';
    if (code === 3) return 'Cloudy';
    if (code <= 48) return 'Foggy';
    if (code <= 57) return 'Drizzle';
    if (code <= 67) return 'Rainy';
    if (code <= 77) return 'Snowy';
    if (code <= 82) return 'Showers';
    if (code <= 86) return 'Snow Showers';
    if (code <= 99) return 'Thunderstorm';
    return 'Unknown';
  },

  // ── Device status text ─────────────────────────────
  deviceStatus(accessory) {
    const type = State.getType(accessory);
    const isOn = State.isOn(accessory);

    if (!isOn) return 'Off';

    if (type === 'light') {
      const brightness = State.getCharValue(accessory, 'Brightness');
      return brightness !== null ? `${Math.round(brightness)}%` : 'On';
    }

    if (type === 'fan') {
      const speed = State.getCharValue(accessory, 'RotationSpeed');
      return speed !== null ? `${Math.round(speed)}%` : 'On';
    }

    if (type === 'purifier') {
      const speed = State.getCharValue(accessory, 'RotationSpeed');
      return speed !== null ? `Fan ${Math.round(speed)}%` : 'On';
    }

    if (type === 'heater') {
      const mode = State.getCharValue(accessory, 'CurrentHeaterCoolerState');
      return mode === 2 ? 'Heating' : mode === 3 ? 'Cooling' : 'On';
    }

    if (type === 'sensor') {
      const temp = State.getCharValue(accessory, 'CurrentTemperature');
      if (temp !== null) return `${Math.round(temp * 9/5 + 32)}°F`;
      const quality = State.getCharValue(accessory, 'AirQuality');
      if (quality !== null) {
        const labels = ['Unknown', 'Excellent', 'Good', 'Fair', 'Inferior', 'Poor'];
        return labels[quality] || 'Unknown';
      }
    }

    if (type === 'remote') return 'Remote';

    return 'On';
  },

  // ── Device icon helper ─────────────────────────────
  deviceIcon(accessory) {
    const type = State.getType(accessory);
    const map = {
      light: 'lightbulb',
      switch: 'plug',
      fan: 'wind',
      purifier: 'airVent',
      heater: 'flame',
      sensor: 'thermometer',
      remote: 'radio',
    };
    if (map[type]) return map[type];
    // Fallback: infer icon from humanType for variants not in typeMap
    const ht = accessory.humanType || '';
    if (/Fan/i.test(ht)) return 'wind';
    if (/Light|Bulb/i.test(ht)) return 'lightbulb';
    if (/Purifier/i.test(ht)) return 'wind';
    if (/Heater|Cooler/i.test(ht)) return 'flame';
    if (/Sensor|Temperature|Humidity/i.test(ht)) return 'thermometer';
    if (/Switch/i.test(ht)) return 'plug';
    return 'zap';
  },

  // ── Greeting ───────────────────────────────────────
  greeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  },

  // ── Nav ───────────────────────────────────────────
  setActiveNav(tab) {
    document.querySelectorAll('.nav-item').forEach(n => {
      n.classList.toggle('active', n.dataset.tab === tab);
    });
  },

};
