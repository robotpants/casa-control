/* ── Casa Control · devices.js ────────────────────────
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

  // ── Render device list for a room ─────────────────
  renderList(roomId) {
    const list = document.getElementById('lightList');
    if (!list) return;
    const accessories = State.getRoomAccessories(roomId);
    list.innerHTML = accessories.map((a, i) => this.cardHTML(a, roomId)).join('');
  },

  // ── Single device card ─────────────────────────────
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

  // ── Inline battery pill ────────────────────────────
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

  // ── Toggle element ─────────────────────────────────
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
  async applyTempPreset(uid, key) {
    const p = this.TEMP_PRESETS.find(x => x.key === key);
    const acc = State.getAccessory(uid);
    if (!p || !acc) return;
    const tChar = (acc.serviceCharacteristics || []).find(c => c.type === 'ColorTemperature');
    const sChar = (acc.serviceCharacteristics || []).find(c => c.type === 'Saturation');
    if (!tChar) return;
    const minM = tChar.minValue ?? 140;
    const maxM = tChar.maxValue ?? 500;
    const mireds = Math.max(minM, Math.min(maxM, Math.round(1000000 / p.kelvin)));
    try {
      // Drop saturation FIRST — Hue bulbs ignore ColorTemperature while in
      // color mode (saturation > 0), so the temp change gets stuck mid-state
      // unless we exit color mode first.
      if (sChar) {
        try {
          await API.setCharacteristic(uid, 'Saturation', 0);
          State.updateCharValue(acc.aid, sChar.iid, 0);
        } catch (_) { /* ignore */ }
      }
      await API.setCharacteristic(uid, 'ColorTemperature', mireds);
      State.updateCharValue(acc.aid, tChar.iid, mireds);
      this._highlightPreset(uid, p);
      const knob = document.getElementById(`knob-${uid}-temp`);
      const val = document.getElementById(`val-${uid}-temp`);
      if (knob) knob.style.left = ((mireds - minM) / (maxM - minM)) * 100 + '%';
      if (val) val.textContent = p.kelvin + 'K';
    } catch (e) {
      UI.toast('Failed to set color');
      console.error(e);
    }
  },

  // ── Apply a color preset (Hue + Saturation) ────────
  async applyColorPreset(uid, key) {
    const p = this.COLOR_PRESETS.find(x => x.key === key);
    const acc = State.getAccessory(uid);
    if (!p || !acc) return;
    const chars = acc.serviceCharacteristics || [];
    const hChar = chars.find(c => c.type === 'Hue');
    const sChar = chars.find(c => c.type === 'Saturation');
    if (!hChar) return;
    try {
      await API.setCharacteristic(uid, 'Hue', p.hue);
      State.updateCharValue(acc.aid, hChar.iid, p.hue);
      if (sChar) {
        await API.setCharacteristic(uid, 'Saturation', p.sat);
        State.updateCharValue(acc.aid, sChar.iid, p.sat);
      }
      this._highlightPreset(uid, p);
      const knob = document.getElementById(`knob-${uid}-hue`);
      const val = document.getElementById(`val-${uid}-hue`);
      if (knob) knob.style.left = (p.hue / 360) * 100 + '%';
      if (val) val.textContent = Math.round(p.hue) + '°';
    } catch (e) {
      UI.toast('Failed to set color');
      console.error(e);
    }
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

  // ── Toggle custom color panel ──────────────────────
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

  // ── Toggle on/off ──────────────────────────────────
  // Fire-and-forget: optimistic UI updates immediately; the HTTP
  // request runs in the background. Tile stays responsive even when
  // Homebridge / a slow plugin takes seconds to acknowledge.
  toggle(uniqueId) {
    const accessory = State.getAccessory(uniqueId);
    if (!accessory) return;

    const wasOn = State.isOn(accessory);
    const targetState = !wasOn;
    const type = State.getType(accessory);

    // Optimistic UI + grace window starts at click time
    this.updateIndicator(uniqueId, targetState);
    this._recentToggles[uniqueId] = Date.now() + 10000;

    API.setOnOff(accessory, targetState)
      .then(() => {
        const char = accessory.serviceCharacteristics.find(c => c.type === 'On' || c.type === 'Active');
        if (char) State.updateCharValue(accessory.aid, char.iid, targetState ? 1 : 0);

        // Fans/purifiers: some plugins (Dreo) don't actually stop on
        // Active=0 alone — also send RotationSpeed=0.
        if (!targetState && (type === 'fan' || type === 'purifier')) {
          const speedChar = accessory.serviceCharacteristics.find(c => c.type === 'RotationSpeed');
          if (speedChar && (speedChar.value ?? 0) > 0) {
            API.setCharacteristic(uniqueId, 'RotationSpeed', 0)
              .then(() => State.updateCharValue(accessory.aid, speedChar.iid, 0))
              .catch(() => { /* secondary; ignore */ });
          }
        }

        this.updateStatus(uniqueId);
        Rooms.render();
      })
      .catch(e => {
        this.updateIndicator(uniqueId, wasOn);
        UI.toast(e.name === 'AbortError' ? 'Device timed out' : 'Failed to update device');
        console.error(e);
      });
  },

  // ── Slider interaction ─────────────────────────────
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

    const update = (ev) => {
      const rect = track.getBoundingClientRect();
      const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
      let pct = ((clientX - rect.left) / rect.width) * 100;
      pct = Math.max(0, Math.min(100, pct));

      let value = min + (pct / 100) * (max - min);
      if (step > 0) value = Math.round(value / step) * step;
      value = Math.max(min, Math.min(max, value));

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

      return value;
    };

    let lastVal = update(e);
    App._isSliding = true;

    const finish = async () => {
      App._isSliding = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', finish);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', finish);

      try {
        await API.setCharacteristic(uid, charType, lastVal);
        State.updateCharValue(aid, iid, lastVal);
        // When changing hue, force saturation to 100 so the color is actually visible
        if (prop === 'hue') {
          const acc = State.getAccessory(uid);
          const sChar = (acc?.serviceCharacteristics || []).find(c => c.type === 'Saturation');
          if (sChar && sChar.value !== 100) {
            try {
              await API.setCharacteristic(uid, 'Saturation', 100);
              State.updateCharValue(aid, sChar.iid, 100);
            } catch (_) { /* ignore secondary failure */ }
          }
        }
      } catch (err) {
        UI.toast('Failed to update');
        console.error(err);
      }
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
        <label>Type</label>
        <div style="font-size:13px;color:var(--text-secondary);font-family:var(--font-mono)">
          ${acc.humanType || 'Unknown'}
        </div>
      </div>
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

    // Name override (local only — Homebridge UI keeps the technical name)
    if (newName && newName !== acc.serviceName) {
      State.deviceNames[uid] = newName;
    } else {
      delete State.deviceNames[uid];
    }
    State.saveDeviceNames();

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

  // ── Favorites ─────────────────────────────────────
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
  updateIndicator(uniqueId, isOn) {
    const ind = document.getElementById(`ind-${uniqueId}`);
    const tog = document.getElementById(`tog-${uniqueId}`);
    if (ind) ind.classList.toggle('on', isOn);
    if (tog) tog.classList.toggle('on', isOn);
  },

  updateStatus(uniqueId) {
    const accessory = State.getAccessory(uniqueId);
    if (!accessory) return;
    const st = document.getElementById(`st-${uniqueId}`);
    if (st) st.textContent = UI.deviceStatus(accessory);
  },

};
