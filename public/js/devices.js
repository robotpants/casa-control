/* ── Casa Control · devices.js ────────────────────────────
   Device card rendering and control interactions.
   Reads from State, calls API, updates State on success.
   ───────────────────────────────────────────────────── */

const Devices = {

  // ── Color presets (real-world bulb colors, never UI accents) ─
  TEMP_PRESETS: [
    { key: 'candle',   name: 'Candle',   kelvin: 2300, swatch: '#f5b577' },
    { key: 'warm',     name: 'Warm',     kelvin: 2700, swatch: '#f6cf99' },
    { key: 'soft',     name: 'Soft',     kelvin: 3000, swatch: '#f8e4c4' },
    { key: 'daylight', name: 'Daylight', kelvin: 5000, swatch: '#f4ecdb' },
  ],

  COLOR_PRESETS: [
    { key: 'ember',  name: 'Ember',  hue: 12,  sat: 72, swatch: '#d75a3e' },
    { key: 'amber',  name: 'Amber',  hue: 42,  sat: 70, swatch: '#dba63b' },
    { key: 'green',  name: 'Green',  hue: 140, sat: 48, swatch: '#65b67c' },
    { key: 'blue',   name: 'Blue',   hue: 215, sat: 60, swatch: '#5b8ed8' },
    { key: 'purple', name: 'Purple', hue: 275, sat: 45, swatch: '#9170c4' },
  ],

  // ── Render device list for a room ──────────────────
  renderList(roomId) {
    const list = document.getElementById('lightList');
    if (!list) return;
    const accessories = State.getRoomAccessories(roomId);
    list.innerHTML = accessories.map((a, i) => this.cardHTML(a, roomId)).join('');
  },

  // ── Single device card ──────────────────────────
  cardHTML(accessory, roomId) {
    const type = State.getType(accessory);
    const isOn = State.isOn(accessory);
    const status = UI.deviceStatus(accessory);
    const icon = UI.deviceIcon(accessory);
    const isFav = State.isFav(accessory.uniqueId);
    const isOffline = accessory.instance?.connectionFailedCount > 0;

    const controls = this.controlsHTML(accessory, roomId);
    const hasControls = controls.length > 0;

    return `
      <div class="light-card ${isOffline ? 'offline' : ''}" id="card-${accessory.uniqueId}">
        <div class="light-top" onclick="Devices.toggleExpand('${accessory.uniqueId}')">
          <div class="icon-well ${isOn ? 'on' : ''}" id="ind-${accessory.uniqueId}">
            ${ic(icon, 18)}
          </div>
          <div class="light-info">
            <div class="light-name">${State.displayName(accessory)}</div>
            <div class="light-status" id="st-${accessory.uniqueId}">
              ${isOffline ? '<span style="color:var(--danger)">Offline</span>' : status}
            </div>
          </div>
          ${this.batteryHTML(accessory)}
          <span data-star class="icon"
                style="cursor:pointer;font-size:16px;color:${isFav ? 'var(--accent)' : 'var(--text-muted)'};padding:4px"
                onclick="event.stopPropagation();Devices.toggleFav('${accessory.uniqueId}')">
            ${ic(isFav ? 'starFill' : 'star', 16)}
          </span>
          <span class="expand-btn icon" style="font-size:14px;color:var(--text-muted);padding:4px;flex-shrink:0">${ic('chevDown', 14)}</span>
          ${this.toggleHTML(accessory, roomId)}
        </div>
        <div class="light-controls">
          ${controls}
          ${this.debugInfoHTML(accessory)}
          <div class="device-edit-row">
            <button class="neu-btn-rect" type="button" onclick="event.stopPropagation();Devices.openManageModal('${accessory.uniqueId}')">
              ${ic('edit', 14)}<span>Edit Device</span>
            </button>
          </div>
        </div>
      </div>`;
  },

  // ── Inline battery pill ──────────────────────────
  // Surfaces the parent device's Battery service inline,
  // using the design system's .status-pill semantic variants.
  batteryHTML(accessory) {
    const b = State.getBattery(accessory);
    if (!b || b.level === null) return '';
    const level = b.level;
    const isLow = b.low || level < 20;
    const isWarn = !isLow && level < 40;
    const variant = isLow ? 'alert' : (isWarn ? 'warning' : 'ok');
    const title = `Battery ${level}%${b.charging ? ' · charging' : ''}${isLow ? ' · low' : ''}`;
    return `
      <span class="status-pill battery ${variant}" title="${title}">
        ${ic('battery', 11)}
        <span>${level}%</span>
      </span>`;
  },

  // ── Toggle element ──────────────────────────────
  toggleHTML(accessory, roomId) {
    const type = State.getType(accessory);
    const isOn = State.isOn(accessory);

    if (type === 'sensor' || type === 'remote') {
      return `<div style="font-size:10px;font-weight:700;color:var(--text-muted);padding:4px 8px;letter-spacing:.5px">
        ${type === 'sensor' ? 'READ' : 'REMOTE'}
      </div>`;
    }

    return `
      <div class="toggle ${isOn ? 'on' : ''}" id="tog-${accessory.uniqueId}"
           onclick="event.stopPropagation();Devices.toggle('${accessory.uniqueId}')">
        <div class="knob"></div>
      </div>`;
  },

  // ── Controls (expanded area) ───────────────────────
  controlsHTML(accessory, roomId) {
    const type = State.getType(accessory);
    const uid = accessory.uniqueId;

    if (type === 'sensor' || type === 'remote') return '';

    let html = '';
    const chars = accessory.serviceCharacteristics || [];
    const findChar = (t) => chars.find(c => c.type === t);

    // Brightness, color temp, and color for lights
    if (type === 'light') {
      const isOn = State.isOn(accessory);

      const bChar = findChar('Brightness');
      if (bChar) {
        const brightness = State.getCharValue(accessory, 'Brightness') ?? 100;
        html += this.sliderHTML(uid, 'brightness', 'Bright', isOn ? brightness : 0, accessory.aid, 'Brightness', bChar.iid);
      }

      const tChar = findChar('ColorTemperature');
      const hChar = findChar('Hue');
      if (tChar || hChar) {
        html += this.colorPresetsHTML(accessory, tChar, hChar);
      }
    }

    // Speed slider for fans and purifiers
    if (type === 'fan' || type === 'purifier') {
      const speed = State.getCharValue(accessory, 'RotationSpeed') ?? 50;
      const char = findChar('RotationSpeed');
      if (char) {
        const step = char.minStep || 1;
        html += this.sliderHTML(uid, 'speed', 'Speed', speed, accessory.aid, 'RotationSpeed', char.iid, step);
      }
    }

    // Filter life for purifiers
    if (type === 'purifier') {
      const filterLife = State.getCharValue(accessory, 'FilterLifeLevel');
      if (filterLife !== null) {
        html += `
          <div class="slider-row" style="margin-top:8px">
            <div class="slider-label">Filter</div>
            <div style="flex:1;height:8px;border-radius:4px;background:var(--bg);box-shadow:var(--neu-pressed);position:relative">
              <div style="height:100%;border-radius:4px;width:${filterLife}%;background:${filterLife < 20 ? 'var(--danger)' : filterLife < 40 ? 'var(--warning)' : 'var(--success)'}"></div>
            </div>
            <div class="slider-value">${Math.round(filterLife)}%</div>
          </div>`;
      }
    }

    return html;
  },

  // ── Slider HTML (linear: brightness, speed, temp) ──
  // prop doubles as the slider-fill class (brightness/speed/temp all defined).
  sliderHTML(uid, prop, label, value, aid, charType, iid, step = 1, min = 0, max = 100) {
    const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
    const display = this.sliderDisplay(prop, value);
    return `
      <div class="slider-row">
        <span class="slider-label">${label}</span>
        <div class="slider-track"
             data-uid="${uid}" data-prop="${prop}" data-aid="${aid}"
             data-ctype="${charType}" data-iid="${iid}"
             data-step="${step}" data-min="${min}" data-max="${max}" data-mode="linear"
             onmousedown="Devices.startSlide(event)"
             ontouchstart="Devices.startSlide(event)">
          <div class="slider-fill ${prop}"
               id="fill-${uid}-${prop}" style="width:${pct}%">
            <span class="slider-knob"></span>
          </div>
        </div>
        <span class="slider-value" id="val-${uid}-${prop}">${display}</span>
      </div>`;
  },

  // ── Hue picker track (rainbow gradient with a draggable knob) ─
  hueTrackHTML(uid, value, aid, iid, step = 1) {
    const pct = (value / 360) * 100;
    return `
      <div class="slider-row">
        <span class="slider-label">Hue</span>
        <div class="color-track hue"
             data-uid="${uid}" data-prop="hue" data-aid="${aid}"
             data-ctype="Hue" data-iid="${iid}"
             data-step="${step}" data-min="0" data-max="360" data-mode="color"
             onmousedown="Devices.startSlide(event)"
             ontouchstart="Devices.startSlide(event)">
          <span class="color-knob" id="knob-${uid}-hue" style="left:${pct}%"></span>
        </div>
        <span class="slider-value" id="val-${uid}-hue">${Math.round(value)}°</span>
      </div>`;
  },

  // ── Color preset row (uses design system .color-row + .color-dot) ──
  // Compact dots: temp presets, divider, color presets, Custom.
  // Custom toggles a panel with a precise temp slider + hue picker.
  colorPresetsHTML(accessory, tChar, hChar) {
    const uid = accessory.uniqueId;
    const activeTemp = this._activeTempPreset(accessory, tChar);
    const activeColor = this._activeColorPreset(accessory, hChar);

    const dotHTML = (p, isActive, onclick, kLabel) => {
      const klass = `color-dot${isActive ? ' selected' : ''}`;
      const inlineColor = isActive ? `;color:${p.swatch}` : '';
      const kelvinAttr = kLabel ? ` data-kelvin="${kLabel}"` : '';
      return `<span class="${klass}" data-preset="${p.key}"${kelvinAttr}
                 style="background:${p.swatch}${inlineColor}"
                 onclick="event.stopPropagation();${onclick}"
                 title="${p.name}${kLabel ? ' ' + kLabel + 'K' : ''}"></span>`;
    };

    const tempDots = tChar ? this.TEMP_PRESETS.map(p =>
      dotHTML(p, p.key === activeTemp, `Devices.applyTempPreset('${uid}', '${p.key}')`, p.kelvin)
    ).join('') : '';

    const colorDots = hChar ? this.COLOR_PRESETS.map(p =>
      dotHTML(p, p.key === activeColor, `Devices.applyColorPreset('${uid}', '${p.key}')`)
    ).join('') : '';

    const divider = (tChar && hChar) ? '<span class="dot-divider"></span>' : '';

    let custom = '';
    if (tChar) {
      const minM = tChar.minValue ?? 140;
      const maxM = tChar.maxValue ?? 500;
      const step = tChar.minStep || 1;
      const val = State.getCharValue(accessory, 'ColorTemperature') ?? minM;
      custom += this.sliderHTML(uid, 'temp', 'Temp', val, accessory.aid, 'ColorTemperature', tChar.iid, step, minM, maxM);
    }
    if (hChar) {
      const step = hChar.minStep || 1;
      const val = State.getCharValue(accessory, 'Hue') ?? 0;
      custom += this.hueTrackHTML(uid, val, accessory.aid, hChar.iid, step);
    }

    return `
      <div class="color-row ${tChar ? 'with-labels' : ''}" id="color-${uid}">
        <span class="color-label">Color</span>
        ${tempDots}${divider}${colorDots}
        <span class="color-dot custom"
              onclick="event.stopPropagation();Devices.toggleCustomColor('${uid}')"
              title="Custom"></span>
      </div>
      <div class="color-custom" id="color-custom-${uid}">${custom}</div>`;
  },

  // ── Detect currently-active temp preset ────────────
  _activeTempPreset(accessory, tChar) {
    if (!tChar) return null;
    const cur = State.getCharValue(accessory, 'ColorTemperature');
    const sat = State.getCharValue(accessory, 'Saturation') ?? 0;
    if (cur == null || sat > 10) return null;
    const curK = 1000000 / cur;
    let best = null, bestDist = 250;
    for (const p of this.TEMP_PRESETS) {
      const d = Math.abs(curK - p.kelvin);
      if (d < bestDist) { bestDist = d; best = p.key; }
    }
    return best;
  },

  // ── Detect currently-active color preset ───────────
  _activeColorPreset(accessory, hChar) {
    if (!hChar) return null;
    const hue = State.getCharValue(accessory, 'Hue');
    const sat = State.getCharValue(accessory, 'Saturation') ?? 0;
    if (hue == null || sat < 20) return null;
    let best = null, bestDist = 22;
    for (const p of this.COLOR_PRESETS) {
      const d = Math.min(Math.abs(hue - p.hue), 360 - Math.abs(hue - p.hue));
      if (d < bestDist) { bestDist = d; best = p.key; }
    }
    return best;
  },

  // ── Apply a temp preset (Kelvin → mireds) ──────────
  applyTempPreset(uid, key) {
    const p = this.TEMP_PRESETS.find(x => x.key === key);
    const acc = State.getAccessory(uid);
    if (!p || !acc) return;
    const tChar = (acc.serviceCharacteristics || []).find(c => c.type === 'ColorTemperature');
    const sChar = (acc.serviceCharacteristics || []).find(c => c.type === 'Saturation');
    if (!tChar) return;
    const minM = tChar.minValue ?? 140;
    const maxM = tChar.maxValue ?? 500;
    const mireds = Math.max(minM, Math.min(maxM, Math.round(1000000 / p.kelvin)));

    // Capture pre-action state for revert
    const wasMireds = tChar.value;
    const wasSat = sChar?.value ?? null;
    const needsSatDrop = sChar && wasSat > 0;

    // ── Optimistic state + DOM ──
    // Drop saturation FIRST in State — Hue bulbs ignore ColorTemperature
    // while in color mode (saturation > 0), so the API call below sends
    // Saturation=0 before the temp change.
    if (needsSatDrop) State.updateCharValue(acc.aid, sChar.iid, 0);
    State.updateCharValue(acc.aid, tChar.iid, mireds);
    this._highlightPreset(uid, p);
    const knob = document.getElementById(`knob-${uid}-temp`);
    const valEl = document.getElementById(`val-${uid}-temp`);
    if (knob) knob.style.left = ((mireds - minM) / (maxM - minM)) * 100 + '%';
    if (valEl) valEl.textContent = p.kelvin + 'K';

    // ── Fire API in background ──
    const send = needsSatDrop
      ? API.setCharacteristic(uid, 'Saturation', 0)
          .catch(() => { /* secondary; let temp try anyway */ })
          .then(() => API.setCharacteristic(uid, 'ColorTemperature', mireds))
      : API.setCharacteristic(uid, 'ColorTemperature', mireds);

    send.catch(e => {
      // Revert State
      State.updateCharValue(acc.aid, tChar.iid, wasMireds);
      if (needsSatDrop) State.updateCharValue(acc.aid, sChar.iid, wasSat);
      // Revert DOM
      if (knob && wasMireds != null) {
        knob.style.left = ((wasMireds - minM) / (maxM - minM)) * 100 + '%';
      }
      if (valEl && wasMireds != null) {
        valEl.textContent = Math.round(1000000 / wasMireds) + 'K';
      }
      this._rehighlightFromState(uid);
      UI.toast('Failed to set color');
      console.error(e);
    });
  },

  // ── Apply a color preset (Hue + Saturation) ────────
  applyColorPreset(uid, key) {
    const p = this.COLOR_PRESETS.find(x => x.key === key);
    const acc = State.getAccessory(uid);
    if (!p || !acc) return;
    const chars = acc.serviceCharacteristics || [];
    const hChar = chars.find(c => c.type === 'Hue');
    const sChar = chars.find(c => c.type === 'Saturation');
    if (!hChar) return;

    // Capture pre-action state for revert
    const wasHue = hChar.value;
    const wasSat = sChar?.value ?? null;

    // ── Optimistic state + DOM ──
    State.updateCharValue(acc.aid, hChar.iid, p.hue);
    if (sChar) State.updateCharValue(acc.aid, sChar.iid, p.sat);
    this._highlightPreset(uid, p);
    const knob = document.getElementById(`knob-${uid}-hue`);
    const valEl = document.getElementById(`val-${uid}-hue`);
    if (knob) knob.style.left = (p.hue / 360) * 100 + '%';
    if (valEl) valEl.textContent = Math.round(p.hue) + '°';

    // ── Fire API in background (Hue, then Saturation as secondary) ──
    API.setCharacteristic(uid, 'Hue', p.hue)
      .then(() => {
        if (sChar) {
          API.setCharacteristic(uid, 'Saturation', p.sat).catch(() => {
            /* secondary; ignore */
          });
        }
      })
      .catch(e => {
        // Revert State
        State.updateCharValue(acc.aid, hChar.iid, wasHue);
        if (sChar) State.updateCharValue(acc.aid, sChar.iid, wasSat);
        // Revert DOM
        if (knob && wasHue != null) knob.style.left = (wasHue / 360) * 100 + '%';
        if (valEl && wasHue != null) valEl.textContent = Math.round(wasHue) + '°';
        this._rehighlightFromState(uid);
        UI.toast('Failed to set color');
        console.error(e);
      });
  },

  // ── Update the .selected dot in the color-row ──────
  _highlightPreset(uid, preset) {
    const row = document.getElementById(`color-${uid}`);
    if (!row) return;
    row.querySelectorAll('.color-dot[data-preset]').forEach(dot => {
      const isMatch = dot.dataset.preset === preset.key;
      dot.classList.toggle('selected', isMatch);
      if (isMatch) dot.style.color = preset.swatch;
      else dot.style.removeProperty('color');
    });
  },

  // ── Recompute and re-apply preset highlight from current State ──
  // Used on preset-apply failure: revert the .selected dot to whatever
  // preset (if any) matches the State after rollback.
  _rehighlightFromState(uid) {
    const acc = State.getAccessory(uid);
    if (!acc) return;
    const chars = acc.serviceCharacteristics || [];
    const tChar = chars.find(c => c.type === 'ColorTemperature');
    const hChar = chars.find(c => c.type === 'Hue');
    const activeTempKey = this._activeTempPreset(acc, tChar);
    const activeColorKey = this._activeColorPreset(acc, hChar);
    const activeKey = activeTempKey || activeColorKey;
    const row = document.getElementById(`color-${uid}`);
    if (!row) return;
    row.querySelectorAll('.color-dot[data-preset]').forEach(dot => {
      const isMatch = dot.dataset.preset === activeKey;
      dot.classList.toggle('selected', isMatch);
      if (isMatch) {
        const preset = [...this.TEMP_PRESETS, ...this.COLOR_PRESETS].find(p => p.key === activeKey);
        if (preset) dot.style.color = preset.swatch;
      } else {
        dot.style.removeProperty('color');
      }
    });
  },

  // ── Toggle custom color panel ───────────────────────
  toggleCustomColor(uid) {
    const panel = document.getElementById(`color-custom-${uid}`);
    if (panel) panel.classList.toggle('show');
  },

  // ── Format slider value for display ────────────────
  sliderDisplay(prop, value) {
    if (prop === 'temp') return Math.round(1000000 / value) + 'K';
    if (prop === 'hue') return Math.round(value) + '°';
    return Math.round(value) + '%';
  },

  // Recently-toggled devices: uid → expiresAt timestamp.
  // Refresh skips these so the optimistic value isn't overwritten by
  // the API still reporting the pre-toggle state for a few seconds.
  _recentToggles: {},

  // ── Toggle on/off ────────────────────────────────
  // Fire-and-forget: optimistic UI updates immediately; the HTTP
  // request runs in the background. Tile stays responsive even when
  // Homebridge / a slow plugin takes seconds to acknowledge.
  toggle(uniqueId) {
    const accessory = State.getAccessory(uniqueId);
    if (!accessory) return;

    const wasOn = State.isOn(accessory);
    const targetState = !wasOn;
    const type = State.getType(accessory);

    // Capture pre-toggle state so we can revert on failure.
    const onChar = accessory.serviceCharacteristics.find(c => c.type === 'On' || c.type === 'Active');
    const brightChar = accessory.serviceCharacteristics.find(c => c.type === 'Brightness');
    const speedChar = accessory.serviceCharacteristics.find(c => c.type === 'RotationSpeed');
    const wasBrightness = brightChar?.value ?? null;
    const wasSpeed = speedChar?.value ?? null;

    // ── Optimistic state update ──
    // Set State first so updateStatus / updateBrightnessSlider / Rooms.render
    // all read the new value. Before this, only the toggle/icon flipped
    // instantly while status text + slider + room counts had to wait for
    // the API roundtrip (1–3s on Lutron LEAP, longer on Hue).
    if (onChar) State.updateCharValue(accessory.aid, onChar.iid, targetState ? 1 : 0);

    // Dimmers (notably Lutron Caseta PD-6WCL): On=1 alone leaves
    // Brightness at 0, so the light "turns on" at 0% and the slider
    // sticks at 0. Bump to 100 on first On so the user sees light.
    //
    // Scoped to Lutron because the bump fires as a SECOND, sequential
    // API call (after On=1 resolves). For Hue / most other plugins the
    // bulb already remembers its last brightness, so the extra round-
    // trip just doubles the perceived "turn on" delay for no benefit.
    const mfg = (accessory.accessoryInformation?.Manufacturer || '').toLowerCase();
    const needsBrightnessBump = mfg.includes('lutron');
    let willBumpBrightness = false;
    if (targetState && type === 'light' && needsBrightnessBump && brightChar && (brightChar.value ?? 0) === 0) {
      State.updateCharValue(accessory.aid, brightChar.iid, 100);
      willBumpBrightness = true;
    }

    // Fans/purifiers: some plugins (Dreo) don't actually stop on
    // Active=0 alone — also send RotationSpeed=0 in the background.
    let willStopFan = false;
    if (!targetState && (type === 'fan' || type === 'purifier') && speedChar && (speedChar.value ?? 0) > 0) {
      State.updateCharValue(accessory.aid, speedChar.iid, 0);
      willStopFan = true;
    }

    // Render everything from the optimistic state, immediately.
    this.updateIndicator(uniqueId, targetState);
    this.updateStatus(uniqueId);
    this.updateBrightnessSlider(uniqueId);
    Rooms.render();
    if (App.currentView === 'room' && State.currentRoomId) {
      Rooms.refreshHeader?.(State.currentRoomId);
    }

    // Grace window blocks the next refresh poll from overwriting our
    // optimistic value with stale data.
    this._recentToggles[uniqueId] = Date.now() + 10000;

    // ── Fire the API call in the background ──
    API.setOnOff(accessory, targetState)
      .then(() => {
        // Primary call succeeded — fire any secondary writes.
        if (willBumpBrightness) {
          API.setCharacteristic(uniqueId, 'Brightness', 100).catch(() => {
            /* secondary; ignore */
          });
        }
        if (willStopFan) {
          API.setCharacteristic(uniqueId, 'RotationSpeed', 0).catch(() => {
            /* secondary; ignore */
          });
        }
      })
      .catch(e => {
        // Revert State to pre-toggle, then re-render.
        if (onChar) State.updateCharValue(accessory.aid, onChar.iid, wasOn ? 1 : 0);
        if (willBumpBrightness && brightChar) State.updateCharValue(accessory.aid, brightChar.iid, wasBrightness);
        if (willStopFan && speedChar) State.updateCharValue(accessory.aid, speedChar.iid, wasSpeed);
        this.updateIndicator(uniqueId, wasOn);
        this.updateStatus(uniqueId);
        this.updateBrightnessSlider(uniqueId);
        Rooms.render();
        if (App.currentView === 'room' && State.currentRoomId) {
          Rooms.refreshHeader?.(State.currentRoomId);
        }
        // Clear the grace window so the next refresh poll can resync
        // the actual on-device state instead of holding our wrong
        // optimistic value for the full 10s.
        delete this._recentToggles[uniqueId];
        let msg = 'Failed to update device';
        if (e.name === 'AbortError') msg = 'Device timed out';
        else if (e.mismatch) msg = 'Device ignored the change';
        UI.toast(msg);
        console.error(e);
      });
  },

  // ── Slider interaction ────────────────────────────
  startSlide(e) {
    e.preventDefault();
    const track = e.currentTarget;
    const uid = track.dataset.uid;
    const prop = track.dataset.prop;
    const aid = parseInt(track.dataset.aid);
    const charType = track.dataset.ctype;
    const iid = parseInt(track.dataset.iid);
    const step = parseFloat(track.dataset.step) || 1;
    const min = parseFloat(track.dataset.min) || 0;
    const max = parseFloat(track.dataset.max) || 100;
    const mode = track.dataset.mode || 'linear';

    const isDemo = uid && uid.startsWith('demo');

    // Capture pre-slide value so we can revert on API failure
    const acc = State.getAccessory(uid);
    const sliderChar = (acc?.serviceCharacteristics || []).find(c => c.iid === iid);
    const wasValue = sliderChar?.value ?? null;

    // Paint the slider DOM at a specific value (used both during drag and on revert)
    const applyVisual = (value) => {
      const displayPct = max > min ? ((value - min) / (max - min)) * 100 : 0;
      if (mode === 'color') {
        const knob = document.getElementById(`knob-${uid}-${prop}`);
        if (knob) knob.style.left = displayPct + '%';
      } else {
        const fill = document.getElementById(`fill-${uid}-${prop}`);
        if (fill) fill.style.width = displayPct + '%';
      }
      const val = document.getElementById(`val-${uid}-${prop}`);
      if (val) val.textContent = this.sliderDisplay(prop, value);
    };

    const update = (ev) => {
      const rect = track.getBoundingClientRect();
      const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
      let pct = ((clientX - rect.left) / rect.width) * 100;
      pct = Math.max(0, Math.min(100, pct));

      let value = min + (pct / 100) * (max - min);
      if (step > 0) value = Math.round(value / step) * step;
      value = Math.max(min, Math.min(max, value));
      applyVisual(value);
      return value;
    };

    let lastVal = update(e);
    App._isSliding = true;

    const finish = () => {
      App._isSliding = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', finish);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', finish);

      if (isDemo) return;  // debug-playground sliders: visual only

      // ── Optimistic state + dependent UI ──
      // State.updateCharValue first so updateStatus / updateBrightnessSlider
      // / Rooms.render read the new value. Slider DOM is already correct
      // from the drag. Status text (e.g. "75%") needs an explicit nudge.
      State.updateCharValue(aid, iid, lastVal);

      // Force Saturation to 100 when adjusting hue so the color is visible
      // (Hue bulbs left in low-sat color mode look washed out).
      let satForceWas = null;
      let satForceChar = null;
      if (prop === 'hue') {
        const sChar = (acc?.serviceCharacteristics || []).find(c => c.type === 'Saturation');
        if (sChar && sChar.value !== 100) {
          satForceChar = sChar;
          satForceWas = sChar.value;
          State.updateCharValue(aid, sChar.iid, 100);
        }
      }

      this.updateStatus(uid);
      if (prop === 'brightness') this.updateBrightnessSlider(uid);

      // ── Fire API in background ──
      API.setCharacteristic(uid, charType, lastVal)
        .then(() => {
          if (satForceChar) {
            API.setCharacteristic(uid, 'Saturation', 100).catch(() => {
              /* secondary; ignore */
            });
          }
        })
        .catch(err => {
          // Revert State + DOM
          if (wasValue != null) {
            State.updateCharValue(aid, iid, wasValue);
            applyVisual(wasValue);
          }
          if (satForceChar) State.updateCharValue(aid, satForceChar.iid, satForceWas);
          this.updateStatus(uid);
          if (prop === 'brightness') this.updateBrightnessSlider(uid);
          UI.toast('Failed to update');
          console.error(err);
        });
    };

    const onMove = (ev) => { lastVal = update(ev); };

    if (e.type === 'mousedown') {
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', finish);
    } else {
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', finish);
    }
  },

  // ── Expand/collapse controls ───────────────────────
  toggleExpand(uniqueId) {
    const card = document.getElementById(`card-${uniqueId}`);
    if (card) card.classList.toggle('expanded');
  },

  // ── Debug info row (inside expanded controls) ─────
  // Shows what's actually under the hood so you can tell similar
  // cards apart and figure out grouping strategies for new plugins.
  debugInfoHTML(accessory) {
    const info = accessory.accessoryInformation || {};
    const inst = accessory.instance || {};
    const sibs = State.getSiblings(accessory);
    const lines = [];
    if (info.Name) lines.push(`name  ${info.Name}`);
    if (info.Manufacturer || info.Model) {
      lines.push(`hw    ${[info.Manufacturer, info.Model].filter(Boolean).join(' · ')}`);
    }
    if (info.SerialNumber) lines.push(`sn    ${info.SerialNumber}`);
    if (inst.name) lines.push(`bridge ${inst.name}`);
    lines.push(`aid   ${accessory.aid}  ·  uid ${accessory.uniqueId.slice(0, 12)}…`);
    if (sibs.length) {
      lines.push(`bundled ${sibs.length + 1} services: ${[accessory.serviceName, ...sibs.map(s => s.serviceName)].join(', ')}`);
    } else {
      lines.push(`service ${accessory.serviceName} · ${accessory.humanType}`);
    }
    return `<pre class="device-debug">${lines.join('\n')}</pre>`;
  },

  // ── Manage modal (rename + room assignment) ───────
  openManageModal(uid) {
    const acc = State.getAccessory(uid);
    if (!acc) return;
    const currentName = State.displayName(acc);
    const currentRoom = State.rooms.find(r => (r.deviceIds || []).includes(uid));
    const isCustom = !!State.deviceNames[uid];
    const siblings = State.getSiblings(acc);
    const caps = State.getCapabilities(acc);
    const totalCaps = caps.handled.length + caps.missing.length;
    const capPct = totalCaps > 0 ? Math.round((caps.handled.length / totalCaps) * 100) : 0;

    const capabilitiesHTML = totalCaps === 0 ? '' : `
      <div class="modal-field">
        <label>Capabilities</label>
        <div style="display:flex;align-items:center;gap:10px;font-size:13px">
          <div style="font-family:var(--font-display);font-size:18px;font-weight:600;color:${capPct === 100 ? 'var(--success)' : capPct >= 50 ? 'var(--text-primary)' : 'var(--warning)'}">${capPct}%</div>
          <div style="color:var(--text-secondary)">${caps.handled.length} of ${totalCaps} handled by Casa Control</div>
        </div>
        ${caps.missing.length ? `
          <div style="font-size:11px;color:var(--text-muted);margin-top:8px;font-family:var(--font-mono);line-height:1.5">
            <span style="color:var(--text-secondary)">Not yet supported:</span><br>
            ${caps.missing.join(', ')}
          </div>` : `
          <div style="font-size:11px;color:var(--success);margin-top:6px">
            Everything this device exposes is wired up.
          </div>`}
      </div>`;

    const subServicesHTML = siblings.length === 0 ? '' : `
      <div class="modal-field">
        <label>Sub-services (${siblings.length + 1})</label>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">
          Bundled into one device. Tap-controllable from this card.
        </div>
        <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-secondary);background:var(--surface);box-shadow:var(--neu-pressed-sm);padding:10px 12px;border-radius:var(--radius-sm);max-height:120px;overflow-y:auto">
          <div>• ${acc.serviceName}</div>
          ${siblings.map(s => `<div>• ${s.serviceName}</div>`).join('')}
        </div>
      </div>`;

    UI.openModal(`
      <h2>Manage Device</h2>
      <div class="modal-field">
        <label>Display Name</label>
        <input class="modal-input" id="deviceNameInput" value="${currentName.replace(/"/g, '&quot;')}" maxlength="40" autocomplete="off">
        <div style="font-size:11px;color:var(--text-muted);margin-top:6px;font-family:var(--font-mono)">
          ${isCustom ? `Original: ${acc.serviceName}` : `&nbsp;`}
        </div>
      </div>
      <div class="modal-field">
        <label>Room</label>
        <select class="modal-input" id="deviceRoomSelect">
          <option value="">— Unassigned —</option>
          ${State.rooms.map(r => `
            <option value="${r.id}" ${currentRoom?.id === r.id ? 'selected' : ''}>${r.name}</option>
          `).join('')}
        </select>
      </div>
      <div class="modal-field">
        <label>Functions As</label>
        <select class="modal-input" id="deviceTypeSelect">
          <option value="">Auto-detect (${State.TYPE_LABELS[State.autoType(acc)] || State.autoType(acc)})</option>
          ${Object.entries(State.TYPE_LABELS).map(([k, label]) =>
            `<option value="${k}" ${State.deviceTypes[uid] === k ? 'selected' : ''}>${label}</option>`
          ).join('')}
        </select>
        <div style="font-size:11px;color:var(--text-muted);margin-top:6px;font-family:var(--font-mono)">
          ${acc.humanType || 'Unknown'}
        </div>
      </div>
      ${capabilitiesHTML}
      ${subServicesHTML}
      <div class="modal-actions">
        <button class="modal-btn secondary" onclick="UI.closeModal()">Cancel</button>
        <button class="modal-btn primary" onclick="Devices.saveManage('${uid}')">Save</button>
      </div>`);
    setTimeout(() => {
      const inp = document.getElementById('deviceNameInput');
      if (inp) { inp.focus(); inp.select(); }
    }, 350);
  },

  saveManage(uid) {
    const acc = State.getAccessory(uid);
    if (!acc) return;
    const newName = (document.getElementById('deviceNameInput')?.value || '').trim();
    const newRoomId = document.getElementById('deviceRoomSelect')?.value || '';
    const newType = document.getElementById('deviceTypeSelect')?.value || '';

    // Name override (local only — Homebridge UI keeps the technical name)
    if (newName && newName !== acc.serviceName) {
      State.deviceNames[uid] = newName;
    } else {
      delete State.deviceNames[uid];
    }
    State.saveDeviceNames();

    // Type override — empty string means "use auto-detect"
    if (newType && newType !== State.autoType(acc)) {
      State.deviceTypes[uid] = newType;
    } else {
      delete State.deviceTypes[uid];
    }
    State.saveDeviceTypes();

    // Room re-assignment (one-room-per-device rule)
    for (const r of State.rooms) {
      r.deviceIds = (r.deviceIds || []).filter(id => id !== uid);
    }
    if (newRoomId) {
      const room = State.rooms.find(r => r.id === newRoomId);
      if (room) {
        room.deviceIds = room.deviceIds || [];
        room.deviceIds.push(uid);
      }
    }
    State.saveRooms();

    UI.closeModal();
    Rooms.render();
    if (App.currentView === 'room' && State.currentRoomId) {
      Rooms.renderRoomContent(State.currentRoomId);
    }
    if (App.currentView === 'devices') App.renderDevicesView();
    UI.toast('Device updated');
  },

  // ── Favorites ───────────────────────────────────
  toggleFav(uniqueId) {
    State.toggleFav(uniqueId);
    const star = document.querySelector(`#card-${uniqueId} [data-star]`);
    const isFav = State.isFav(uniqueId);
    if (star) {
      star.style.color = isFav ? 'var(--accent)' : 'var(--text-muted)';
      star.innerHTML = ic(isFav ? 'starFill' : 'star', 16);
    }
    UI.toast(isFav ? 'Added to favorites' : 'Removed from favorites');
  },

  // ── Surgical DOM updates ───────────────────────────
  // NOTE: Devices.cardHTML is rendered in three places (favorites on
  // home view, room view's lightList, devices view's grid) with the
  // SAME element IDs. The hidden views stay in the DOM, so any given
  // `id` may match multiple elements. We deliberately use
  // querySelectorAll on `[id="..."]` here so we update every copy —
  // otherwise getElementById returns the first match (usually the
  // hidden favorite) and the visible toggle the user tapped never
  // flips. Yes, duplicate IDs is invalid HTML — TODO is to rework
  // cardHTML to take a scope/prefix, but updating-all is the safe
  // fix today and is also correct after the cleanup.
  updateIndicator(uniqueId, isOn) {
    document.querySelectorAll(`[id="ind-${uniqueId}"]`).forEach(el => el.classList.toggle('on', isOn));
    document.querySelectorAll(`[id="tog-${uniqueId}"]`).forEach(el => el.classList.toggle('on', isOn));
  },

  updateStatus(uniqueId) {
    const accessory = State.getAccessory(uniqueId);
    if (!accessory) return;
    const text = UI.deviceStatus(accessory);
    document.querySelectorAll(`[id="st-${uniqueId}"]`).forEach(el => { el.textContent = text; });
  },

  // Reflect on/off + current brightness in the slider DOM. cardHTML
  // initially renders width as `isOn ? brightness : 0`, but state changes
  // after that don't repaint without a full re-render — so we surgically
  // sync here whenever brightness or on-state changes.
  updateBrightnessSlider(uniqueId) {
    const acc = State.getAccessory(uniqueId);
    if (!acc) return;
    const brightness = State.getCharValue(acc, 'Brightness');
    if (brightness == null) return;
    const display = State.isOn(acc) ? brightness : 0;
    const widthPct = display + '%';
    const textPct = Math.round(display) + '%';
    document.querySelectorAll(`[id="fill-${uniqueId}-brightness"]`).forEach(el => { el.style.width = widthPct; });
    document.querySelectorAll(`[id="val-${uniqueId}-brightness"]`).forEach(el => { el.textContent = textPct; });
  },

};
