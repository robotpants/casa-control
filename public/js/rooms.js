/* ── Casa Control · rooms.js ──────────────────────────
   Room grid rendering and room detail view.
   Reads from State, calls API, updates State on success.
   ───────────────────────────────────────────────────── */

const Rooms = {

  // ── Room Grid (Home view) ─────────────────────────
  render() {
    const grid = document.getElementById('roomGrid');
    if (!grid) return;

    grid.innerHTML = State.rooms.map((room, ri) => {
      const accessories = State.getRoomAccessories(room.id);
      const total = accessories.length;
      const breakdown = this._roomBreakdown(accessories);
      const temp = this._roomTemperature(accessories);
      const hasActive = breakdown.some(b => b.on > 0);

      const tempChip = temp !== null ? `
        <span class="room-type-chip temp" title="Current temperature">
          ${ic('thermometer', 11)}
          <span>${temp}°</span>
        </span>` : '';

      const chipsHTML = (breakdown.length === 0 && temp === null)
        ? '<div class="room-sub">No devices yet</div>'
        : `<div class="room-types">${tempChip}${breakdown.map(b => `
            <span class="room-type-chip ${b.on > 0 ? 'active' : ''}" title="${b.label}">
              ${ic(b.icon, 11)}
              <span>${b.on > 0 ? `${b.on}/${b.total}` : b.total}</span>
            </span>`).join('')}</div>`;

      return `
        <div class="room-card neu-raised ${State.editMode ? 'editing' : ''} ${!hasActive ? 'inactive' : ''}"
             onclick="${State.editMode ? `Rooms.openEditModal('${room.id}')` : `Rooms.openRoom('${room.id}')`}">
          <span class="room-icon-wrap">${ic(room.icon, 28)}</span>
          <h3>${room.name}</h3>
          ${chipsHTML}
          <div class="room-active-dot"></div>
          ${State.editMode ? `
            <div class="delete-btn neu-btn" onclick="event.stopPropagation();Rooms.confirmDelete('${room.id}')">
              ${ic('trash', 12)}
            </div>
            <div class="edit-room-btn neu-btn" onclick="event.stopPropagation();Rooms.openEditModal('${room.id}')">
              ${ic('edit', 12)}
            </div>
          ` : ''}
        </div>`;
    }).join('');

    grid.innerHTML += `
      <div class="add-room-card" onclick="Rooms.openAddModal()">
        ${ic('plus', 28)}
        <span>Add Room</span>
      </div>`;

    // Update active light count
    const countEl = document.getElementById('activeLightCount');
    if (countEl) countEl.textContent = State.getActiveLightCount();
  },

  // ── Representative room temperature ───────────────
  // Looks for any accessory in the room exposing CurrentTemperature
  // (Temperature Sensor, Heater Cooler, some purifiers/sensors).
  // Returns Fahrenheit rounded, or null if nothing usable.
  _roomTemperature(accessories) {
    for (const a of accessories) {
      const chars = a.serviceCharacteristics || [];
      const tChar = chars.find(c => c.type === 'CurrentTemperature');
      if (!tChar) continue;
      const v = tChar.value;
      if (v === null || v === undefined || isNaN(v)) continue;
      return Math.round(Number(v) * 9 / 5 + 32);
    }
    return null;
  },

  // ── Per-room device breakdown by category ─────────
  // Returns one entry per non-empty type with total/on counts so the
  // room card can show "💡 2/3 · 🌀 1" style chips at a glance.
  _roomBreakdown(accessories) {
    const order = [
      { type: 'light',    icon: 'lightbulb',   label: 'Lights' },
      { type: 'switch',   icon: 'plug',        label: 'Switches' },
      { type: 'fan',      icon: 'wind',        label: 'Fans' },
      { type: 'purifier', icon: 'airVent',     label: 'Air purifiers' },
      { type: 'heater',   icon: 'flame',       label: 'Heaters' },
      { type: 'sensor',   icon: 'thermometer', label: 'Sensors' },
      { type: 'remote',   icon: 'radio',       label: 'Remotes' },
    ];
    return order
      .map(o => {
        const items = accessories.filter(a => State.getType(a) === o.type);
        return { ...o, total: items.length, on: items.filter(a => State.isOn(a)).length };
      })
      .filter(b => b.total > 0);
  },

  // ── Open Room Detail ──────────────────────────────
  openRoom(id) {
    State.currentRoomId = id;
    const room = State.rooms.find(r => r.id === id);
    if (!room) return;

    const accessories = State.getRoomAccessories(id);
    const on = accessories.filter(a => State.isOn(a)).length;

    App.navFrom = App.currentView;
    App.currentView = 'room';

    document.querySelectorAll('.view').forEach(v => v.classList.remove('active', 'slide-in'));
    const roomView = document.getElementById('roomView');
    roomView.classList.add('active', 'slide-in');

    // Header
    document.getElementById('rvTitle').textContent = room.name;
    document.getElementById('rvSub').textContent = accessories.length
      ? `${on} of ${accessories.length} on`
      : 'No devices yet';

    this.renderRoomContent(id);
  },

  // ── Room Content ──────────────────────────────────
  renderRoomContent(id) {
    const room = State.rooms.find(r => r.id === id);
    if (!room) return;
    const accessories = State.getRoomAccessories(id);
    const lights = accessories.filter(a => State.getType(a) === 'light');
    const lightsOn = lights.filter(a => State.isOn(a)).length;
    const breakdown = this._roomBreakdown(accessories);
    const temp = this._roomTemperature(accessories);
    const c = document.getElementById('roomContent');

    if (!accessories.length) {
      c.innerHTML = `
        <div style="text-align:center;padding:40px 0;color:var(--text-muted)">
          <div style="font-size:48px;margin-bottom:16px">${ic(room.icon, 48)}</div>
          <p style="font-size:14px">No devices in this room yet.</p>
        </div>`;
      return;
    }

    // Stats panel (left): temp + per-type counts with full labels
    const statRows = [];
    if (temp !== null) {
      statRows.push(`
        <div class="room-stat temp">
          <span class="rs-icon">${ic('thermometer', 16)}</span>
          <span class="rs-value">${temp}°</span>
          <span class="rs-label">Temperature</span>
        </div>`);
    }
    for (const b of breakdown) {
      statRows.push(`
        <div class="room-stat ${b.on > 0 ? 'active' : ''}">
          <span class="rs-icon">${ic(b.icon, 16)}</span>
          <span class="rs-value">${b.on > 0 ? `${b.on}/${b.total}` : b.total}</span>
          <span class="rs-label">${b.label}</span>
        </div>`);
    }
    const statsPanel = `
      <div class="room-stats-panel neu-raised">
        ${statRows.join('')}
      </div>`;

    // Master row (right): lights toggle
    const masterRow = lights.length ? `
      <div class="master-row neu-raised">
        <div class="master-info">
          <h3>Lights</h3>
          <span id="masterStatus">${lightsOn} of ${lights.length} on</span>
        </div>
        <div class="toggle ${lightsOn > 0 ? 'on' : ''}" id="masterToggle"
             onclick="Rooms.toggleMaster('${id}')">
          <div class="knob"></div>
        </div>
      </div>` : '';

    c.innerHTML = `
      <div class="room-header-split ${lights.length ? '' : 'stats-only'}">
        ${statsPanel}
        ${masterRow}
      </div>
      <div class="section-label">Devices</div>
      <div class="light-list" id="lightList"></div>`;

    Devices.renderList(id);
  },

  // ── Master Toggle (lights only) ───────────────────
  // Brute-force "all off" / "all on" for any other category should be
  // handled by automations / scenes rather than this toggle.
  async toggleMaster(id) {
    const lights = State.getRoomAccessories(id)
      .filter(a => State.getType(a) === 'light');
    if (!lights.length) return;

    const anyOn = lights.some(a => State.isOn(a));
    const targetState = !anyOn;

    await Promise.allSettled(
      lights.map(a => API.setOnOff(a, targetState).then(() => {
        const char = a.serviceCharacteristics.find(c => c.type === 'On' || c.type === 'Active');
        if (char) State.updateCharValue(a.aid, char.iid, targetState ? 1 : 0);
      }))
    );

    this.renderRoomContent(id);
    this.render();
  },

  // ── Edit Mode ─────────────────────────────────────
  toggleEditMode() {
    State.editMode = !State.editMode;
    const btn = document.getElementById('editBtn');
    if (btn) btn.classList.toggle('active', State.editMode);
    this.render();
    UI.toast(State.editMode ? 'Tap trash to delete' : 'Edit mode off');
  },

  // ── Add Room Modal ────────────────────────────────
  openAddModal() {
    State._selectedIcon = 'sofa';
    UI.openModal(`
      <h2>Add Room</h2>
      <div class="modal-field">
        <label>Room Name</label>
        <input class="modal-input" id="roomNameInput" placeholder="e.g. Living Room" maxlength="30" autocomplete="off">
      </div>
      <div class="modal-field">
        <label>Icon</label>
        <div class="icon-grid" id="iconGrid">${Rooms._iconGrid('sofa')}</div>
      </div>
      <div class="modal-actions">
        <button class="modal-btn secondary" onclick="UI.closeModal()">Cancel</button>
        <button class="modal-btn primary" onclick="Rooms.addRoom()">Add Room</button>
      </div>`);
    setTimeout(() => document.getElementById('roomNameInput')?.focus(), 350);
  },

  // ── Edit Room Modal ───────────────────────────────
  openEditModal(id) {
    const room = State.rooms.find(r => r.id === id);
    if (!room) return;
    State._selectedIcon = room.icon;

    UI.openModal(`
      <h2>Edit Room</h2>
      <div class="modal-field">
        <label>Room Name</label>
        <input class="modal-input" id="roomNameInput" value="${room.name}" maxlength="30" autocomplete="off">
      </div>
      <div class="modal-field">
        <label>Icon</label>
        <div class="icon-grid">${Rooms._iconGrid(room.icon)}</div>
      </div>
      <div class="modal-field">
        <label>Devices</label>
        <div class="device-pick-list">${this._devicePickHTML(id)}</div>
      </div>
      <div class="modal-actions">
        <button class="modal-btn secondary" onclick="UI.closeModal()">Cancel</button>
        <button class="modal-btn primary" onclick="Rooms.saveEdit('${id}')">Save</button>
      </div>`);
    setTimeout(() => {
      const inp = document.getElementById('roomNameInput');
      if (inp) { inp.focus(); inp.select(); }
    }, 350);
  },

  // ── Device picker ──────────────────────────────────
  // Grouped checklist of every controllable device.
  // Shows current room of each device so user knows what they're moving.
  _devicePickHTML(roomId) {
    const all = State.getControllable();
    const inRoom = new Set((State.rooms.find(r => r.id === roomId)?.deviceIds) || []);
    const otherRoomFor = uid => State.rooms.find(r => r.id !== roomId && (r.deviceIds || []).includes(uid));

    const grouped = {};
    for (const a of all) {
      const t = State.getType(a);
      (grouped[t] = grouped[t] || []).push(a);
    }

    const order = [
      ['light',    'Lights'],
      ['switch',   'Switches'],
      ['fan',      'Fans'],
      ['purifier', 'Air Purifiers'],
      ['heater',   'Heaters'],
      ['sensor',   'Sensors'],
      ['remote',   'Remotes'],
    ];

    return order
      .filter(([k]) => grouped[k]?.length)
      .map(([k, label]) => `
        <div class="device-pick-group">
          <div class="device-pick-label">${label}</div>
          ${grouped[k].map(a => {
            const checked = inRoom.has(a.uniqueId);
            const other = !checked ? otherRoomFor(a.uniqueId) : null;
            return `
              <label class="device-pick-row ${checked ? 'checked' : ''}">
                <input type="checkbox" class="device-pick-cb" data-uid="${a.uniqueId}" ${checked ? 'checked' : ''}>
                <span class="device-pick-icon">${ic(UI.deviceIcon(a), 14)}</span>
                <span class="device-pick-name">${State.displayName(a)}</span>
                ${other ? `<span class="device-pick-other">${other.name}</span>` : ''}
              </label>`;
          }).join('')}
        </div>`).join('');
  },

  addRoom() {
    const name = document.getElementById('roomNameInput')?.value.trim();
    if (!name) { UI.toast('Enter a room name'); return; }
    State.rooms.push({
      id: 'room-' + Date.now(),
      name,
      icon: State._selectedIcon || 'sofa',
      deviceIds: []
    });
    State.saveRooms();
    UI.closeModal();
    this.render();
    UI.toast(`${name} added`);
  },

  saveEdit(id) {
    const room = State.rooms.find(r => r.id === id);
    if (!room) return;
    const name = document.getElementById('roomNameInput')?.value.trim();
    if (!name) { UI.toast('Enter a room name'); return; }
    room.name = name;
    room.icon = State._selectedIcon || room.icon;

    const checkedUids = Array.from(document.querySelectorAll('.device-pick-cb:checked'))
      .map(cb => cb.dataset.uid);

    // One-room-per-device: strip these uids out of every other room.
    for (const r of State.rooms) {
      if (r.id === id) continue;
      r.deviceIds = (r.deviceIds || []).filter(uid => !checkedUids.includes(uid));
    }
    room.deviceIds = checkedUids;

    State.saveRooms();
    UI.closeModal();
    this.render();
    if (State.currentRoomId === id && App.currentView === 'room') {
      const accessories = State.getRoomAccessories(id);
      const on = accessories.filter(a => State.isOn(a)).length;
      const titleEl = document.getElementById('rvTitle');
      const subEl = document.getElementById('rvSub');
      if (titleEl) titleEl.textContent = name;
      if (subEl) subEl.textContent = accessories.length
        ? `${on} of ${accessories.length} on`
        : 'No devices yet';
      this.renderRoomContent(id);
    }
    UI.toast(`${name} updated`);
  },

  confirmDelete(id) {
    const room = State.rooms.find(r => r.id === id);
    if (!room) return;
    UI.openModal(`
      <h2>Delete ${room.name}?</h2>
      <p style="color:var(--text-secondary);font-size:14px;margin-bottom:8px">
        This removes the room from your dashboard. Your actual devices are unaffected.
      </p>
      <div class="modal-actions">
        <button class="modal-btn secondary" onclick="UI.closeModal()">Cancel</button>
        <button class="modal-btn danger" onclick="Rooms.deleteRoom('${id}')">Delete</button>
      </div>`);
  },

  deleteRoom(id) {
    const room = State.rooms.find(r => r.id === id);
    State.rooms = State.rooms.filter(r => r.id !== id);
    State.saveRooms();
    UI.closeModal();
    this.render();
    UI.toast(`${room?.name || 'Room'} deleted`);
  },

  // ── Icon grid helper ───────────────────────────────
  _iconGrid(selected) {
    const icons = ['sofa', 'bed', 'monitor', 'chefHat', 'garage', 'tree',
                   'lightbulb', 'lamp', 'fan', 'wind', 'flame', 'thermometer',
                   'shield', 'star', 'home', 'plug'];
    return icons.map(i => `
      <div class="icon-option ${i === selected ? 'selected' : ''}"
           onclick="Rooms._selectIcon('${i}', this)">
        ${ic(i, 22)}
      </div>`).join('');
  },

  _selectIcon(name, el) {
    State._selectedIcon = name;
    document.querySelectorAll('.icon-option').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
  },

};
