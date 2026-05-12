/* ── Casa Control · spotify.js ────────────────────────
   Spotify Connect remote control. Polls /api/spotify/now-playing
   and renders a card between greeting and room grid: compact by
   default, expandable on tap for transport / volume / device picker.

   Polls slow (30s) when idle, fast (5s) when something's playing.
   Between polls, progress is interpolated locally so the bar
   advances smoothly without hammering the server.

   Hidden when nothing's playing or before the user has connected.
   ───────────────────────────────────────────────────── */

const Spotify = {

  POLL_ACTIVE_MS: 5000,
  POLL_IDLE_MS: 30000,

  _timer: null,
  _tickTimer: null,         // 1s progress-bar tick
  _connected: false,
  _expanded: false,
  _isPlaying: false,
  _pendingTransport: false,
  _pendingVolume: false,    // ignore poll-driven volume updates during drag

  // Last server snapshot — needed to interpolate progress.
  _progressMs: 0,
  _durationMs: 0,
  _progressAt: 0,           // Date.now() when _progressMs was captured

  _volume: 0,
  _deviceName: '',
  _devices: [],
  _devicePickerOpen: false,

  _statusCache: null,

  async init() {
    try {
      const status = await fetch('/api/spotify/status').then(r => r.json());
      this._statusCache = status;
      this._connected = !!status.connected;
    } catch (e) { return; }
    this._wrapSettingsView();
    if (!this._connected) { this._hide(); return; }
    this._poll();
  },

  // ── Settings tile (Connected services section) ─────
  // Hooked in by wrapping App.renderSettingsView so app.js itself
  // stays untouched. After App finishes painting Settings, we inject
  // a "Services" section above the About card. Future services
  // (Ecobee, etc.) can plug their own tiles into the same section.
  _wrapSettingsView() {
    if (typeof App === 'undefined' || !App.renderSettingsView) return;
    if (App._spotifyWrapped) return;
    const orig = App.renderSettingsView.bind(App);
    App.renderSettingsView = (...args) => {
      const out = orig(...args);
      Spotify._renderSettingsCard();
      return out;
    };
    App._spotifyWrapped = true;
  },

  async _renderSettingsCard() {
    const content = document.getElementById('settingsContent');
    if (!content) return;
    // Avoid duplicating on rapid re-renders.
    const existing = document.getElementById('servicesSection');
    if (existing) existing.remove();

    let status = this._statusCache;
    try {
      status = await fetch('/api/spotify/status').then(r => r.json());
      this._statusCache = status;
    } catch (e) { /* fall back to cache */ }
    status = status || { connected: false, configured: false, displayName: null };

    const dotColor   = status.connected ? 'var(--success)' : 'var(--text-muted)';
    const statusText = status.connected
      ? `Connected as <strong>${this._escape(status.displayName || '—')}</strong>`
      : (status.configured ? 'Not connected' : 'Not configured');
    const btn = status.connected
      ? `<button class="modal-btn secondary" style="flex:0 0 auto;padding:8px 14px;max-width:120px" onclick="Spotify._disconnect()">Disconnect</button>`
      : (status.configured
          ? `<button class="modal-btn primary" style="flex:0 0 auto;padding:8px 14px;max-width:120px" onclick="Spotify._connect()">Connect</button>`
          : '');
    // Spotify wordmark glyph — green circle, no dependency on icons.js.
    const spotifyIcon = `
      <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="11" fill="#1db954"/>
        <path fill="#fff" d="M17.5 16.3a.7.7 0 0 1-1 .25c-2.7-1.65-6.1-2.03-10.1-1.1a.7.7 0 1 1-.3-1.37c4.4-1 8.2-.57 11.2 1.25a.7.7 0 0 1 .2.97zm1.45-2.9a.88.88 0 0 1-1.2.3c-3.1-1.9-7.8-2.45-11.45-1.35a.88.88 0 1 1-.5-1.7c4.2-1.25 9.4-.65 12.95 1.55a.88.88 0 0 1 .2 1.2zm.13-3.05c-3.7-2.2-9.85-2.4-13.4-1.32a1.05 1.05 0 1 1-.6-2.02c4.1-1.25 10.9-1 15.15 1.5a1.05 1.05 0 1 1-1.15 1.83z"/>
      </svg>`;

    const section = document.createElement('div');
    section.id = 'servicesSection';
    section.innerHTML = `
      <div class="section-label">Services</div>
      <div class="settings-group">
        <div class="settings-item neu-raised">
          <div class="left">
            <div class="s-icon" style="background:transparent;box-shadow:none">${spotifyIcon}</div>
            <div>
              <div class="s-label">Spotify</div>
              <div class="s-sub">
                <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${dotColor};margin-right:6px;vertical-align:middle"></span>${statusText}
              </div>
            </div>
          </div>
          ${btn}
        </div>
      </div>
    `;

    // Insert before About if present; otherwise append.
    const labels = content.querySelectorAll('.section-label');
    const about = Array.from(labels).find(l => l.textContent.trim() === 'About');
    if (about) content.insertBefore(section, about);
    else content.appendChild(section);
  },

  _connect() {
    window.location.href = '/api/spotify/auth';
  },

  async _disconnect() {
    if (!confirm("Disconnect Spotify? You'll need to re-authorize next time.")) return;
    try {
      await fetch('/api/spotify/disconnect', { method: 'DELETE' });
    } catch (e) { /* ignore */ }
    this._connected = false;
    this._statusCache = { connected: false, configured: true, displayName: null };
    this._hide();
    if (typeof App !== 'undefined' && App.renderSettingsView) App.renderSettingsView();
  },

  _scheduleNext(active) {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this._poll(),
      active ? this.POLL_ACTIVE_MS : this.POLL_IDLE_MS);
  },

  async _poll() {
    let active = false;
    try {
      const res = await fetch('/api/spotify/now-playing');
      if (res.status === 204) {
        this._hide();
      } else if (res.ok) {
        active = this._render(await res.json());
      } else {
        this._hide();
      }
    } catch (e) { /* network blip — keep card */ }
    this._scheduleNext(active);
  },

  // Returns true if something is actively playing.
  _render(data) {
    if (!data || !data.item) { this._hide(); return false; }
    const item   = data.item;
    const title  = item.name || '';
    const artist = (item.artists || []).map(a => a.name).join(', ');
    const album  = item.album?.name || '';
    const art    = (item.album?.images || []).slice().sort((a, b) => (a.width || 0) - (b.width || 0));
    // For the compact view, pick smallest >= 64px; for expanded we want
    // a larger image — use whichever is closest to 200px.
    const artSmall = (art.find(i => (i.width || 0) >= 64) || art[art.length - 1])?.url || '';
    const artLarge = (art.find(i => (i.width || 0) >= 200) || art[art.length - 1])?.url || '';
    const isPlaying = !!data.is_playing;
    this._isPlaying = isPlaying;
    this._progressMs = data.progress_ms || 0;
    this._durationMs = item.duration_ms || 0;
    this._progressAt = Date.now();
    if (data.device) {
      this._deviceName = data.device.name || '';
      // Don't clobber a volume the user is dragging right now.
      if (!this._pendingVolume && typeof data.device.volume_percent === 'number') {
        this._volume = data.device.volume_percent;
      }
    }

    const root = this._ensureCard();
    root.style.display = '';
    root.classList.toggle('expanded', this._expanded);

    // Compact + expanded both have .np-source — update every copy so
    // expanding doesn't reveal stale text. .np-track-lg / .np-artist-lg
    // mirror the compact title/artist in larger type.
    const sourceText = this._deviceName ? `Spotify · ${this._deviceName}` : 'Spotify';
    const artistText = album ? `${artist} · ${album}` : artist;
    root.querySelectorAll('.np-source').forEach(el => el.textContent = sourceText);
    root.querySelector('.np-track').textContent = title;
    root.querySelector('.np-artist').textContent = artistText;
    const trackLg  = root.querySelector('.np-track-lg');
    const artistLg = root.querySelector('.np-artist-lg');
    if (trackLg)  trackLg.textContent  = title;
    if (artistLg) artistLg.textContent = artistText;

    this._paintArt(root.querySelector('.np-art'),    artSmall);
    this._paintArt(root.querySelector('.np-art-lg'), artLarge || artSmall);

    const toggle = root.querySelector('.np-mini-toggle');
    toggle.classList.toggle('on', isPlaying);
    toggle.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
    const big = root.querySelector('.np-play-big');
    if (big) {
      big.classList.toggle('on', isPlaying);
      big.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
    }

    this._paintProgress();
    this._paintVolume();
    this._startTicker();
    return isPlaying;
  },

  _paintArt(el, url) {
    if (!el) return;
    if (url) {
      el.style.backgroundImage = `url("${url}")`;
      el.classList.add('has-art');
    } else {
      el.style.backgroundImage = '';
      el.classList.remove('has-art');
    }
  },

  _hide() {
    const root = document.getElementById('nowPlaying');
    if (root) root.style.display = 'none';
    this._expanded = false;
    clearInterval(this._tickTimer);
    this._tickTimer = null;
  },

  // ── DOM construction ──────────────────────────────────
  _ensureCard() {
    let root = document.getElementById('nowPlaying');
    if (root) return root;
    const host = document.querySelector('#homeView .stagger');
    if (!host) return null;
    root = document.createElement('div');
    root.id = 'nowPlaying';
    root.className = 'now-playing-widget';
    root.style.display = 'none';
    root.innerHTML = `
      <!-- compact row -->
      <div class="np-compact">
        <div class="np-art"></div>
        <div class="np-info">
          <div class="np-source">Spotify</div>
          <div class="np-track"></div>
          <div class="np-artist"></div>
        </div>
        <button class="np-mini-toggle" type="button" aria-label="Play"></button>
      </div>

      <!-- expanded body, shown via .expanded class -->
      <div class="np-expanded-body">
        <div class="np-expanded-row">
          <div class="np-art-lg"></div>
          <div class="np-info">
            <div class="np-source"></div>
            <div class="np-track-lg"></div>
            <div class="np-artist-lg"></div>
          </div>
        </div>
        <div class="np-progress"><div class="np-progress-fill"></div></div>
        <div class="np-progress-times">
          <span class="np-pos">0:00</span>
          <span class="np-dur">0:00</span>
        </div>
        <div class="np-transport-row">
          <button class="np-transport-btn np-prev" type="button" aria-label="Previous"></button>
          <button class="np-play-big" type="button" aria-label="Play"></button>
          <button class="np-transport-btn np-next" type="button" aria-label="Next"></button>
        </div>
        <div class="np-volume-row">
          <span class="np-vol-icon"></span>
          <div class="np-vol-track"><div class="np-vol-fill"></div></div>
          <span class="np-vol-value">--%</span>
        </div>
        <div class="np-device-row">
          <button class="np-device-btn" type="button">
            <span class="np-device-label">Playing on —</span>
            <span class="np-device-chev">▾</span>
          </button>
          <div class="np-device-list" style="display:none"></div>
        </div>
      </div>
    `;
    host.insertBefore(root, host.firstChild);
    this._wire(root);
    return root;
  },

  _wire(root) {
    // Tapping the compact row (anywhere except the mini toggle) expands.
    // Tapping the expanded row's art/info area collapses — the compact
    // strip is hidden once expanded, so this is the only way back.
    const toggleExpand = () => {
      this._expanded = !this._expanded;
      root.classList.toggle('expanded', this._expanded);
      if (this._expanded) this._refreshDevices();
    };
    root.querySelector('.np-compact').addEventListener('click', e => {
      if (e.target.closest('.np-mini-toggle')) return;
      toggleExpand();
    });
    root.querySelector('.np-expanded-row').addEventListener('click', toggleExpand);

    root.querySelector('.np-mini-toggle').addEventListener('click', e => {
      e.stopPropagation();
      this._togglePlay();
    });
    root.querySelector('.np-play-big').addEventListener('click', e => {
      e.stopPropagation();
      this._togglePlay();
    });
    root.querySelector('.np-prev').addEventListener('click', e => {
      e.stopPropagation();
      this._transport('previous', 'POST');
    });
    root.querySelector('.np-next').addEventListener('click', e => {
      e.stopPropagation();
      this._transport('next', 'POST');
    });

    // Volume drag — pointer events handle mouse + touch uniformly.
    const vTrack = root.querySelector('.np-vol-track');
    const onDown = e => {
      e.preventDefault();
      this._pendingVolume = true;
      const onMove = ev => this._dragVolume(vTrack, ev);
      const onUp = ev => {
        this._dragVolume(vTrack, ev);
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        this._commitVolume();
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      this._dragVolume(vTrack, e);
    };
    vTrack.addEventListener('pointerdown', onDown);

    // Device picker toggle + delegated row clicks.
    root.querySelector('.np-device-btn').addEventListener('click', e => {
      e.stopPropagation();
      this._devicePickerOpen = !this._devicePickerOpen;
      root.querySelector('.np-device-list').style.display =
        this._devicePickerOpen ? '' : 'none';
      if (this._devicePickerOpen) this._refreshDevices();
    });
    root.querySelector('.np-device-list').addEventListener('click', e => {
      const row = e.target.closest('.np-device-row-item');
      if (!row) return;
      this._transferTo(row.dataset.id);
    });
  },

  // ── Progress bar interpolation ──────────────────────
  _startTicker() {
    if (this._tickTimer) return;
    this._tickTimer = setInterval(() => this._paintProgress(), 1000);
  },

  _paintProgress() {
    const root = document.getElementById('nowPlaying');
    if (!root) return;
    let pos = this._progressMs;
    if (this._isPlaying) pos += (Date.now() - this._progressAt);
    if (pos > this._durationMs) pos = this._durationMs;
    const pct = this._durationMs > 0 ? (pos / this._durationMs) * 100 : 0;
    const fill = root.querySelector('.np-progress-fill');
    if (fill) fill.style.width = pct + '%';
    const posEl = root.querySelector('.np-pos');
    const durEl = root.querySelector('.np-dur');
    if (posEl) posEl.textContent = this._fmtMs(pos);
    if (durEl) durEl.textContent = this._fmtMs(this._durationMs);
  },

  _fmtMs(ms) {
    if (!ms || ms < 0) return '0:00';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, '0')}`;
  },

  // ── Transport actions ───────────────────────────────
  async _togglePlay() {
    if (this._pendingTransport) return;
    this._pendingTransport = true;
    const next = !this._isPlaying;
    this._isPlaying = next;
    if (next) this._progressAt = Date.now(); // restart interpolation clock
    this._paintToggles(next);
    try {
      const res = await fetch(next ? '/api/spotify/play' : '/api/spotify/pause', { method: 'PUT' });
      if (!res.ok && res.status !== 204) throw new Error('HTTP ' + res.status);
    } catch (e) {
      this._isPlaying = !next;
      this._paintToggles(!next);
      console.warn('Spotify transport failed:', e.message);
    } finally {
      this._pendingTransport = false;
      clearTimeout(this._timer);
      this._timer = setTimeout(() => this._poll(), 600);
    }
  },

  _paintToggles(isPlaying) {
    const root = document.getElementById('nowPlaying');
    if (!root) return;
    root.querySelector('.np-mini-toggle').classList.toggle('on', isPlaying);
    const big = root.querySelector('.np-play-big');
    if (big) big.classList.toggle('on', isPlaying);
  },

  async _transport(name, method) {
    try {
      const res = await fetch('/api/spotify/' + name, { method });
      if (!res.ok && res.status !== 204) throw new Error('HTTP ' + res.status);
    } catch (e) {
      console.warn('Spotify ' + name + ' failed:', e.message);
    }
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this._poll(), 600);
  },

  // ── Volume drag ────────────────────────────────────
  _dragVolume(track, evt) {
    const rect = track.getBoundingClientRect();
    const x = (evt.clientX ?? 0) - rect.left;
    let pct = Math.round((x / rect.width) * 100);
    pct = Math.max(0, Math.min(100, pct));
    this._volume = pct;
    this._paintVolume();
  },

  _paintVolume() {
    const root = document.getElementById('nowPlaying');
    if (!root) return;
    const fill = root.querySelector('.np-vol-fill');
    if (fill) fill.style.width = this._volume + '%';
    const val = root.querySelector('.np-vol-value');
    if (val) val.textContent = this._volume + '%';
  },

  async _commitVolume() {
    const v = this._volume;
    try {
      const res = await fetch('/api/spotify/volume?volume_percent=' + v, { method: 'PUT' });
      if (!res.ok && res.status !== 204) {
        // Some Connect devices don't accept volume (Echo, casts). Log and move on.
        console.warn('Spotify volume rejected (' + res.status + ') — device may not support it');
      }
    } catch (e) {
      console.warn('Spotify volume failed:', e.message);
    } finally {
      this._pendingVolume = false;
    }
  },

  // ── Devices ────────────────────────────────────────
  async _refreshDevices() {
    try {
      const res = await fetch('/api/spotify/devices');
      if (!res.ok) return;
      const data = await res.json();
      this._devices = data.devices || [];
      this._renderDeviceList();
    } catch (e) { /* skip */ }
  },

  _renderDeviceList() {
    const root = document.getElementById('nowPlaying');
    if (!root) return;
    const list = root.querySelector('.np-device-list');
    const btnLabel = root.querySelector('.np-device-label');
    const active = this._devices.find(d => d.is_active);
    btnLabel.textContent = active ? `Playing on ${active.name}` : 'Choose device';
    if (!this._devices.length) {
      list.innerHTML = '<div class="np-device-empty">No active Spotify devices</div>';
      return;
    }
    list.innerHTML = this._devices.map(d => `
      <div class="np-device-row-item ${d.is_active ? 'active' : ''}" data-id="${d.id}">
        <span class="np-device-name">${this._escape(d.name)}</span>
        <span class="np-device-type">${this._escape(d.type || '')}</span>
      </div>
    `).join('');
  },

  _escape(s) {
    return (s || '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  },

  async _transferTo(deviceId) {
    if (!deviceId) return;
    try {
      const res = await fetch('/api/spotify/transfer', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId, play: this._isPlaying }),
      });
      if (!res.ok && res.status !== 204) throw new Error('HTTP ' + res.status);
    } catch (e) {
      console.warn('Spotify transfer failed:', e.message);
    }
    // Spotify needs a beat to flip is_active on the new device.
    setTimeout(() => { this._refreshDevices(); this._poll(); }, 600);
  },

};

// Self-bootstrap. spotify.js has no dependency on State — it only talks
// to /api/spotify/* — so it can init as soon as the DOM is parsed.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Spotify.init());
} else {
  Spotify.init();
}
