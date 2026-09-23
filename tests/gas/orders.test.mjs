import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { freshBackend, placeOrder, orderBody, setSettings, setCell, bootstrap, plain } from './helpers.mjs';

const KLASIK_DEFAULTS = ['meso-pilece', 'pita-atina', 'sos-tzatziki', 'sal-paradajz', 'sal-luk', 'zac-origano', 'pup-da'];

describe('delivery order — full pipeline', () => {
  const emu = freshBackend();
  const res = placeOrder(emu, {
    customer: { email: 'kupac@example.com' },
    note: 'Bez soli <b>molim</b>',
    items: [
      { productId: 'klasik', qty: 2, options: KLASIK_DEFAULTS.filter((o) => o !== 'sal-luk'), note: 'dobro zapečeno' },
      { productId: 'coca-cola', qty: 1, options: [] }
    ],
    clientTotal: 1240 + 200 + 250,
    cash: 2000
  });

  test('succeeds with public number #1 and a unique internal id', () => {
    assert.equal(res.ok, true, JSON.stringify(res.error));
    assert.equal(res.data.publicNumber, 1);
    assert.match(res.data.orderId, /^GG-20260923-1-0001$/);
    assert.equal(res.data.total, 1690);
    assert.equal(res.data.change, 310);
    assert.equal(res.data.whenLabel, 'ŠTO PRE');
    assert.equal(res.data.promisedTime, '15:25');
  });

  test('ORDERS row carries everything the prompt lists', () => {
    const [row] = emu.rows('ORDERS');
    for (const col of ['Timestamp', 'Internal Order ID', 'Public Order Number', 'Order Type', 'Customer Name', 'Phone', 'Email', 'Address', 'Apartment/Floor', 'Order Note', 'Order Items', 'Subtotal', 'Delivery Cost', 'Total', 'Cash Provided', 'Change Required', 'Requested Time', 'Actual Time', 'Status', 'Source', 'Created At']) {
      assert.ok(col in row, `missing column ${col}`);
    }
    assert.equal(row['Order Type'], 'DELIVERY');
    assert.equal(row.Status, 'NEW');
    assert.equal(row.Phone, '+381641234567');
    assert.equal(row.Subtotal, 1440);
    assert.equal(row['Delivery Cost'], 250);
    assert.equal(row['Cash Provided'], 2000);
    assert.equal(row['Change Required'], 310);
    assert.match(row['Order Items'], /2× Klasik — .*BEZ: ljubičasti luk — napomena: dobro zapečeno/);
    assert.equal(row.Channel, 'instagram');
    assert.match(row['Email Status'], /^SENT 3 · kupac OK$/);
  });

  test('ORDER_ITEMS and CUSTOMERS are written', () => {
    const items = emu.rows('ORDER_ITEMS');
    assert.equal(items.length, 2);
    assert.equal(items[0]['Line Total'], 1240);
    assert.equal(items[0].Category, 'Giros');
    const [customer] = emu.rows('CUSTOMERS');
    assert.equal(customer.Orders, 1);
    assert.equal(customer['Total Spent'], 1690);
    assert.equal(customer['Favorite Product'], 'Klasik');
  });

  test('the same ticket goes to all three kitchen recipients, separately', () => {
    const kitchen = emu.state.outbox.filter((m) => m.subject.startsWith('#1 '));
    assert.deepEqual(kitchen.map((m) => m.to).sort(), ['kuhinja@grckigiros.test', 'smena@grckigiros.test', 'vlasnik@grckigiros.test']);
    const html = kitchen[0].htmlBody;
    assert.match(kitchen[0].subject, /^#1 · DOSTAVA · ŠTO PRE · 1\.690 RSD · Nikola J\.$/);
    assert.match(html, /#1</);
    assert.match(html, /Kusur: <b[^>]*>310 RSD/);
    assert.match(html, /BEZ: ljubičasti luk/);
    assert.match(html, /tel:\+381641234567/);
    assert.match(html, /Bez soli &lt;b&gt;molim&lt;\/b&gt;/, 'guest note is escaped');
    assert.match(kitchen[0].body, /KUSUR: 310 RSD/);
  });

  test('guest confirmation email links to the live status page', () => {
    const conf = emu.state.outbox.find((m) => m.to === 'kupac@example.com');
    assert.equal(conf.subject, 'Porudžbina #1 je primljena — Grčki Giros');
    assert.match(conf.htmlBody, /\/porudzbina\/\?id=GG-20260923-1-0001&amp;t=[0-9a-f]{20}/);
    assert.match(conf.htmlBody, /Sačuvajte broj porudžbine/);
  });

  test('log entry with duration and no errors', () => {
    const log = emu.rows('SYSTEM_LOG').find((r) => r.Function === 'order.create');
    assert.equal(log.Status, 'OK');
    assert.equal(log['Order ID'], 'GG-20260923-1-0001');
    assert.ok(log['Duration ms'] >= 0);
    assert.equal(emu.rows('ERROR_LOG').length, 0);
  });
});

describe('pickup order', () => {
  test('no delivery fee, no cash question, pickup ticket', () => {
    const emu = freshBackend();
    const res = placeOrder(emu, { mode: 'pickup', address: {}, cash: undefined, clientTotal: 820, when: '15:30' });
    assert.equal(res.ok, true, JSON.stringify(res.error));
    assert.equal(res.data.deliveryFee, 0);
    assert.equal(res.data.total, 820);
    assert.equal(res.data.cash, null);
    assert.equal(res.data.whenLabel, '15:30');
    const [row] = emu.rows('ORDERS');
    assert.equal(row['Order Type'], 'PICKUP');
    assert.equal(row['Requested Time'], '15:30');
    assert.equal(row.Address, '');
    const mail = emu.state.outbox[0];
    assert.match(mail.subject, /PREUZIMANJE · ZAKAZANO 15:30/);
    assert.match(mail.htmlBody, /Plaća gotovinom na kasi/);
  });
});

describe('order numbers', () => {
  test('#98 → #99 → #100 → #1 → #2, internal ids stay unique', () => {
    const emu = freshBackend({ settings: { rate_limit_phone_count: '1000', rate_limit_global_per_min: '1000' } });
    emu.state.properties.PUBLIC_NO = '97';
    emu.state.properties.ORDER_SEQ = '4242';
    const got = [];
    for (let i = 0; i < 5; i++) {
      const r = placeOrder(emu);
      assert.equal(r.ok, true, JSON.stringify(r.error));
      got.push([r.data.publicNumber, r.data.orderId]);
    }
    assert.deepEqual(got.map((g) => g[0]), [98, 99, 100, 1, 2]);
    assert.deepEqual(got.map((g) => g[1]), ['GG-20260923-98-1093', 'GG-20260923-99-1094', 'GG-20260923-100-1095', 'GG-20260923-1-1096', 'GG-20260923-2-1097']);
  });

  test('250 orders: numbers cycle 1..100 and no internal id ever repeats', () => {
    const emu = freshBackend({ settings: { rate_limit_phone_count: '1000', rate_limit_global_per_min: '1000' } });
    const ids = new Set();
    const numbers = [];
    for (let i = 0; i < 250; i++) {
      const r = placeOrder(emu, { customer: { phone: '06' + String(10000000 + i) } });
      assert.equal(r.ok, true, JSON.stringify(r.error));
      ids.add(r.data.orderId);
      numbers.push(r.data.publicNumber);
    }
    assert.equal(ids.size, 250);
    assert.equal(numbers[0], 1);
    assert.equal(numbers[99], 100);
    assert.equal(numbers[100], 1);
    assert.equal(numbers[249], 50);
    assert.equal(new Set(emu.rows('ORDERS').map((r) => r['Internal Order ID'])).size, 250);
  });

  test('the counter only moves while the script lock is held', () => {
    const emu = freshBackend();
    assert.throws(() => emu.run('nextOrderNumber_', null, 100), /without holding the script lock/);
    placeOrder(emu);
    assert.deepEqual(plain(emu.state.lockLog.map((l) => l.event)), ['acquire', 'release']);
  });

  test('lock timeout: friendly BUSY error, no number consumed, nothing written', () => {
    const emu = freshBackend();
    emu.state.faults.lock = true;
    const r = placeOrder(emu);
    assert.equal(r.ok, false);
    assert.equal(r.error.code, 'BUSY');
    assert.match(r.error.message, /nas pozovite na 064 227 4334/);
    assert.equal(emu.state.properties.PUBLIC_NO, '0');
    assert.equal(emu.rows('ORDERS').length, 0);
  });

  test('admin "next number" setting', () => {
    const emu = freshBackend();
    emu.run('setNextOrderNumber_', 37);
    assert.equal(placeOrder(emu).data.publicNumber, 37);
    emu.run('setNextOrderNumber_', 1);
    assert.equal(placeOrder(emu, { customer: { phone: '0659876543' } }).data.publicNumber, 1);
  });
});

describe('duplicate submission protection', () => {
  test('same requestId twice returns the same order, stores it once, emails once', () => {
    const emu = freshBackend();
    const body = orderBody();
    const a = emu.doPost({ action: 'order.create', payload: body });
    const b = emu.doPost({ action: 'order.create', payload: body });
    assert.equal(a.data.publicNumber, b.data.publicNumber);
    assert.equal(b.data.duplicate, true);
    assert.equal(emu.rows('ORDERS').length, 1);
    assert.equal(emu.state.outbox.length, 3);
  });

  test('still deduplicated when the cache was evicted (falls back to the sheet)', () => {
    const emu = freshBackend();
    const body = orderBody();
    const a = emu.doPost({ action: 'order.create', payload: body });
    emu.state.cache.clear();
    const b = emu.doPost({ action: 'order.create', payload: body });
    assert.equal(b.ok, true);
    assert.equal(b.data.orderId, a.data.orderId);
    assert.equal(emu.rows('ORDERS').length, 1);
  });
});

describe('validation (server never trusts the browser)', () => {
  const cases = [
    ['invalid phone', { customer: { phone: '123' } }, 'phone', /mobilnog telefona/],
    ['empty name', { customer: { name: ' ' } }, 'name', /ime i prezime/],
    ['missing address', { address: { street: '', number: '' } }, 'address.street', /ulicu/],
    ['cash below total', { cash: 1000 }, 'cash', /najmanje 1070/],
    ['cash missing', { cash: '' }, 'cash', /Sa koliko novca/i],
    ['absurd cash', { cash: 90000 }, 'cash', /prevelik/],
    ['empty cart', { items: [], clientTotal: 250 }, 'items', /Korpa je prazna/],
    ['required meat missing', { items: [{ productId: 'slozi-svoj', qty: 1, options: ['pita-atina'] }], clientTotal: 870 }, 'items', /meso/],
    ['foreign option', { items: [{ productId: 'coca-cola', qty: 1, options: ['dod-meso'] }], clientTotal: 450 }, 'items', /ne postoji/],
    ['no mode', { mode: 'teleport' }, 'mode', /dostavu ili preuzimanje/]
  ];
  for (const [name, overrides, field, message] of cases) {
    test(name, () => {
      const emu = freshBackend();
      const r = placeOrder(emu, overrides);
      assert.equal(r.ok, false, name);
      assert.equal(r.error.code, 'VALIDATION');
      assert.equal(r.error.field, field);
      assert.match(r.error.message, message);
      assert.equal(emu.rows('ORDERS').length, 0);
      assert.equal(emu.rows('ERROR_LOG').length, 0, 'expected rejections are not errors');
      assert.ok(emu.rows('SYSTEM_LOG').some((l) => l.Status === 'REJECTED'));
    });
  }

  test('unknown product and sold-out product', () => {
    const emu = freshBackend();
    const unknown = placeOrder(emu, { items: [{ productId: 'burger', qty: 1 }], clientTotal: 250 });
    assert.equal(unknown.error.code, 'ITEM_UNAVAILABLE');
    setCell(emu, 'PRODUCTS', 'id', 'coca-cola', 'available', false);
    const soldOut = placeOrder(emu);
    assert.equal(soldOut.error.code, 'ITEM_UNAVAILABLE');
    assert.match(soldOut.error.message, /Trenutno nema: Coca-Cola 0\.33 l\./);
  });

  test('price changed in the sheet after the page loaded', () => {
    const emu = freshBackend();
    setCell(emu, 'PRODUCTS', 'id', 'klasik', 'price', 650);
    const r = placeOrder(emu);
    assert.equal(r.error.code, 'PRICE_CHANGED');
    assert.equal(r.error.data.total, 1100);
    assert.match(r.error.message, /1\.100 RSD/);
  });

  test('bot signals: honeypot and instant submit', () => {
    const emu = freshBackend();
    assert.equal(placeOrder(emu, { meta: { hp: 'http://spam' } }).error.code, 'BAD_REQUEST');
    assert.equal(placeOrder(emu, { meta: { elapsedMs: 900 } }).error.code, 'BAD_REQUEST');
  });

  test('malformed requests', () => {
    const emu = freshBackend();
    assert.equal(emu.doPost('{not json').error.code, 'BAD_REQUEST');
    assert.equal(emu.doPost({ action: 'order.delete', payload: {} }).error.code, 'BAD_REQUEST');
    assert.equal(emu.doPost({ action: 'order.create', payload: { ...orderBody(), requestId: 'x' } }).error.code, 'BAD_REQUEST');
    assert.equal(emu.doGet({ action: 'nope' }).error.code, 'BAD_REQUEST');
    assert.equal(emu.doPost({ action: 'order.create', payload: { ...orderBody(), note: 'x'.repeat(70 * 1024) } }).error.code, 'BAD_REQUEST');
  });

  test('rate limit per phone, released after the window', () => {
    const emu = freshBackend();
    for (let i = 0; i < 3; i++) assert.equal(placeOrder(emu).ok, true);
    const fourth = placeOrder(emu);
    assert.equal(fourth.error.code, 'RATE_LIMITED');
    assert.match(fourth.error.message, /064 227 4334/);
    emu.setNow('2026-09-23T14:34:00+02:00');
    assert.equal(placeOrder(emu).ok, true);
  });

  test('spreadsheet formulas typed by a guest are stored as text', () => {
    const emu = freshBackend();
    assert.equal(emu.run('cellValue_', '=IMPORTXML("http://x")'), "'=IMPORTXML(\"http://x\")");
    assert.equal(emu.run('cellValue_', '+381641234567'), "'+381641234567");
  });
});

describe('opening hours on the server', () => {
  test('Sunday: closed, tells when it opens', () => {
    const emu = freshBackend({ now: '2026-09-27T13:00:00+02:00' });
    const r = placeOrder(emu, { businessDate: '2026-09-27' });
    assert.equal(r.error.code, 'CLOSED');
    assert.equal(r.error.message, 'Trenutno ne radimo. Otvaramo sutra u 10:00.');
    const pickup = placeOrder(emu, { mode: 'pickup', cash: undefined, clientTotal: 820 });
    assert.equal(pickup.error.message, 'Trenutno ne radimo. Otvaramo sutra u 09:00.');
  });

  test('before opening and after closing', () => {
    const before = freshBackend({ now: '2026-09-23T08:40:00+02:00' });
    assert.match(placeOrder(before, { mode: 'pickup', cash: undefined, clientTotal: 820 }).error.message, /Otvaramo danas u 09:00/);
    const after = freshBackend({ now: '2026-09-24T01:10:00+02:00' });
    assert.match(placeOrder(after, { mode: 'pickup', cash: undefined, clientTotal: 820 }).error.message, /Otvaramo ujutru u 09:00/);
  });

  test('delivery closed at 23:50 but pickup still open: says so', () => {
    const emu = freshBackend({ now: '2026-09-23T23:50:00+02:00' });
    const r = placeOrder(emu);
    assert.equal(r.error.code, 'CLOSED');
    assert.equal(r.error.message, 'Dostava trenutno ne radi. Preuzimanje u lokalu je moguće do 00:45.');
  });

  test('after midnight the order belongs to the previous business day', () => {
    const emu = freshBackend({ now: '2026-09-24T00:30:00+02:00' });
    const r = placeOrder(emu, { mode: 'pickup', cash: undefined, clientTotal: 820 });
    assert.equal(r.ok, true, JSON.stringify(r.error));
    assert.equal(r.data.businessDate, '2026-09-23');
    assert.match(r.data.orderId, /^GG-20260923-/);
  });

  test('slot outside availability is rejected with fresh slots', () => {
    const emu = freshBackend();
    const r = placeOrder(emu, { when: '19:00' });
    assert.equal(r.error.code, 'SLOT_UNAVAILABLE');
    assert.deepEqual(plain(r.error.data.slots), ['15:30', '16:00', '16:30']);
  });

  test('temporary closure, holiday and exceptional hours from the sheets', () => {
    const emu = freshBackend();
    setSettings(emu, { ordering_enabled: 'FALSE', pause_message: 'Zatvoreno zbog kvara.' });
    assert.equal(placeOrder(emu).error.message, 'Zatvoreno zbog kvara. Pozovite nas: 064 227 4334.');
    setSettings(emu, { ordering_enabled: 'TRUE' });
    const sp = emu.sheet('SPECIAL_HOURS');
    const h = sp.data[0];
    const row = [];
    row[h.indexOf('date')] = '23.09.2026';
    row[h.indexOf('label')] = 'Popis';
    row[h.indexOf('closed')] = true;
    row[h.indexOf('active')] = true;
    sp.data.push(row);
    emu.state.cache.clear();
    const closed = placeOrder(emu);
    assert.equal(closed.error.code, 'CLOSED');
    assert.match(closed.error.message, /Otvaramo sutra u 09:00|Otvaramo sutra u 10:00/);
  });

  test('delivery zones: required when enabled, zone fee used', () => {
    const emu = freshBackend({ settings: { zones_enabled: 'TRUE' } });
    assert.equal(placeOrder(emu).error.field, 'address.zone');
    const r = placeOrder(emu, { address: { zone: 'ns-okolina' }, clientTotal: 820 + 350 });
    assert.equal(r.ok, true, JSON.stringify(r.error));
    assert.equal(r.data.deliveryFee, 350);
    assert.equal(r.data.address.zone, 'Petrovaradin i Sremska Kamenica');
  });
});

describe('failures of Google services', () => {
  test('Sheets write fails: friendly message, error logged, number returned to the pool', () => {
    const emu = freshBackend();
    emu.state.faults.sheetsWrite = 'ORDERS';
    const r = placeOrder(emu);
    assert.equal(r.ok, false);
    assert.equal(r.error.code, 'SERVER_ERROR');
    assert.equal(r.error.message, 'Porudžbina trenutno nije mogla da bude poslata. Molimo pokušajte ponovo ili pozovite nas na 064 227 4334.');
    const [err] = emu.rows('ERROR_LOG');
    assert.equal(err.Function, 'order.create');
    assert.match(err.Error, /Service Spreadsheets failed/);
    assert.ok(err.Stack.length > 0);
    assert.equal(emu.state.properties.PUBLIC_NO, '0');
    emu.state.faults.sheetsWrite = false;
    assert.equal(placeOrder(emu).data.publicNumber, 1, 'no gap after a failed write');
  });

  test('email service down: order still accepted and saved, failure logged with retry', () => {
    const emu = freshBackend();
    emu.state.faults.mail = true;
    const r = placeOrder(emu);
    assert.equal(r.ok, true);
    assert.equal(emu.rows('ORDERS')[0]['Email Status'], 'FAILED');
    const errs = emu.rows('ERROR_LOG').filter((e) => e.Function === 'email.send');
    assert.equal(errs.length, 3);
    assert.ok(emu.rows('SYSTEM_LOG').some((l) => l.Function === 'email.send' && l.Retry === 1));
  });

  test('one broken recipient does not block the others', () => {
    const emu = freshBackend();
    emu.state.faults.mail = 'vlasnik@grckigiros.test';
    placeOrder(emu);
    assert.deepEqual(emu.state.outbox.map((m) => m.to).sort(), ['kuhinja@grckigiros.test', 'smena@grckigiros.test']);
    assert.equal(emu.rows('ORDERS')[0]['Email Status'], 'PARTIAL 2/3');
  });

  test('daily email quota almost used up: first recipient still gets the ticket', () => {
    const emu = freshBackend();
    emu.state.mailQuota = 1;
    placeOrder(emu);
    assert.deepEqual(emu.state.outbox.map((m) => m.to), ['kuhinja@grckigiros.test']);
    assert.equal(emu.rows('ORDERS')[0]['Email Status'], 'PARTIAL 1/3');
    assert.ok(emu.rows('SYSTEM_LOG').some((l) => l.Function === 'email.quota' && l.Severity === 'WARN'));
  });

  test('test mode: every email goes to the test recipient only, marked [TEST]', () => {
    const emu = freshBackend({ settings: { test_mode: 'TRUE', test_email_recipient: '' } });
    placeOrder(emu, { customer: { email: 'pravi.kupac@example.com' } });
    assert.ok(emu.state.outbox.length >= 1);
    assert.ok(emu.state.outbox.every((m) => m.to === 'vlasnik@example.com' && m.subject.startsWith('[TEST] ')));
    assert.match(emu.state.outbox[0].htmlBody, /TEST REŽIM — u produkciji bi ovo dobili: kuhinja@grckigiros\.test/);
  });

  test('unexpected exception on read: generic friendly error, logged', () => {
    const emu = freshBackend();
    emu.state.faults.sheetsOpen = 'PRODUCTS';
    emu.state.cache.clear();
    const r = emu.doGet({ action: 'bootstrap' });
    assert.equal(r.ok, false);
    assert.equal(r.error.code, 'SERVER_ERROR');
    assert.ok(emu.rows('ERROR_LOG').length >= 1);
  });
});

describe('guest status polling', () => {
  test('needs the secret token; follows panel changes', () => {
    const emu = freshBackend();
    const { data } = placeOrder(emu);
    const ok = emu.doGet({ action: 'order.status', id: data.orderId, t: data.statusToken });
    assert.equal(ok.data.status, 'NEW');
    assert.equal(emu.doGet({ action: 'order.status', id: data.orderId, t: 'wrong' }).ok, false);
    assert.equal(emu.doGet({ action: 'order.status', id: 'GG-20260923-2-0002', t: data.statusToken }).ok, false);
  });
});

describe('bootstrap payload', () => {
  test('exposes public config only (no recipients, no test switches)', () => {
    const emu = freshBackend();
    const b = bootstrap(emu);
    assert.equal(b.business.business_name, 'Grčki Giros');
    assert.equal(b.business.phone_display, '064 227 4334');
    assert.ok(!('order_email_recipients' in b.business));
    assert.ok(!('test_mode' in b.business));
    assert.equal(b.catalog.products.length, 27);
    assert.equal(b.hours.find((h) => h.dow === 7).closed, true);
    assert.deepEqual(plain(b.zones), []);
    assert.equal(typeof b.serverNow, 'number');
    assert.match(b.version, /^[0-9a-f]{12}$/);
  });
});
