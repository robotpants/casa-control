/* ── Casa Control · devices.js ────────────────────────
   Device card rendering and control interactions.
   Reads from State, calls API, updates State on success.
   ───────────────────────────────────────────────────── */

const Devices = {

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
      <div class="light-card neu-raised ${isOffline ? 'offline' : ''}" id="card-${accessory.uniqueId}">
        <div class="light-top" onclick="${hasControls ? `Devices.toggleExpand('${accessory.uniqueId}')` : ''}">
          <div class="light-indicator ${isOn ? 'on' : ''}" id="ind-${accessory.uniqueId}">
            ${ic(icon, 18)}
          </div>
          <div class="light-info">
            <div class="light-name">${accessory.serviceName}</div>
            <div class="light-status" id="st-${accessory.uniqueId}">
              ${isOffline ? '<span style="color:var(--danger)">Offline</span>' : status}
            </div>
          </div>
          ${this.batteryHTML(accessory)}
          <div data-star
               style="cursor:pointer;font-size:16px;color:${isFav ? 'var(--accent)' : 'var(--text-muted)'};padding:4px"
               onclick="event.stopPropagation();Devices.toggleFav('${accessory.uniqueId}')">
            ${ic(isFav ? 'starFill' : 'star', 16)}
          </div>
          ${this.toggleHTML(accessory, roomId)}
          ${hasControls ? `
            <div class="expand-btn neu-btn" style="width:28px;height:28px;margin-left:4px">
              ${ic('chevDown', 12)}
            </div>` : ''}
        </div>
        ${hasControls ? `<div class="light-controls">${controls}</div>` : ''}
      </div>`;
  },

  // ── Inline battery pill ────────────────────────────
  // Surfaces the parent device's Battery service inline,
  // color-coded by level. Returns empty string if no battery.
  batteryHTML(accessory) {
    const b = State.getBattery(accessory);
    if (!b || b.level === null) return '';
    const level = b.level;
    const isLow = b.low || level < 20;
    const isWarn = !isLow && level < 40;
    const klass = isLow ? 'low' : (isWarn ? 'warn' : 'ok');
    const iconName = b.charging ? 'batteryCharging' : (isLow ? 'batteryLow' : 'battery');
    const title = `Battery ${level}%${b.charging ? ' · charging' : ''}${isLow ? ' · low' : ''}`;
    return `
      <span class="battery-pill ${klass}" title="${title}">
        ${ic(iconName, 11)}
        <span class="battery-pct">${level}%</span>
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
      if (tChar) {
        const minM = tChar.minValue ?? 140;
        const maxM = tChar.maxValue ?? 500;
        const step = tChar.minStep || 1;
        const val = State.getCharValue(accessory, 'ColorTemperature') ?? minM;
        html += this.colorSliderHTML(uid, 'temp', 'Temp', val, accessory.aid, 'ColorTemperature', tChar.iid, step, minM, maxM);
      }

      const hChar = findChar('Hue');
      if (hChar) {
        const step = hChar.minStep || 1;
        const val = State.getCharValue(accessory, 'Hue') ?? 0;
        html += this.colorSliderHTML(uid, 'hue', 'Color', val, accessory.aid, 'Hue', hChar.iid, step, 0, 360);
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

  // ── Slider HTML (linear: brightness, speed) ────────
  sliderHTML(uid, prop, label, value, aid, charType, iid, step = 1) {
    const fillClass = prop === 'brightness' ? 'brightness' : 'speed';
    return `
      <div class="slider-row">
        <div class="slider-label">${label}</div>
        <div class="slider-track"
             data-uid="${uid}" data-prop="${prop}" data-aid="${aid}"
             data-ctype="${charType}" data-iid="${iid}"
             data-step="${step}" data-min="0" data-max="100" data-mode="linear"
             onmousedown="Devices.startSlide(event)"
             ontouchstart="Devices.startSlide(event)">
          <div class="slider-fill ${fillClass}"
               id="fill-${uid}-${prop}" style="width:${Math.round(value)}%">
            <div class="slider-knob"></div>
          </div>
        </div>
        <div class="slider-value" id="val-${uid}-${prop}">${Math.round(value)}%</div>
      </div>`;
  },

  // ── Color slider HTML (hue, color temperature) ─────
  // Track shows the full color gradient; knob slides over it.
  colorSliderHTML(uid, prop, label, value, aid, charType, iid, step, min, max) {
    const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
    return `
      <div class="slider-row">
        <div class="slider-label">${label}</div>
        <div class="color-track ${prop}"
             data-uid="${uid}" data-prop="${prop}" data-aid="${aid}"
             data-ctype="${charType}" data-iid="${iid}"
             data-step="${step}" data-min="${min}" data-max="${max}" data-mode="color"
             onmousedown="Devices.startSlide(event)"
             ontouchstart="Devices.startSlide(event)">
          <div class="color-knob" id="knob-${uid}-${prop}" style="left:${pct}%"></div>
        </div>
        <div class="slider-value" id="val-${uid}-${prop}">${this.sliderDisplay(prop, value)}</div>
      </div>`;
  },

  // ── Format slider value for display ────────────────
  sliderDisplay(prop, value) {
    if (prop === 'temp') return Math.round(1000000 / value) + 'K';
    if (prop === 'hue') return Math.round(value) + '°';
    return Math.round(value) + '%';
  },

  // ── Toggle on/off ──────────────────────────────────
  async toggle(uniqueId) {
    const accessory = State.getAccessory(uniqueId);
    if (!accessory) return;

    const wasOn = State.isOn(accessory);
    const targetState = !wasOn;

    // Optimistic UI update
    this.updateIndicator(uniqueId, targetState);

    try {
      await API.setOnOff(accessory, targetState);
      const char = accessory.serviceCharacteristics.find(c => c.type === 'On' || c.type === 'Active');
      if (char) State.updateCharValue(accessory.aid, char.iid, targetState ? 1 : 0);
      this.updateStatus(uniqueId);
      Rooms.render();
    } catch (e) {
      // Revert on failure
      this.updateIndicator(uniqueId, wasOn);
      UI.toast('Failed to update device');
      console.error(e);
    }
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

    const finish = async () => {
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
