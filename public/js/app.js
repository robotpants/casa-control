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
      UI.applyTheme(); // re-apply once prefs are loaded (themeMode may differ)
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
      { tab: 'debug', icon: 'wrench', label: 'Debug' },
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
    else if (tab === 'debug') this.renderDebugView();
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
    const house = document.getElementById('houseName');
    if (house) house.textContent = State.prefs.houseName || 'Casa Control';

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
    const worstUid = sorted[0].uniqueId;
    section.innerHTML = `
      <div class="low-battery-banner neu-raised" onclick="Devices.openManageModal('${worstUid}')" style="cursor:pointer">
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
    const accentDots = State.ACCENT_PRESETS.map(p => `
      <span class="color-dot ${State.prefs.accent === p.hex || (!State.prefs.accent && p.key === 'ember') ? 'selected' : ''}"
            title="${p.name}"
            style="background:${p.hex}${State.prefs.accent === p.hex || (!State.prefs.accent && p.key === 'ember') ? `;color:${p.hex}` : ''}"
            onclick="App.setAccent('${p.hex}')"></span>`).join('');

    const themeMode = State.prefs.themeMode || 'auto';
    const themeBtn = (mode, label, icon) => `
      <button class="theme-mode-btn ${themeMode === mode ? 'active' : ''}"
              onclick="UI.setThemeMode('${mode}');App.renderSettingsView()">
        ${ic(icon, 16)}<span>${label}</span>
      </button>`;

    content.innerHTML = `
      <div class="section-label">Appearance</div>
      <div class="settings-group">
        <div class="settings-item neu-raised" style="display:block">
          <div class="left" style="margin-bottom:10px">
            <div class="s-icon">${ic(State.isDark ? 'moon' : 'sun', 18)}</div>
            <div>
              <div class="s-label">Theme</div>
              <div class="s-sub">${themeMode === 'auto' ? `Auto · currently ${State.isDark ? 'dark' : 'light'}` : `Locked ${themeMode}`}</div>
            </div>
          </div>
          <div class="theme-mode-picker" style="padding-left:48px">
            ${themeBtn('light', 'Light', 'sun')}
            ${themeBtn('dark', 'Dark', 'moon')}
            ${themeBtn('auto', 'Auto', 'activity')}
          </div>
        </div>
        <div class="settings-item neu-raised" style="display:block">
          <div class="left" style="margin-bottom:10px">
            <div class="s-icon">${ic('palette', 18)}</div>
            <div>
              <div class="s-label">Accent Color</div>
              <div class="s-sub">Used for active state, focus, brand</div>
            </div>
          </div>
          <div class="color-row" style="padding-left:48px">${accentDots}</div>
        </div>
      </div>

      <div class="section-label">House</div>
      <div class="settings-group">
        <div class="settings-item neu-raised" style="display:block">
          <div class="left" style="margin-bottom:10px">
            <div class="s-icon">${ic('home', 18)}</div>
            <div>
              <div class="s-label">House Name</div>
              <div class="s-sub">Shown under the greeting</div>
            </div>
          </div>
          <div style="display:flex;gap:8px;padding-left:48px">
            <input class="modal-input" id="houseNameInput" placeholder="e.g. The Smith House" value="${(State.prefs.houseName || '').replace(/"/g, '&quot;')}" maxlength="40" style="flex:1">
            <button class="modal-btn primary" style="flex:0 0 auto;padding:10px 20px" onclick="App.setHouseName()">Set</button>
          </div>
        </div>
      </div>

      <div class="section-label">Location</div>
      <div class="settings-group">
        <div class="settings-item neu-raised" style="display:block">
          <div class="left" style="margin-bottom:10px">
            <div class="s-icon">${ic('cloudSun', 18)}</div>
            <div>
              <div class="s-label">Weather Location</div>
              <div class="s-sub">${State.prefs.weatherCity || 'Default — Los Angeles, CA'}</div>
            </div>
          </div>
          <div style="display:flex;gap:8px;padding-left:48px">
            <input class="modal-input" id="zipInput" placeholder="ZIP code" value="${State.prefs.weatherZip || ''}" maxlength="10" style="flex:1">
            <button class="modal-btn primary" style="flex:0 0 auto;padding:10px 20px" onclick="App.setZip()">Set</button>
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
      <div class="section-label">Pi Health</div>
      <div class="settings-group" id="piStatsContainer">
        <div class="settings-item neu-raised">
          <div class="left">
            <div class="s-icon">${ic('activity', 18)}</div>
            <div>
              <div class="s-label">Loading…</div>
              <div class="s-sub">Reading from /proc</div>
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
              <div class="s-sub">v0.0.4 · ${State.accessories.length} accessories</div>
            </div>
          </div>
        </div>
      </div>`;

    this._loadPiStats();
  },

  // Fetch Pi health stats from our local server endpoint.
  async _loadPiStats() {
    try {
      const s = await API.getPiStats();
      const cont = document.getElementById('piStatsContainer');
      if (!cont) return;

      const fmtBytes = (b) => {
        if (b == null) return '—';
        const gb = b / (1024 ** 3);
        return gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.round(b / (1024 ** 2))} MB`;
      };
      const fmtUptime = (s) => {
        const d = Math.floor(s / 86400);
        const h = Math.floor((s % 86400) / 3600);
        const m = Math.floor((s % 3600) / 60);
        if (d > 0) return `${d}d ${h}h`;
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
      };

      const tempC = s.cpuTempC;
      const tempF = tempC != null ? Math.round(tempC * 9 / 5 + 32) : null;
      const tempColor = tempC == null ? 'var(--text-muted)'
        : tempC < 60 ? 'var(--success)'
        : tempC < 75 ? 'var(--warning)' : 'var(--danger)';

      const row = (icon, label, value, sub, color) => `
        <div class="settings-item neu-raised">
          <div class="left">
            <div class="s-icon" ${color ? `style="color:${color}"` : ''}>${ic(icon, 18)}</div>
            <div>
              <div class="s-label">${label}</div>
              <div class="s-sub">${sub}</div>
            </div>
          </div>
          <div style="font-family:var(--font-mono);font-size:14px;font-weight:600${color ? `;color:${color}` : ''}">${value}</div>
        </div>`;

      cont.innerHTML =
        row('thermometer', 'CPU Temperature',
            tempC != null ? `${Math.round(tempC)}°C` : '—',
            tempF != null ? `${tempF}°F` : 'Sensor unavailable',
            tempColor) +
        row('activity', 'CPU Load',
            `${s.cpuPct}%`,
            `1m load ${s.load1.toFixed(2)} · ${s.cpuCores} cores`) +
        row('layers', 'Memory',
            `${s.memUsedPct}%`,
            `${fmtBytes(s.memTotal - s.memFree)} of ${fmtBytes(s.memTotal)}`) +
        row('warehouse', 'Disk',
            s.diskUsedPct != null ? `${s.diskUsedPct}%` : '—',
            s.diskTotal != null ? `${fmtBytes(s.diskUsed)} of ${fmtBytes(s.diskTotal)}` : 'Unavailable') +
        row('power', 'Uptime',
            fmtUptime(s.uptimeSec),
            `${s.hostname} · Node ${s.nodeVersion}`);
    } catch (e) {
      const cont = document.getElementById('piStatsContainer');
      if (cont) cont.innerHTML = `
        <div class="settings-item neu-raised">
          <div class="left">
            <div class="s-icon" style="color:var(--danger)">${ic('alertCircle', 18)}</div>
            <div>
              <div class="s-label">Failed to read Pi stats</div>
              <div class="s-sub">${e.message}</div>
            </div>
          </div>
        </div>`;
      console.error(e);
    }
  },

  // ── Room navigation ────────────────────────────────
  goBack() {
    this.showView(this.navFrom === 'devices' ? 'devices' : 'home');
    this.currentView = this.navFrom === 'devices' ? 'devices' : 'home';
    UI.setActiveNav(this.currentView);
    if (this.currentView === 'devices') this.renderDevicesView();
    else Rooms.render();
  },

  // ── Debug Playground ──────────────────────────────
  // Visual reference for every component in the design system + Casa
  // Control extras. Pure dummies — clicking things does nothing
  // destructive, but most interactive elements still work locally.
  renderDebugView() {
    const c = document.getElementById('debugContent');
    if (!c) return;

    const section = (title, body) => `
      <div class="section-label">${title}</div>
      <div class="dbg-section">${body}</div>`;

    const swatch = (label, klass) => `
      <div class="dbg-swatch">
        <div class="${klass}" style="width:60px;height:60px;border-radius:14px"></div>
        <div class="dbg-swatch-label">${label}</div>
      </div>`;

    const primitives = section('Primitives', `
      <div class="dbg-row">
        ${swatch('neu-raised',    'neu-raised')}
        ${swatch('neu-raised-sm', 'neu-raised-sm')}
        ${swatch('neu-pressed',   'neu-pressed')}
        ${swatch('neu-pressed-sm','neu-pressed-sm')}
      </div>`);

    const wells = section('Icon Wells', `
      <div class="dbg-row">
        <div class="dbg-swatch"><div class="icon-well sm">${ic('lightbulb', 14)}</div><div class="dbg-swatch-label">sm</div></div>
        <div class="dbg-swatch"><div class="icon-well">${ic('lightbulb', 18)}</div><div class="dbg-swatch-label">default</div></div>
        <div class="dbg-swatch"><div class="icon-well on">${ic('lightbulb', 18)}</div><div class="dbg-swatch-label">on</div></div>
        <div class="dbg-swatch"><div class="icon-well lg">${ic('lightbulb', 24)}</div><div class="dbg-swatch-label">lg</div></div>
      </div>`);

    const buttons = section('Buttons', `
      <div class="dbg-row">
        <div class="neu-btn">${ic('home', 18)}</div>
        <div class="neu-btn active">${ic('home', 18)}</div>
        <button class="neu-btn-rect">${ic('edit', 14)}<span>Default</span></button>
        <button class="neu-btn-rect active">${ic('check', 14)}<span>Active</span></button>
        <button class="btn-primary">Primary CTA</button>
      </div>
      <div class="dbg-row" style="margin-top:8px">
        <button class="modal-btn primary" style="max-width:140px">Modal Primary</button>
        <button class="modal-btn secondary" style="max-width:140px">Secondary</button>
        <button class="modal-btn danger" style="max-width:140px">Danger</button>
      </div>`);

    const toggles = section('Toggles', `
      <div class="dbg-row">
        <div class="dbg-swatch">
          <div class="toggle" onclick="this.classList.toggle('on')"><div class="knob"></div></div>
          <div class="dbg-swatch-label">off → tap</div>
        </div>
        <div class="dbg-swatch">
          <div class="toggle on" onclick="this.classList.toggle('on')"><div class="knob"></div></div>
          <div class="dbg-swatch-label">on → tap</div>
        </div>
      </div>`);

    // Functional sliders for debug — uid='demoX' makes startSlide skip the API call
    const demoSlider = (uid, prop, label, value) => {
      const min = prop === 'temp' ? 140 : 0;
      const max = prop === 'temp' ? 500 : 100;
      const display = prop === 'temp' ? Math.round(1000000 / value) + 'K' : Math.round(value) + '%';
      const pct = max > min ? ((value - min) / (max - min)) * 100 : value;
      return `
        <div class="slider-row">
          <span class="slider-label">${label}</span>
          <div class="slider-track"
               data-uid="${uid}" data-prop="${prop}" data-aid="0"
               data-ctype="demo" data-iid="0"
               data-step="1" data-min="${min}" data-max="${max}" data-mode="linear"
               onmousedown="Devices.startSlide(event)"
               ontouchstart="Devices.startSlide(event)">
            <div class="slider-fill ${prop}"
                 id="fill-${uid}-${prop}" style="width:${pct}%">
              <span class="slider-knob"></span>
            </div>
          </div>
          <span class="slider-value" id="val-${uid}-${prop}">${display}</span>
        </div>`;
    };

    const sliders = section('Sliders (drag — demo only, no API)', `
      ${demoSlider('demo1', 'brightness', 'Bri', 78)}
      ${demoSlider('demo2', 'speed', 'Speed', 50)}
      ${demoSlider('demo3', 'temp', 'Temp', 370)}`);

    // Static slider markup used inside the light-card preview below
    const staticSlider = (cls, pct, label, val) => `
      <div class="slider-row">
        <span class="slider-label">${label}</span>
        <div class="slider-track">
          <div class="slider-fill ${cls}" style="width:${pct}%"><span class="slider-knob"></span></div>
        </div>
        <span class="slider-value">${val}</span>
      </div>`;

    const colorRow = section('Color Picker', `
      <div class="color-row with-labels">
        <span class="color-label">Color</span>
        <span class="color-dot selected" style="background:#f6cf99;color:#f6cf99" data-kelvin="2700"></span>
        <span class="color-dot" style="background:#f8e4c4" data-kelvin="3000"></span>
        <span class="color-dot" style="background:#f4ecdb" data-kelvin="5000"></span>
        <span class="dot-divider"></span>
        <span class="color-dot" style="background:#d75a3e"></span>
        <span class="color-dot" style="background:#dba63b"></span>
        <span class="color-dot" style="background:#65b67c"></span>
        <span class="color-dot" style="background:#5b8ed8"></span>
        <span class="color-dot" style="background:#9170c4"></span>
        <span class="color-dot custom"></span>
      </div>`);

    const pills = section('Status Pills', `
      <div class="dbg-row">
        <span class="status-pill ok">OK</span>
        <span class="status-pill warning">Warning</span>
        <span class="status-pill alert">Alert</span>
        <span class="status-pill info">Info</span>
        <span class="status-pill battery ok">${ic('battery', 11)}<span>87%</span></span>
        <span class="status-pill battery warning">${ic('battery', 11)}<span>32%</span></span>
        <span class="status-pill battery alert">${ic('battery', 11)}<span>4%</span></span>
      </div>`);

    const banner = section('Low-Battery Banner', `
      <div class="low-battery-banner">
        <div class="lbb-icon">${ic('batteryLow', 18)}</div>
        <div class="lbb-text">
          <div class="lbb-title">2 devices need batteries</div>
          <div class="lbb-sub">Hue Dimmer Living Room 4% · Master Lamp Remote 12%</div>
        </div>
        <div class="lbb-pct critical">4%</div>
      </div>`);

    const statusTiles = section('Status Tiles (4-up)', `
      <div class="status-row">
        <div class="status-card neu-raised">
          <div class="status-icon">${ic('thermometer', 24)}</div>
          <div class="status-value">72°</div>
          <div class="status-label">Inside</div>
        </div>
        <div class="status-card neu-raised">
          <div class="status-icon">${ic('cloudSun', 24)}</div>
          <div class="status-value">57°</div>
          <div class="status-label">Outside</div>
        </div>
        <div class="status-card neu-raised">
          <div class="status-icon">${ic('shield', 24)}</div>
          <div class="status-value" style="color:var(--success)">OK</div>
          <div class="status-label">Security</div>
        </div>
        <div class="status-card neu-raised">
          <div class="status-icon">${ic('lightbulb', 24)}</div>
          <div class="status-value">3</div>
          <div class="status-label">Lights On</div>
        </div>
      </div>`);

    const roomCardChips = ['light','fan','sensor'].map(t => `
      <span class="room-type-chip ${t === 'light' ? 'active' : ''}">
        ${ic(t === 'light' ? 'lightbulb' : t === 'fan' ? 'wind' : 'thermometer', 11)}
        <span>${t === 'light' ? '2/4' : '1'}</span>
      </span>`).join('');

    const roomCardSample = section('Room Card', `
      <div class="room-grid">
        <div class="room-card neu-raised">
          <span class="room-icon-wrap">${ic('sofa', 28)}</span>
          <h3>Living Room</h3>
          <div class="room-types">
            <span class="room-type-chip temp">${ic('thermometer', 11)}<span>72°</span></span>
            ${roomCardChips}
          </div>
          <div class="room-active-dot"></div>
        </div>
        <div class="room-card neu-raised inactive">
          <span class="room-icon-wrap">${ic('bed', 28)}</span>
          <h3>Master Bedroom</h3>
          <div class="room-types">
            <span class="room-type-chip">${ic('lightbulb', 11)}<span>0/3</span></span>
          </div>
          <div class="room-active-dot"></div>
        </div>
      </div>`);

    const lightCardSample = section('Light Card (collapsed + expanded)', `
      <div class="light-list">
        <div class="light-card">
          <div class="light-top">
            <div class="icon-well on">${ic('lightbulb', 18)}</div>
            <div class="light-info">
              <div class="light-name">Pendant Light</div>
              <div class="light-status">On · 80%</div>
            </div>
            <span class="status-pill battery ok">${ic('battery', 11)}<span>92%</span></span>
            <span class="icon" style="color:var(--accent);padding:4px">${ic('starFill', 16)}</span>
            <span class="expand-btn icon" style="font-size:14px;color:var(--text-muted);padding:4px">${ic('chevDown', 14)}</span>
            <div class="toggle on" onclick="this.classList.toggle('on')"><div class="knob"></div></div>
          </div>
        </div>

        <div class="light-card expanded">
          <div class="light-top">
            <div class="icon-well on">${ic('lightbulb', 18)}</div>
            <div class="light-info">
              <div class="light-name">Reading Lamp</div>
              <div class="light-status">On · 50%</div>
            </div>
            <span class="icon" style="color:var(--text-muted);padding:4px">${ic('star', 16)}</span>
            <span class="expand-btn icon" style="font-size:14px;color:var(--text-muted);padding:4px">${ic('chevDown', 14)}</span>
            <div class="toggle on" onclick="this.classList.toggle('on')"><div class="knob"></div></div>
          </div>
          <div class="light-controls">
            ${staticSlider('brightness', 50, 'Bri', '50%')}
            <div class="color-row with-labels">
              <span class="color-label">Color</span>
              <span class="color-dot" style="background:#f6cf99" data-kelvin="2700"></span>
              <span class="color-dot selected" style="background:#f8e4c4;color:#f8e4c4" data-kelvin="3000"></span>
              <span class="color-dot" style="background:#f4ecdb" data-kelvin="5000"></span>
              <span class="dot-divider"></span>
              <span class="color-dot" style="background:#d75a3e"></span>
              <span class="color-dot" style="background:#65b67c"></span>
              <span class="color-dot custom"></span>
            </div>
            <div class="device-edit-row">
              <button class="neu-btn-rect">${ic('edit', 14)}<span>Edit Device</span></button>
            </div>
          </div>
        </div>

        <div class="light-card offline">
          <div class="light-top">
            <div class="icon-well">${ic('plug', 18)}</div>
            <div class="light-info">
              <div class="light-name">Garage Outlet</div>
              <div class="light-status"><span style="color:var(--danger)">Offline</span></div>
            </div>
            <span class="expand-btn icon" style="font-size:14px;color:var(--text-muted);padding:4px">${ic('chevDown', 14)}</span>
            <div class="toggle"><div class="knob"></div></div>
          </div>
        </div>
      </div>`);

    const masterRow = section('Master Row', `
      <div class="master-row neu-raised">
        <div class="master-info">
          <h3>Lights</h3>
          <span>2 of 3 on</span>
        </div>
        <div class="toggle on" onclick="this.classList.toggle('on')"><div class="knob"></div></div>
      </div>`);

    const typography = section('Typography', `
      <div style="display:flex;flex-direction:column;gap:6px">
        <h1>H1 — Outfit, 24px, 600</h1>
        <h2>H2 — Outfit, 20px, 600</h2>
        <h3>H3 — DM Sans, 15px, 600</h3>
        <div style="font-size:14px">Body — DM Sans, 14px, 400</div>
        <div style="font-size:13px;color:var(--text-secondary)">Sub — 13px, secondary text color</div>
        <div class="eyebrow">Eyebrow — Outfit, 11px, uppercase, 1.5px tracking</div>
        <div class="stat-num">22</div>
        <div class="mono">JetBrains Mono · 0123456789 · uniqueId snippet</div>
      </div>`);

    const allIcons = Object.keys(I).sort().map(name => `
      <div class="dbg-icon-cell" title="${name}">
        <div class="icon-well">${ic(name, 18)}</div>
        <div class="dbg-icon-name">${name}</div>
      </div>`).join('');

    const icons = section(`Icons (${Object.keys(I).length})`, `
      <div class="dbg-icon-grid">${allIcons}</div>`);

    c.innerHTML = primitives + wells + buttons + toggles + sliders + colorRow
      + pills + banner + statusTiles + roomCardSample + lightCardSample
      + masterRow + typography + icons;
  },

  // ── Weather ────────────────────────────────────────
  // Cache the most recent forecast so the weather view can render
  // instantly from cache while a fresh fetch happens in the background.
  _weatherCache: null,

  async fetchWeather() {
    try {
      const data = await API.getWeather(State.prefs.weatherLat, State.prefs.weatherLon);
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
    const loc = document.getElementById('weatherLocation');
    if (loc) loc.textContent = State.prefs.weatherCity || '—';

    if (this._weatherCache) this.renderWeather(this._weatherCache);
    else document.getElementById('weatherContent').innerHTML =
      '<div style="padding:40px 0;text-align:center;color:var(--text-muted)">Loading…</div>';

    try {
      const data = await API.getWeather(State.prefs.weatherLat, State.prefs.weatherLon);
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

  // ── House name preference ──────────────────────────
  setHouseName() {
    const inp = document.getElementById('houseNameInput');
    const name = (inp?.value || '').trim();
    State.prefs.houseName = name || 'Casa Control';
    State.savePrefs();
    const house = document.getElementById('houseName');
    if (house) house.textContent = State.prefs.houseName;
    UI.toast('Saved');
  },

  // ── Accent color preference ────────────────────────
  setAccent(hex) {
    State.prefs.accent = hex;
    State.savePrefs();
    State.applyAccent();
    this.renderSettingsView();
  },

  // ── Zip → geocode → weather location ───────────────
  async setZip() {
    const inp = document.getElementById('zipInput');
    const zip = (inp?.value || '').trim();
    if (!zip) {
      State.prefs.weatherZip = null;
      State.prefs.weatherLat = 34.1164;
      State.prefs.weatherLon = -118.3390;
      State.prefs.weatherCity = 'Los Angeles, CA';
      State.savePrefs();
      this._weatherCache = null;
      this.fetchWeather();
      this.renderSettingsView();
      UI.toast('Reset to default');
      return;
    }
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(zip)}&count=1&country=US`);
      if (!res.ok) throw new Error('Geocoding failed');
      const data = await res.json();
      const r = data.results?.[0];
      if (!r) { UI.toast('ZIP not found'); return; }
      State.prefs.weatherZip = zip;
      State.prefs.weatherLat = r.latitude;
      State.prefs.weatherLon = r.longitude;
      State.prefs.weatherCity = `${r.name}${r.admin1 ? ', ' + r.admin1 : ''}`;
      State.savePrefs();
      this._weatherCache = null;
      this.fetchWeather();
      this.renderSettingsView();
      UI.toast(`Set to ${State.prefs.weatherCity}`);
    } catch (e) {
      UI.toast('Geocoding failed');
      console.error(e);
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
