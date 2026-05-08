require('dotenv').config();

/* ── Casa Control · server.js ─────────────────────────
   Express server. Serves static dashboard and proxies
   all /api calls to Homebridge. Handles auth internally.
   FLAG all changes to this file before committing.
   ───────────────────────────────────────────────────── */

const express = require('express');
const path = require('path');
const http = require('http');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;
const HB_HOST = process.env.HB_HOST || 'localhost';
const HB_PORT = process.env.HB_PORT || 8581;
const HB_USER = process.env.HB_USER || 'nick';
const HB_PASS = process.env.HB_PASS || '';

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

// ── Proxy all /api/* to Homebridge ──────────────────
app.use('/api', (req, res) => {
  getToken((err) => {
    if (err) {
      console.error('Auth error:', err.message);
      return res.status(500).json({ error: 'Auth failed', detail: err.message });
    }
    const hasBody = req.body && Object.keys(req.body).length > 0;
    hbRequest(
      req.method,
      '/api' + req.path + (req.url.includes('?') ? '?' + req.url.split('?')[1] : ''),
      hasBody ? req.body : null,
      (err, data, status) => {
        if (err) {
          console.error('HB request error:', err.message);
          return res.status(500).json({ error: err.message });
        }
        res.status(status).json(data);
      }
    );
  });
});

// ── Start ────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Casa Control running on http://homebridge.local:${PORT}`);
  // Warm up auth on start
  getToken((err) => {
    if (err) console.error('Initial auth failed:', err.message);
    else console.log('Homebridge auth OK');
  });
});
