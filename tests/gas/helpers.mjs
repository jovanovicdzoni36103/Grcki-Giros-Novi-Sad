import { createEmulator } from '../../tools/gas-emulator/index.mjs';
import { syncGas } from '../../tools/gas-sync.mjs';
import { randomUUID } from 'node:crypto';

syncGas({ quiet: true });

/** Fresh emulator with the spreadsheet set up and a pinned clock (Wednesday 23.09.2026 14:23 Belgrade). */
export function freshBackend({ now = '2026-09-23T14:23:00+02:00', settings = {} } = {}) {
  const emu = createEmulator({ now });
  emu.run('setup');
  const overrides = { test_mode: 'FALSE', order_email_recipients: 'kuhinja@grckigiros.test, vlasnik@grckigiros.test, smena@grckigiros.test', ...settings };
  setSettings(emu, overrides);
  return emu;
}

export function setSettings(emu, map) {
  const sh = emu.sheet('SETTINGS');
  const data = sh.data;
  const keyCol = data[0].indexOf('key');
  const valCol = data[0].indexOf('value');
  for (const [k, v] of Object.entries(map)) {
    const row = data.findIndex((r, i) => i > 0 && r && r[keyCol] === k);
    if (row === -1) {
      const r = [];
      r[keyCol] = k;
      r[valCol] = String(v);
      data.push(r);
    } else data[row][valCol] = String(v);
  }
  emu.state.cache.clear();
}

export function setCell(emu, sheetName, keyHeader, keyValue, header, value) {
  const sh = emu.sheet(sheetName);
  const k = sh.data[0].indexOf(keyHeader);
  const c = sh.data[0].indexOf(header);
  const row = sh.data.findIndex((r, i) => i > 0 && r && r[k] === keyValue);
  if (row === -1) throw new Error(`${sheetName}: no row ${keyHeader}=${keyValue}`);
  sh.data[row][c] = value;
  emu.state.cache.clear();
}

export function bootstrap(emu) {
  const res = emu.doGet({ action: 'bootstrap' });
  if (!res.ok) throw new Error('bootstrap failed: ' + JSON.stringify(res));
  return res.data;
}

export function orderBody(overrides = {}) {
  const base = {
    requestId: randomUUID(),
    mode: 'delivery',
    when: 'asap',
    businessDate: '2026-09-23',
    customer: { name: 'Nikola Jovanović', phone: '064 123 4567', email: '' },
    address: { street: 'Bulevar oslobođenja', number: '12a', apt: '4', floor: '2', zone: 'ns-grad', note: 'Interfon 4' },
    cash: 2000,
    note: '',
    items: [
      { productId: 'klasik', qty: 1, options: ['meso-pilece', 'pita-atina', 'sos-tzatziki', 'sal-paradajz', 'zac-origano', 'pup-da'], note: '' },
      { productId: 'coca-cola', qty: 1, options: [] }
    ],
    clientTotal: 620 + 200 + 250,
    meta: { elapsedMs: 45000, channel: 'instagram', hp: '' }
  };
  const merged = { ...base, ...overrides };
  if (overrides.customer) merged.customer = { ...base.customer, ...overrides.customer };
  if (overrides.address) merged.address = { ...base.address, ...overrides.address };
  if (overrides.meta) merged.meta = { ...base.meta, ...overrides.meta };
  return merged;
}

export function placeOrder(emu, overrides = {}) {
  return emu.doPost({ action: 'order.create', payload: orderBody(overrides) });
}

/** Admin session for tests: sets the PIN and returns a call(action, payload) helper. */
export function adminSession(emu, pin = '482913') {
  emu.run('setPanelPin_', pin);
  const login = emu.doPost({ action: 'admin.login', payload: { pin } });
  if (!login.ok) throw new Error('admin login failed: ' + JSON.stringify(login));
  const token = login.data.token;
  const call = (action, payload = {}) => emu.doPost({ action, payload: { token, ...payload } });
  return { token, call };
}

/** Plain JSON copy (strips the VM realm so deepStrictEqual works). */
export const plain = (x) => JSON.parse(JSON.stringify(x));
