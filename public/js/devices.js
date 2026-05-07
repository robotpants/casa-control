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

    // Brightness slider for lights
    if (type === 'light') {
      const brightness = State.getCharValue(accessory, 'Brightness') ?? 100;
      const isOn = State.isOn(accessory);
      const char = accessory.serviceCharacteristics.find(c => c.type === 'Brightness');
      if (char) {
        html += this.sliderHTML(uid, 'brightness', 'Bright', isOn ? brightness : 0, accessory.aid, 'Brightness', char.iid);
      }
    }

    // Speed slider for fans and purifiers
    if (type === 'fan' || type === 'purifier') {
      const speed = State.getCharValue(accessory, 'RotationSpeed') ?? 50;
      const char = accessory.serviceCharacteristics.find(c => c.type === 'RotationSpeed');
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

  // ── Slider HTML ────────────────────────────────────
  sliderHTML(uid, prop, label, value, aid, charType, iid, step = 1) {
    return `
      <div class="slider-row">
        <div class="slider-label">${label}</div>
        <div class="slider-track"
             data-uid="${uid}" data-prop="${prop}" data-aid="${aid}"
             data-ctype="${charType}" data-iid="${iid}" data-step="${step}"
             onmousedown="Devices.startSlide(event)"
             ontouchstart="Devices.startSlide(event)">
          <div class="slider-fill ${prop === 'brightness' ? 'brightness' : 'speed'}"
               id="fill-${uid}-${prop}" style="width:${value}%">
            <div class="slider-knob"></div>
          </div>
        </div>
        <div class="slider-value" id="val-${uid}-${prop}">${value}%</div>
      </div>`;
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

    const update = (ev) => {
      const rect = track.getBoundingClientRect();
      const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
      let pct = Math.round(((clientX - rect.left) / rect.width) * 100);
      pct = Math.max(0, Math.min(100, pct));
      // Snap to step
      if (step > 1) pct = Math.round(pct / step) * step;

      const fill = document.getElementById(`fill-${uid}-${prop}`);
      const val = document.getElementById(`val-${uid}-${prop}`);
      if (fill) fill.style.width = pct + '%';
      if (val) val.textContent = pct + '%';

      return pct;
    };

    let lastPct = update(e);

    const finish = async () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', finish);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', finish);

      try {
        await API.setCharacteristic(aid, charType, lastPct);
        State.updateCharValue(aid, iid, lastPct);
      } catch (err) {
        UI.toast('Failed to update');
        console.error(err);
      }
    };

    const onMove = (ev) => { lastPct = update(ev); };

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
