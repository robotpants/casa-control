/* ── Casa Control · app.js ────────────────────────────
   App entry point. Initializes state, renders UI,
   handles routing between views.
   ───────────────────────────────────────────────────── */

const App = {

  // ── Current view ───────────────────────────────────
  currentView: 'home',
  navFrom: 'home',

  // ── Init ───────────────────────────────────────────
  async init() {
    UI.applyTheme();
    UI.showLoading('Connecting to Homebridge...');

    try {
      await State.init();
      UI.hideLoading();
      this.render();
      this.fetchWeather();
      // Poll for updates every 30 seconds
      setInterval(() => this.refresh(), 30000);
    } catch (e) {
      UI.showError('Could not connect to Homebridge. Is the server running?');
      console.error(e);
    }
  },

  // ── Refresh accessory state ────────────────────────
  async refresh() {
    try {
      const raw = await API.getAccessories();
      State.accessories = State.processAccessories(raw);

      // Don't tear down the DOM if the user is mid-interaction:
      // a modal is open, a card is expanded, or a slider is being dragged.
      // Update the dynamic bits in place instead so expand/slide state survives.
      const modalOpen = document.getElementById('modalOverlay')?.classList.contains('open');
      const cardExpanded = !!document.querySelector('.light-card.expanded');
      const isSliding = this._isSliding;
      if (modalOpen || cardExpanded || isSliding) {
        this._refreshInPlace();
      } else {
        this.updateActiveView();
      }
    } catch (e) {
      console.warn('Refresh failed:', e.message);
    }
  },

  // ── Surgical update — toggle/indicator/status only ─
  _refreshInPlace() {
    const now = Date.now();
    for (const acc of State.accessories) {
      const uid = acc.uniqueId;
      // Skip devices the user just toggled — the API may still report
      // the old state for a few seconds after the write.
      if ((Devices._recentToggles?.[uid] ?? 0) > now) continue;
      const ind = document.getElementById(`ind-${uid}`);
      const tog = document.getElementById(`tog-${uid}`);
      const st  = document.getElementById(`st-${uid}`);
      if (!ind && !tog && !st) continue;
      const isOn = State.isOn(acc);
      const isOffline = acc.instance?.connectionFailedCount > 0;
      if (ind) ind.classList.toggle('on', isOn);
      if (tog) tog.classList.toggle('on', isOn);
      if (st)  st.innerHTML = isOffline
        ? '<span style="color:var(--danger)">Offline</span>'
        : UI.deviceStatus(acc);
    }
  },

  // ── Update whichever view is active ───────────────
  updateActiveView() {
    if (this.currentView === 'home') {
      Rooms.render();
      this.renderLowBatteryBanner();
      this.renderFavorites();
    } else if (this.currentView === 'room' && State.currentRoomId) {
      Rooms.renderRoomContent(State.currentRoomId);
      Rooms.render();
    } else if (this.currentView === 'devices') {
      this.renderDevicesView();
    }
  },

  // ── Full render ────────────────────────────────────
  render() {
    this.renderNav();
    this.renderHome();
    UI.setActiveNav('home');
  },

  // ── Nav ───────────────────────────────────────────
  renderNav() {
    const nav = document.getElementById('bottomNav');
    if (!nav) return;
    nav.innerHTML = [
      { tab: 'home', icon: 'home', label: 'Home' },
      { tab: 'devices', icon: 'lightbulb', label: 'Devices' },
      { tab: 'settings', icon: 'settings', label: 'Settings' },
    ].map(n => `
      <div class="nav-item ${n.tab === 'home' ? 'active' : ''}"
           data-tab="${n.tab}"
           onclick="App.switchTab('${n.tab}', this)">
        <div class="nav-icon">${ic(n.icon, 22)}</div>
        <div class="nav-label">${n.label}</div>
      </div>`).join('');
  },

  // ── Switch tab ─────────────────────────────────────
  switchTab(tab, el) {
    UI.setActiveNav(tab);
    this.showView(tab);
    this.currentView = tab;

    if (tab === 'home') this.renderHome();
    else if (tab === 'devices') this.renderDevicesView();
    else if (tab === 'settings') this.renderSettingsView();
  },

  // ── Show a view ────────────────────────────────────
  showView(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active', 'slide-in'));
    const view = document.getElementById(id + 'View');
    if (view) view.classList.add('active');
  },

  // ── Home view ─────────────────────────────────────
  renderHome() {
    // Greeting
    const greet = document.getElementById('greetingText');
    if (greet) greet.textContent = UI.greeting();

    // Status cards
    const lightCount = document.getElementById('activeLightCount');
    if (lightCount) lightCount.textContent = State.getActiveLightCount();

    // Icons
    document.getElementById('ico-t').innerHTML = ic('thermometer', 24);
    document.getElementById('ico-s').innerHTML = ic('shield', 24);
    document.getElementById('ico-l').innerHTML = ic('lightbulb', 24);
    document.getElementById('ico-out').innerHTML = ic('cloudSun', 24);

    // Edit button
    const editBtn = document.getElementById('editBtn');
    if (editBtn) editBtn.innerHTML = ic('edit', 18);

    // Theme buttons
    document.querySelectorAll('[data-theme-icon]').forEach(el => {
      el.innerHTML = ic(State.isDark ? 'moon' : 'sun', 18);
    });

    // Rooms
    Rooms.render();

    // Low-battery banner
    this.renderLowBatteryBanner();

    // Favorites
    this.renderFavorites();
  },

  // ── Low-battery banner ─────────────────────────────
  renderLowBatteryBanner() {
    const section = document.getElementById('lowBatterySection');
    if (!section) return;

    const lows = State.getLowBatteryDevices();
    if (!lows.length) {
      section.style.display = 'none';
      section.innerHTML = '';
      return;
    }

    const sorted = lows.slice().sort((a, b) => {
      const la = State.getBattery(a)?.level ?? 100;
      const lb = State.getBattery(b)?.level ?? 100;
      return la - lb;
    });
    const worst = State.getBattery(sorted[0])?.level ?? 0;

    section.style.display = 'block';
    section.innerHTML = `
      <div class="low-battery-banner neu-raised">
        <div class="lbb-icon">${ic('batteryLow', 18)}</div>
        <div class="lbb-text">
          <div class="lbb-title">${lows.length === 1 ? '1 device needs a battery' : `${lows.length} devices need batteries`}</div>
          <div class="lbb-sub">${sorted.map(a => `${State.displayName(a)} ${State.getBattery(a)?.level ?? '?'}%`).slice(0, 3).join(' · ')}${sorted.length > 3 ? ' · …' : ''}</div>
        </div>
        <div class="lbb-pct ${worst < 10 ? 'critical' : ''}">${worst}%</div>
      </div>`;
  },


  // ── Favorites section ─────────────────────────────
  renderFavorites() {
    const section = document.getElementById('favSection');
    if (!section) return;

    const favs = State.favorites
      .map(id => State.getAccessory(id))
      .filter(Boolean);

    if (!favs.length) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    section.innerHTML = `
      <div class="section-label">Favorites</div>
      <div class="light-list">
        ${favs.map(a => Devices.cardHTML(a)).join('')}
      </div>`;
  },

  // ── Devices view ───────────────────────────────────
  renderDevicesView() {
    const content = document.getElementById('devicesContent');
    if (!content) return;

    const all = State.getControllable();
    const totalOn = all.filter(a => State.isOn(a)).length;

    const groups = {
      light: all.filter(a => State.getType(a) === 'light'),
      fan: all.filter(a => State.getType(a) === 'fan'),
      purifier: all.filter(a => State.getType(a) === 'purifier'),
      heater: all.filter(a => State.getType(a) === 'heater'),
      switch: all.filter(a => State.getType(a) === 'switch'),
      sensor: all.filter(a => State.getType(a) === 'sensor'),
      remote: all.filter(a => State.getType(a) === 'remote'),
    };

    const groupDefs = [
      { key: 'light', label: 'Lights', icon: 'lightbulb' },
      { key: 'fan', label: 'Fans', icon: 'wind' },
      { key: 'purifier', label: 'Air Purifiers', icon: 'airVent' },
      { key: 'heater', label: 'Heaters', icon: 'flame' },
      { key: 'switch', label: 'Switches', icon: 'plug' },
      { key: 'sensor', label: 'Sensors', icon: 'thermometer' },
      { key: 'remote', label: 'Remotes', icon: 'radio' },
    ].filter(g => groups[g.key].length > 0);

    content.innerHTML = `
      <div class="dev-summary">
        <div class="dev-summary-card neu-raised">
          <div class="ds-val">${all.length}</div>
          <div class="ds-label">Total</div>
        </div>
        <div class="dev-summary-card neu-raised">
          <div class="ds-val" style="color:var(--accent)">${totalOn}</div>
          <div class="ds-label">On</div>
        </div>
        <div class="dev-summary-card neu-raised">
          <div class="ds-val">${all.length - totalOn}</div>
          <div class="ds-label">Off</div>
        </div>
      </div>
      ${groupDefs.map(g => `
        <div class="dev-group">
          <div class="dev-group-header">
            <span class="dg-icon">${ic(g.icon, 18)}</span>
            <h3>${g.label}</h3>
            <span class="dg-count">${groups[g.key].filter(a => State.isOn(a)).length}/${groups[g.key].length} on</span>
          </div>
          <div class="light-list">
            ${groups[g.key].map(a => Devices.cardHTML(a)).join('')}
          </div>
        </div>`).join('')}`;
  },

  // ── Settings view ──────────────────────────────────
  renderSettingsView() {
    const content = document.getElementById('settingsContent');
    if (!content) return;
    content.innerHTML = `
      <div class="section-label">Appearance</div>
      <div class="settings-group">
        <div class="settings-item neu-raised">
          <div class="left">
            <div class="s-icon">${ic('moon', 18)}</div>
            <div>
              <div class="s-label">Dark Mode</div>
              <div class="s-sub">Toggle theme</div>
            </div>
          </div>
          <div class="toggle ${State.isDark ? 'on' : ''}" id="settingsThemeToggle"
               onclick="UI.toggleTheme();App.renderSettingsView()">
            <div class="knob"></div>
          </div>
        </div>
      </div>
      <div class="section-label">System</div>
      <div class="settings-group">
        <div class="settings-item neu-raised">
          <div class="left">
            <div class="s-icon">${ic('wifi', 18)}</div>
            <div>
              <div class="s-label">Homebridge</div>
              <div class="s-sub" style="color:var(--success)">Connected</div>
            </div>
          </div>
        </div>
        <div class="settings-item neu-raised" onclick="App.resetRooms()" style="cursor:pointer">
          <div class="left">
            <div class="s-icon" style="color:var(--danger)">${ic('trash', 18)}</div>
            <div>
              <div class="s-label" style="color:var(--danger)">Reset Rooms</div>
              <div class="s-sub">Restore default room layout</div>
            </div>
          </div>
        </div>
      </div>
      <div class="section-label">About</div>
      <div class="settings-group">
        <div class="settings-item neu-raised">
          <div class="left">
            <div class="s-icon">${ic('home', 18)}</div>
            <div>
              <div class="s-label">Casa Control</div>
              <div class="s-sub">v1.0.0 · ${State.accessories.length} accessories</div>
            </div>
          </div>
        </div>
      </div>`;
  },

  // ── Room navigation ────────────────────────────────
  goBack() {
    this.showView(this.navFrom === 'devices' ? 'devices' : 'home');
    this.currentView = this.navFrom === 'devices' ? 'devices' : 'home';
    UI.setActiveNav(this.currentView);
    if (this.currentView === 'devices') this.renderDevicesView();
    else Rooms.render();
  },

  // ── Weather ────────────────────────────────────────
  // Cache the most recent forecast so the weather view can render
  // instantly from cache while a fresh fetch happens in the background.
  _weatherCache: null,

  async fetchWeather() {
    try {
      const data = await API.getWeather();
      this._weatherCache = data;
      const temp = Math.round(data.current.temperature_2m);
      const code = data.current.weather_code;
      const tempEl = document.getElementById('outsideTemp');
      const labelEl = document.getElementById('outsideLabel');
      const iconEl = document.getElementById('ico-out');
      if (tempEl) tempEl.textContent = temp + '°';
      if (labelEl) labelEl.textContent = UI.weatherLabel(code);
      if (iconEl) iconEl.innerHTML = ic(UI.weatherIcon(code), 24);
    } catch (e) {
      const tempEl = document.getElementById('outsideTemp');
      if (tempEl) tempEl.textContent = '--°';
    }
  },

  // ── Weather view ──────────────────────────────────
  async openWeather() {
    this.navFrom = this.currentView;
    this.currentView = 'weather';
    this.showView('weather');
    UI.setActiveNav('home'); // stays under Home

    if (this._weatherCache) this.renderWeather(this._weatherCache);
    else document.getElementById('weatherContent').innerHTML =
      '<div style="padding:40px 0;text-align:center;color:var(--text-muted)">Loading…</div>';

    try {
      const data = await API.getWeather();
      this._weatherCache = data;
      this.renderWeather(data);
    } catch (e) {
      document.getElementById('weatherContent').innerHTML =
        '<div style="padding:40px 0;text-align:center;color:var(--danger)">Failed to load forecast</div>';
      console.error(e);
    }
  },

  closeWeather() {
    const back = this.navFrom === 'devices' ? 'devices' : 'home';
    this.showView(back);
    this.currentView = back;
    UI.setActiveNav(back);
    if (back === 'devices') this.renderDevicesView();
  },

  renderWeather(data) {
    const c = document.getElementById('weatherContent');
    if (!c) return;
    const cur = data.current || {};
    const day = (data.daily || {});
    const hr  = (data.hourly || {});

    const code = cur.weather_code;
    const isDay = cur.is_day === 1;

    // Hero
    const heroIcon  = UI.weatherIcon(code, isDay);
    const heroLabel = UI.weatherLabel(code);
    const temp      = Math.round(cur.temperature_2m);
    const feels     = Math.round(cur.apparent_temperature);
    const humidity  = Math.round(cur.relative_humidity_2m);
    const wind      = Math.round(cur.wind_speed_10m);
    const gust      = Math.round(cur.wind_gusts_10m);
    const cloud     = Math.round(cur.cloud_cover);
    const uvToday   = day.uv_index_max?.[0];
    const rainToday = day.precipitation_probability_max?.[0];
    const sunrise   = day.sunrise?.[0];
    const sunset    = day.sunset?.[0];

    const hero = `
      <div class="wx-hero neu-raised">
        <div class="wx-hero-icon">${ic(heroIcon, 64)}</div>
        <div class="wx-hero-temp">${temp}°</div>
        <div class="wx-hero-cond">${heroLabel}</div>
        <div class="wx-hero-sub">Feels like ${feels}° · ${humidity}% humidity</div>
      </div>`;

    const cond = (icon, val, label) => `
      <div class="wx-cond neu-raised">
        <div class="wxc-icon">${ic(icon, 18)}</div>
        <div class="wxc-val">${val}</div>
        <div class="wxc-label">${label}</div>
      </div>`;

    const conditionsGrid = `
      <div class="wx-cond-grid">
        ${cond('wind', `${wind} mph`, gust ? `Wind · ${gust} gust` : 'Wind')}
        ${cond('droplet', `${humidity}%`, 'Humidity')}
        ${cond('sun', uvToday != null ? Math.round(uvToday) : '—', 'UV Index')}
        ${cond('cloudRain', `${rainToday ?? 0}%`, 'Rain')}
        ${cond('cloud', `${cloud}%`, 'Cloud Cover')}
        ${cond('sunset', this._fmtTime(sunset), `Sunset · ${this._fmtTime(sunrise)} rise`)}
      </div>`;

    // Hourly: next 12 hours starting from current hour
    const now = new Date();
    let startIdx = (hr.time || []).findIndex(t => new Date(t) >= now);
    if (startIdx < 0) startIdx = 0;
    const hours = (hr.time || []).slice(startIdx, startIdx + 12).map((t, i) => {
      const idx = startIdx + i;
      return {
        hour: this._fmtHour(t, i === 0),
        icon: UI.weatherIcon(hr.weather_code[idx], hr.is_day[idx] === 1),
        temp: Math.round(hr.temperature_2m[idx]),
        rain: hr.precipitation_probability[idx] || 0,
      };
    });
    const hourly = `
      <div class="section-label">Next 12 Hours</div>
      <div class="wx-hourly">
        ${hours.map(h => `
          <div class="wx-hour neu-raised">
            <div class="wxh-time">${h.hour}</div>
            <div class="wxh-icon">${ic(h.icon, 22)}</div>
            <div class="wxh-temp">${h.temp}°</div>
            ${h.rain > 0 ? `<div class="wxh-rain">${h.rain}%</div>` : '<div class="wxh-rain">&nbsp;</div>'}
          </div>`).join('')}
      </div>`;

    // Daily: next 7 days
    const days = (day.time || []).map((t, i) => ({
      name: i === 0 ? 'Today' : new Date(t + 'T12:00').toLocaleDateString(undefined, { weekday: 'short' }),
      icon: UI.weatherIcon(day.weather_code[i], true),
      hi: Math.round(day.temperature_2m_max[i]),
      lo: Math.round(day.temperature_2m_min[i]),
      rain: day.precipitation_probability_max[i] || 0,
    }));
    const daily = `
      <div class="section-label">7-Day Forecast</div>
      <div class="wx-daily">
        ${days.map(d => `
          <div class="wx-day neu-raised">
            <div class="wxd-name">${d.name}</div>
            <div class="wxd-icon">${ic(d.icon, 20)}</div>
            <div class="wxd-rain">${d.rain > 0 ? d.rain + '%' : ''}</div>
            <div class="wxd-temps"><span class="wxd-hi">${d.hi}°</span><span class="wxd-lo">${d.lo}°</span></div>
          </div>`).join('')}
      </div>`;

    c.innerHTML = hero + conditionsGrid + hourly + daily;
  },

  // Format an ISO timestamp as "9 AM" / local hour
  _fmtHour(iso, isNow) {
    if (isNow) return 'Now';
    const d = new Date(iso);
    const h = d.getHours();
    if (h === 0) return '12 AM';
    if (h === 12) return '12 PM';
    return h < 12 ? `${h} AM` : `${h - 12} PM`;
  },

  // Format an ISO timestamp as "6:42 PM"
  _fmtTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  },

  // ── Reset rooms ────────────────────────────────────
  resetRooms() {
    if (!confirm('Reset to default room layout?')) return;
    localStorage.removeItem('cc-rooms');
    localStorage.removeItem('cc-favs');
    State.favorites = [];
    State.buildDefaultRooms();
    Rooms.render();
    UI.toast('Rooms reset');
  },

};

// ── Boot ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());
