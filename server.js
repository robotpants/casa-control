require('dotenv').config();

/* ── Casa Control · server.js ─────────────────────────
   Express server. Serves static dashboard and proxies
   all /api calls to Homebridge. Handles auth internally.
   FLAG all changes to this file before committing.
   ───────────────────────────────────────────────────── */

const express = require('express');
const path = require('path');
const http = require('http');
const https = require('https');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { execSync } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;
const HB_HOST = process.env.HB_HOST || 'localhost';
const HB_PORT = process.env.HB_PORT || 8581;
const HB_USER = process.env.HB_USER || 'nick';
const HB_PASS = process.env.HB_PASS || '';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || 'http://homebridge.local:3000/api/spotify/callback';

let token = null;
let tokenExpiry = 0;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Raw HTTP request to Homebridge ──────────────────
function hbRequest(method, urlPath, body, cb) {
  const data = body ? JSON.stringify(body) : null;
  const opts = {
    hostname: HB_HOST,
    port: HB_PORT,
    path: urlPath,
    method,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data ? Buffer.byteLength(data) : 0,
      ...(token ? { 'Authorization': 'Bearer ' + token } : {})
    }
  };
  const req = http.request(opts, res => {
    let raw = '';
    res.on('data', chunk => raw += chunk);
    res.on('end', () => {
      try { cb(null, JSON.parse(raw), res.statusCode); }
      catch (e) { cb(null, raw, res.statusCode); }
    });
  });
  req.on('error', cb);
  if (data) req.write(data);
  req.end();
}

// ── Auth: get or refresh token ───────────────────────
function getToken(cb) {
  if (token && Date.now() < tokenExpiry) return cb(null, token);
  hbRequest('POST', '/api/auth/login', { username: HB_USER, password: HB_PASS }, (err, data) => {
    if (err) return cb(err);
    if (!data.access_token) return cb(new Error('Auth failed: ' + JSON.stringify(data)));
    token = data.access_token;
    tokenExpiry = Date.now() + (8 * 60 * 60 * 1000); // 8 hours
    console.log('Homebridge token refreshed');
    cb(null, token);
  });
}

// ── Casa Control prefs (cross-device sync) ──────────
// One JSON file on the Pi holds everything user-settable: prefs,
// deviceNames, deviceTypes, rooms, favorites. Each browser fetches
// on init and PUTs the whole bundle on change. Endpoints declared
// BEFORE the generic /api proxy so they're served locally.
const PREFS_DIR = '/var/lib/homebridge/dashboard';
const PREFS_FILE = path.join(PREFS_DIR, 'prefs.json');

app.get('/api/prefs', (req, res) => {
  try {
    if (!fs.existsSync(PREFS_FILE)) return res.json({});
    const raw = fs.readFileSync(PREFS_FILE, 'utf8');
    res.type('application/json').send(raw);
  } catch (e) {
    console.error('prefs read failed:', e.message);
    res.status(500).json({ error: 'prefs read failed', detail: e.message });
  }
});

app.put('/api/prefs', (req, res) => {
  try {
    if (!fs.existsSync(PREFS_DIR)) fs.mkdirSync(PREFS_DIR, { recursive: true });
    const tmp = PREFS_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(req.body, null, 2));
    fs.renameSync(tmp, PREFS_FILE);
    res.json({ ok: true });
  } catch (e) {
    console.error('prefs write failed:', e.message);
    res.status(500).json({ error: 'prefs write failed', detail: e.message });
  }
});

// ── Pi health stats ─────────────────────────────────
// Reads from /proc and /sys directly — no extra deps. Endpoint is
// declared BEFORE the generic /api proxy so it's served locally.
app.get('/api/pi-stats', (req, res) => {
  const stats = { ok: true };

  // CPU temp (Raspberry Pi exposes deci-degrees Celsius)
  try {
    const raw = fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8').trim();
    stats.cpuTempC = parseInt(raw, 10) / 1000;
  } catch (_) { stats.cpuTempC = null; }

  // Memory (bytes)
  stats.memTotal = os.totalmem();
  stats.memFree = os.freemem();
  stats.memUsedPct = Math.round(((stats.memTotal - stats.memFree) / stats.memTotal) * 100);

  // 1-min load average; CPU count for normalization
  const [load1] = os.loadavg();
  const cores = os.cpus().length;
  stats.load1 = load1;
  stats.cpuPct = Math.min(100, Math.round((load1 / cores) * 100));
  stats.cpuCores = cores;

  // Uptime (seconds)
  stats.uptimeSec = Math.round(os.uptime());

  // Root filesystem usage (df -k /)
  try {
    const dfOut = execSync('df -k /', { encoding: 'utf8' });
    const parts = dfOut.trim().split('\n')[1].split(/\s+/);
    stats.diskTotal = parseInt(parts[1], 10) * 1024;
    stats.diskUsed = parseInt(parts[2], 10) * 1024;
    stats.diskUsedPct = parseInt(parts[4], 10);
  } catch (_) {
    stats.diskTotal = stats.diskUsed = stats.diskUsedPct = null;
  }

  // Hostname + Node version (informational)
  stats.hostname = os.hostname();
  stats.nodeVersion = process.version;

  res.json(stats);
});

// ── Spotify Connect remote control ──────────────────
// OAuth Authorization Code flow. Refresh token persists in a separate
// file (spotify.json) so the frontend's prefs PUTs can't wipe it. The
// access token is in-memory only and is refreshed lazily on 401.
const SPOTIFY_FILE = path.join(PREFS_DIR, 'spotify.json');
const SPOTIFY_SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
].join(' ');

let spotifyAccessToken = null;
let spotifyAccessExpiry = 0;
const spotifyAuthStates = new Map(); // state → expiresAt

function spotifyConfigured() {
  return !!(SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET);
}

function loadSpotifyStore() {
  try {
    if (!fs.existsSync(SPOTIFY_FILE)) return {};
    return JSON.parse(fs.readFileSync(SPOTIFY_FILE, 'utf8'));
  } catch (e) {
    console.warn('spotify store read failed:', e.message);
    return {};
  }
}

function saveSpotifyStore(obj) {
  if (!fs.existsSync(PREFS_DIR)) fs.mkdirSync(PREFS_DIR, { recursive: true });
  const tmp = SPOTIFY_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, SPOTIFY_FILE);
}

// Generic HTTPS JSON request. Returns { status, body } where body is
// parsed JSON when possible, otherwise the raw string.
function httpsRequest(opts, payload, cb) {
  const req = https.request(opts, res => {
    let raw = '';
    res.on('data', chunk => raw += chunk);
    res.on('end', () => {
      let body = raw;
      if (raw) {
        try { body = JSON.parse(raw); } catch (_) {}
      }
      cb(null, { status: res.statusCode, body });
    });
  });
  req.on('error', cb);
  if (payload) req.write(payload);
  req.end();
}

// Exchange refresh_token for a fresh access_token. Updates the
// in-memory cache and returns the access token via cb.
function refreshSpotifyAccess(cb) {
  const store = loadSpotifyStore();
  if (!store.refreshToken) return cb(new Error('Not connected'));
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: store.refreshToken,
  }).toString();
  const basic = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  httpsRequest({
    hostname: 'accounts.spotify.com',
    path: '/api/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
      'Authorization': 'Basic ' + basic,
    },
  }, body, (err, resp) => {
    if (err) return cb(err);
    if (resp.status !== 200 || !resp.body.access_token) {
      return cb(new Error('Spotify refresh failed: ' + JSON.stringify(resp.body)));
    }
    spotifyAccessToken = resp.body.access_token;
    // 30s safety margin so we don't race a 401 right at the edge.
    spotifyAccessExpiry = Date.now() + ((resp.body.expires_in || 3600) - 30) * 1000;
    // Spotify sometimes rotates the refresh token; persist when it does.
    if (resp.body.refresh_token && resp.body.refresh_token !== store.refreshToken) {
      store.refreshToken = resp.body.refresh_token;
      saveSpotifyStore(store);
    }
    cb(null, spotifyAccessToken);
  });
}

function getSpotifyAccess(cb) {
  if (spotifyAccessToken && Date.now() < spotifyAccessExpiry) {
    return cb(null, spotifyAccessToken);
  }
  refreshSpotifyAccess(cb);
}

// Call api.spotify.com with auto-refresh on 401. cb(err, { status, body }).
function spotifyApi(method, urlPath, payload, attempt, cb) {
  if (typeof attempt === 'function') { cb = attempt; attempt = 0; }
  getSpotifyAccess((err, accessToken) => {
    if (err) return cb(err);
    const data = payload ? (typeof payload === 'string' ? payload : JSON.stringify(payload)) : null;
    httpsRequest({
      hostname: 'api.spotify.com',
      path: urlPath,
      method,
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        ...(data ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        } : {}),
      },
    }, data, (err2, resp) => {
      if (err2) return cb(err2);
      if (resp.status === 401 && attempt === 0) {
        spotifyAccessToken = null;
        spotifyAccessExpiry = 0;
        return spotifyApi(method, urlPath, payload, 1, cb);
      }
      cb(null, resp);
    });
  });
}

// GET /api/spotify/status → { configured, connected, displayName }
app.get('/api/spotify/status', (req, res) => {
  const store = loadSpotifyStore();
  res.json({
    configured: spotifyConfigured(),
    connected: !!store.refreshToken,
    displayName: store.displayName || null,
  });
});

// GET /api/spotify/auth → redirect to Spotify consent screen
app.get('/api/spotify/auth', (req, res) => {
  if (!spotifyConfigured()) {
    return res.status(500).send('Spotify client ID/secret not set in .env');
  }
  const state = crypto.randomBytes(16).toString('hex');
  spotifyAuthStates.set(state, Date.now() + 10 * 60 * 1000);
  // Sweep expired states opportunistically.
  for (const [k, exp] of spotifyAuthStates) if (exp < Date.now()) spotifyAuthStates.delete(k);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: SPOTIFY_CLIENT_ID,
    scope: SPOTIFY_SCOPES,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    state,
  });
  res.redirect('https://accounts.spotify.com/authorize?' + params.toString());
});

// GET /api/spotify/callback → exchange code for tokens, save, redirect home
app.get('/api/spotify/callback', (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.status(400).send('Spotify auth error: ' + error);
  if (!code || !state) return res.status(400).send('Missing code or state');
  const exp = spotifyAuthStates.get(state);
  if (!exp || exp < Date.now()) return res.status(400).send('Invalid or expired state');
  spotifyAuthStates.delete(state);

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: SPOTIFY_REDIRECT_URI,
  }).toString();
  const basic = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  httpsRequest({
    hostname: 'accounts.spotify.com',
    path: '/api/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
      'Authorization': 'Basic ' + basic,
    },
  }, body, (err, resp) => {
    if (err) return res.status(500).send('Token exchange failed: ' + err.message);
    if (resp.status !== 200 || !resp.body.refresh_token) {
      return res.status(500).send('Token exchange rejected: ' + JSON.stringify(resp.body));
    }
    const store = loadSpotifyStore();
    store.refreshToken = resp.body.refresh_token;
    saveSpotifyStore(store);
    spotifyAccessToken = resp.body.access_token;
    spotifyAccessExpiry = Date.now() + ((resp.body.expires_in || 3600) - 30) * 1000;
    // Fetch display name once so the Settings UI can show "Connected as X".
    spotifyApi('GET', '/v1/me', null, (e, r) => {
      if (!e && r && r.status === 200 && r.body) {
        const s = loadSpotifyStore();
        s.displayName = r.body.display_name || r.body.id || null;
        saveSpotifyStore(s);
      }
      res.redirect('/');
    });
  });
});

// GET /api/spotify/now-playing → passthrough of currently-playing
app.get('/api/spotify/now-playing', (req, res) => {
  const store = loadSpotifyStore();
  if (!store.refreshToken) return res.status(204).end();
  spotifyApi('GET', '/v1/me/player/currently-playing', null, (err, resp) => {
    if (err) return res.status(500).json({ error: err.message });
    // 204 = nothing playing. Forward as-is.
    if (resp.status === 204) return res.status(204).end();
    res.status(resp.status).json(resp.body);
  });
});

function spotifyTransport(req, res, method, urlPath) {
  const store = loadSpotifyStore();
  if (!store.refreshToken) return res.status(401).json({ error: 'Not connected' });
  spotifyApi(method, urlPath, null, (err, resp) => {
    if (err) return res.status(500).json({ error: err.message });
    // Spotify returns 204 No Content for transport commands on success.
    if (resp.status >= 200 && resp.status < 300) return res.status(resp.status).end();
    res.status(resp.status).json(resp.body || { error: 'Spotify error' });
  });
}

app.put('/api/spotify/play',  (req, res) => spotifyTransport(req, res, 'PUT', '/v1/me/player/play'));
app.put('/api/spotify/pause', (req, res) => spotifyTransport(req, res, 'PUT', '/v1/me/player/pause'));

// ── Proxy all /api/* to Homebridge ──────────────────
// Wraps each request in a single-shot retry: if Homebridge returns 401
// (e.g. after an HB restart invalidated our cached token), we throw the
// token away, log in again, and replay the same request once. This is
// the "casa-control restart" that used to silently fix toggle-off
// failures — now it happens automatically.
function proxyToHomebridge(req, res, attempt = 0) {
  getToken((err) => {
    if (err) {
      console.error('Auth error:', err.message);
      return res.status(500).json({ error: 'Auth failed', detail: err.message });
    }
    const hasBody = req.body && Object.keys(req.body).length > 0;
    const isAccessoryWrite = req.method === 'PUT' && req.path.startsWith('/accessories/');
    if (isAccessoryWrite && attempt === 0) {
      console.log(`[PUT ${req.path}] body: ${JSON.stringify(req.body)}`);
    }
    hbRequest(
      req.method,
      '/api' + req.path + (req.url.includes('?') ? '?' + req.url.split('?')[1] : ''),
      hasBody ? req.body : null,
      (err, data, status) => {
        if (err) {
          console.error('HB request error:', err.message);
          return res.status(500).json({ error: err.message });
        }
        // Stale token recovery: HB invalidated us. Refresh and retry once.
        if (status === 401 && attempt === 0) {
          console.warn(`Homebridge 401 on ${req.method} ${req.path}; refreshing token and retrying`);
          token = null;
          tokenExpiry = 0;
          return proxyToHomebridge(req, res, 1);
        }
        if (isAccessoryWrite) {
          // Compare what we wrote against what Homebridge echoed back.
          // A mismatch means the plugin acked the request (200) but
          // didn't actually apply the value — surface it so the client
          // can revert its optimistic UI instead of lying to the user.
          let echoed = '?';
          let mismatch = false;
          try {
            const obj = typeof data === 'object' ? data : JSON.parse(data);
            const charType = req.body?.characteristicType;
            const c = (obj?.serviceCharacteristics || []).find(c => c.type === charType);
            if (c) {
              echoed = `${c.type}=${c.value}`;
              const want = req.body?.value;
              // Loose-equal so 1 vs true / 0 vs false don't false-positive.
              // eslint-disable-next-line eqeqeq
              if (c.value != want) mismatch = true;
            } else {
              echoed = '(char not in response)';
            }
            if (mismatch && typeof obj === 'object' && obj) {
              obj._mismatch = true;
              obj._wrote = req.body?.value;
              obj._echoed = c?.value;
              data = obj;
            }
          } catch (_) {}
          const tag = mismatch ? 'MISMATCH' : 'ok';
          console.log(`[PUT ${req.path}] → ${status} ${tag}  wrote ${req.body?.characteristicType}=${req.body?.value}  response shows ${echoed}${attempt ? `  (retry ${attempt})` : ''}`);
        }
        res.status(status).json(data);
      }
    );
  });
}

app.use('/api', (req, res) => proxyToHomebridge(req, res));

// ── Start ────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Casa Control running on http://homebridge.local:${PORT}`);
  // Warm up auth on start
  getToken((err) => {
    if (err) console.error('Initial auth failed:', err.message);
    else console.log('Homebridge auth OK');
  });
});
