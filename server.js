/* ── Casa Control · server.js ─────────────────────────
   Express server. Serves static dashboard and proxies
   all /api calls to Homebridge. Handles auth internally.
   FLAG all changes to this file before committing.
   ───────────────────────────────────────────────────── */

const express = require('express');
const path = require('path');
const http = require('http');

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
