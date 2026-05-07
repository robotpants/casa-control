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
      const fetched = await API.getAccessories();
      const seen = new Set();
      State.accessories = fetched
        .filter(a => {
          if (seen.has(a.uniqueId)) return false;
          seen.add(a.uniqueId);
          return true;
        })
        .filter(a => State.getType(a) !== null);
      this.updateActiveView();
    } catch (e) {
      console.warn('Refresh failed:', e.message);
    }
  },

  // ── Update whichever view is active ───────────────
  updateActiveView() {
    if (this.currentView === 'home') {
      Rooms.render();
      this.renderFavorites();
    } else if (this.currentView === 'room' && State.currentRoomId) {
      Rooms.renderRoomContent(State.currentRoomId);
      Rooms.render();
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

    // Favorites
    this.renderFavorites();
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
  async fetchWeather() {
    try {
      const data = await API.getWeather();
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
