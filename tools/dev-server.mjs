// Local server: serves dist/ and answers /api with the real Apps Script code running in the emulator.
//   node tools/dev-server.mjs [--port 5190] [--fresh]
// Dev-only query params on /api: __now=ISO pins the backend clock, __fail=sheets|email|lock|exception|slow|network.
// Inspect: /__outbox (emails), /__state (sheets as JSON), /__reset (fresh spreadsheet).
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEmulator } from './gas-emulator/index.mjs';
import { syncGas } from './gas-sync.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const port = Number(args[args.indexOf('--port') + 1]) || Number(process.env.PORT) || 5190;
const dist = path.join(root, args.includes('--dist') ? args[args.indexOf('--dist') + 1] : 'dist');
const stateFile = path.join(root, `.data/emulator-${port}.json`);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.map': 'application/json'
};

syncGas({ quiet: true });
let emu;

function devSettings(e) {
  const sh = e.sheet('SETTINGS');
  const set = (k, v) => {
    const row = sh.data.find((r, i) => i > 0 && r && r[0] === k);
    if (row) row[1] = v;
  };
  set('test_mode', 'FALSE');
  set('order_email_recipients', 'kuhinja@grckigiros.test, vlasnik@grckigiros.test');
  set('contact_email_recipients', 'info@grckigiros.test');
  set('jobs_email_recipients', 'posao@grckigiros.test, vlasnik@grckigiros.test');
  set('site_url', `http://localhost:${port}`);
  const rc = e.sheet('REPORT_CONFIG');
  const r = rc.data.find((row, i) => i > 0 && row && row[0] === 'report_recipients');
  if (r) r[1] = 'izvestaji@grckigiros.test';
  e.run('setPanelPin_', '123456');
}

function fresh() {
  emu = createEmulator({ now: null });
  emu.run('setup');
  devSettings(emu);
  emu.state.cache.clear();
  emu.save(stateFile);
}

function boot() {
  emu = createEmulator({ now: null });
  if (args.includes('--fresh') || !emu.load(stateFile)) fresh();
}
boot();

const FAULTS = {
  sheets: () => (emu.state.faults.sheetsWrite = 'ORDERS'),
  email: () => (emu.state.faults.mail = true),
  lock: () => (emu.state.faults.lock = true),
  exception: () => {
    emu.state.cache.clear();
    emu.state.faults.sheetsOpen = 'PRODUCTS';
  }
};

function clearFaults() {
  emu.state.faults = { sheetsWrite: false, sheetsRead: false, sheetsOpen: false, mail: false, lock: false };
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

async function api(req, res, url) {
  const params = Object.fromEntries(url.searchParams.entries());
  const fail = params.__fail;
  if (fail === 'network') {
    req.socket.destroy();
    return;
  }
  if (fail === 'slow') await new Promise((r) => setTimeout(r, Number(params.__slow) || 30000));
  emu.setNow(params.__now ? params.__now : null);
  if (FAULTS[fail]) FAULTS[fail]();
  delete params.__now;
  delete params.__fail;
  delete params.__slow;
  try {
    const out = req.method === 'POST' ? emu.doPost(await readBody(req)) : emu.doGet(params);
    if (req.method === 'POST') emu.save(stateFile);
    send(res, 200, JSON.stringify(out));
  } catch (err) {
    send(res, 500, JSON.stringify({ ok: false, error: { code: 'EMULATOR', message: err.message } }));
  } finally {
    clearFaults();
  }
}

function outbox(res, url) {
  const idx = url.pathname.split('/')[2];
  const mails = emu.state.outbox;
  if (idx !== undefined && idx !== '') {
    const m = mails[Number(idx)];
    if (!m) return send(res, 404, 'Not found', 'text/plain');
    return send(res, 200, `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${m.subject}</title><body style="margin:0">${m.htmlBody}</body>`, 'text/html; charset=utf-8');
  }
  const rows = mails
    .map((m, i) => `<tr><td>${i}</td><td>${m.at}</td><td>${m.to}</td><td><a href="/__outbox/${i}">${m.subject.replace(/</g, '&lt;')}</a></td></tr>`)
    .reverse()
    .join('');
  send(res, 200, `<!doctype html><meta charset="utf-8"><title>Outbox</title><style>body{font:14px system-ui;padding:20px}td{padding:4px 10px;border-bottom:1px solid #ddd}</style><h1>Outbox (${mails.length})</h1><table>${rows}</table>`, 'text/html; charset=utf-8');
}

function serveStatic(res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  let file = path.join(dist, p);
  if (!file.startsWith(dist)) return send(res, 403, 'Forbidden', 'text/plain');
  if (!existsSync(file) && existsSync(file + '/index.html')) file += '/index.html';
  if (!existsSync(file) || statSync(file).isDirectory()) {
    const nf = path.join(dist, '404.html');
    return send(res, 404, existsSync(nf) ? readFileSync(nf) : 'Not found', 'text/html; charset=utf-8');
  }
  const type = MIME[path.extname(file)] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
  res.end(readFileSync(file));
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    try {
      if (url.pathname === '/api') return await api(req, res, url);
      if (url.pathname.startsWith('/__outbox')) return outbox(res, url);
      if (url.pathname === '/__state') {
        const names = ['ORDERS', 'ORDER_ITEMS', 'CUSTOMERS', 'SYSTEM_LOG', 'ERROR_LOG', 'CONTACT', 'JOBS', 'DAILY_STATS'];
        return send(res, 200, JSON.stringify({ properties: emu.state.properties, outbox: emu.state.outbox.length, sheets: Object.fromEntries(names.map((n) => [n, emu.rows(n)])) }, null, 1));
      }
      if (url.pathname === '/__reset') {
        fresh();
        return send(res, 200, JSON.stringify({ ok: true }));
      }
      if (url.pathname === '/__set') {
        // Simulates the owner editing a cell in Google Sheets: /__set?sheet=PRODUCTS&key=id&match=klasik&col=price&value=650
        const q = url.searchParams;
        const sh = emu.sheet(q.get('sheet'));
        const h = sh.data[0];
        const row = sh.data.find((r, i) => i > 0 && r && String(r[h.indexOf(q.get('key'))]) === q.get('match'));
        if (!row) return send(res, 404, JSON.stringify({ ok: false }));
        const raw = q.get('value');
        row[h.indexOf(q.get('col'))] = raw === 'TRUE' ? true : raw === 'FALSE' ? false : /^\d+$/.test(raw) ? Number(raw) : raw;
        emu.state.cache.clear();
        emu.save(stateFile);
        return send(res, 200, JSON.stringify({ ok: true }));
      }
      if (url.pathname === '/__run' && url.searchParams.get('fn')) {
        emu.setNow(url.searchParams.get('__now') || null);
        const out = emu.run(url.searchParams.get('fn'), ...(url.searchParams.getAll('arg').map((a) => (a.startsWith('{') ? JSON.parse(a) : a))));
        emu.save(stateFile);
        return send(res, 200, JSON.stringify(JSON.parse(JSON.stringify(out ?? null))));
      }
      return serveStatic(res, url);
    } catch (err) {
      send(res, 500, JSON.stringify({ error: err.message }));
    }
  })
  .listen(port, () => console.log(`Grčki Giros dev server → http://localhost:${port}  (outbox: /__outbox, state: /__state, panel PIN 123456)`));
