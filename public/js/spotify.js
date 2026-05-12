/* ── Casa Control · spotify.js ────────────────────────
   Spotify Connect remote control. Polls /api/spotify/now-playing
   and renders a compact card between greeting and room grid.
   Hidden when nothing is playing or when the user hasn't
   connected an account yet.

   v1 scope (Phase 1): compact card only — art, title, artist,
   play/pause toggle. Expanded view, progress, prev/next, volume,
   and device picker come in Phase 2.
   ───────────────────────────────────────────────────── */

const Spotify = {

  // Polling cadence: faster when something's playing (so the UI
  // catches track changes promptly), slower otherwise.
  POLL_ACTIVE_MS: 5000,
  POLL_IDLE_MS: 30000,

  _timer: null,
  _connected: false,
  _lastTrackId: null,
  _isPlaying: false,
  _pendingTransport: false,

  async init() {
    try {
      const status = await fetch('/api/spotify/status').then(r => r.json());
      this._connected = !!status.connected;
    } catch (e) {
      // Server unreachable or endpoint missing — leave widget hidden.
      return;
    }
    if (!this._connected) {
      this._hide();
      return;
    }
    this._poll();
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
        const data = await res.json();
        active = this._render(data);
      } else {
        this._hide();
      }
    } catch (e) {
      // Network blip — try again next tick, leave the card alone so a
      // momentary failure doesn't flicker the UI off.
    }
    this._scheduleNext(active);
  },

  // Returns true when something is actively playing (drives poll cadence).
  _render(data) {
    if (!data || !data.item) { this._hide(); return false; }
    const item = data.item;
    const title = item.name || '';
    const artist = (item.artists || []).map(a => a.name).join(', ');
    const album = item.album?.name || '';
    const art = (item.album?.images || []).slice().sort((a, b) => (a.width || 0) - (b.width || 0));
    // Smallest image >= 64px, else fall back to the last available.
    const artUrl = (art.find(i => (i.width || 0) >= 64) || art[art.length - 1])?.url || '';
    const isPlaying = !!data.is_playing;
    this._isPlaying = isPlaying;
    this._lastTrackId = item.id || null;

    const root = this._ensureCard();
    const artEl = root.querySelector('.np-art');
    if (artUrl) {
      artEl.style.backgroundImage = `url("${artUrl}")`;
      artEl.classList.add('has-art');
    } else {
      artEl.style.backgroundImage = '';
      artEl.classList.remove('has-art');
    }
    root.querySelector('.np-track').textContent = title;
    root.querySelector('.np-artist').textContent = album ? `${artist} · ${album}` : artist;

    const toggle = root.querySelector('.np-mini-toggle');
    toggle.classList.toggle('on', isPlaying);
    toggle.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');

    root.style.display = '';
    return isPlaying;
  },

  _hide() {
    const root = document.getElementById('nowPlaying');
    if (root) root.style.display = 'none';
  },

  // Build the card on first use. DOM-injected (rather than living in
  // index.html) so the markup ships with the module that owns it.
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
      <div class="np-art"></div>
      <div class="np-info">
        <div class="np-source">Spotify</div>
        <div class="np-track"></div>
        <div class="np-artist"></div>
      </div>
      <button class="np-mini-toggle" type="button" aria-label="Play"></button>
    `;
    // Insert above the status row so it sits between greeting and rooms.
    host.insertBefore(root, host.firstChild);

    root.querySelector('.np-mini-toggle').addEventListener('click', e => {
      e.stopPropagation();
      this._toggle();
    });
    return root;
  },

  async _toggle() {
    if (this._pendingTransport) return;
    this._pendingTransport = true;
    // Optimistic flip — match the rest of Casa Control's pattern.
    const next = !this._isPlaying;
    this._isPlaying = next;
    const toggle = document.querySelector('#nowPlaying .np-mini-toggle');
    if (toggle) toggle.classList.toggle('on', next);
    try {
      const res = await fetch(next ? '/api/spotify/play' : '/api/spotify/pause', { method: 'PUT' });
      if (!res.ok && res.status !== 204) {
        // Revert on real failure.
        this._isPlaying = !next;
        if (toggle) toggle.classList.toggle('on', !next);
        console.warn('Spotify transport failed:', res.status);
      }
    } catch (e) {
      this._isPlaying = !next;
      if (toggle) toggle.classList.toggle('on', !next);
      console.warn('Spotify transport error:', e.message);
    } finally {
      this._pendingTransport = false;
      // Re-poll soon to converge on the real state.
      clearTimeout(this._timer);
      this._timer = setTimeout(() => this._poll(), 800);
    }
  },

};
