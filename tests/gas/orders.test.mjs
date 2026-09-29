import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { freshBackend, placeOrder, orderBody, setSettings, setCell, bootstrap, plain } from './helpers.mjs';

const KLASIK_DEFAULTS = ['meso-pilece', 'pita-atina', 'sos-tzatziki', 'sal-paradajz', 'sal-luk', 'zac-origano', 'pup-da'];
const PICKUP = { mode: 'pickup', address: {}, cash: undefined, clientTotal: 820 };

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

  test('succeeds as NEW with public number #1001 and a unique internal id', () => {
    assert.equal(res.ok, true, JSON.stringify(res.error));
    assert.equal(res.data.publicNumber, 1001);
    assert.equal(res.data.status, 'NEW');
    assert.match(res.data.orderId, /^GG-20260923-1001-0001$/);
    assert.equal(res.data.total, 1690);
    assert.equal(res.data.change, 310);
    assert.equal(res.data.whenLabel, 'ŠTO PRE');
    assert.equal(res.data.promisedTime, '15:10', '14:23 + 45 min, rounded to 5');
    assert.deepEqual([res.data.etaMin, res.data.etaMax], [45, 60]);
    assert.equal(res.data.acceptBy, '2026-09-23T14:28:00+02:00', '5 minutes to accept');
    assert.equal(res.data.address.aptFloor, 'stan 4, 2. sprat');
  });

  test('ORDERS row carries every field of the spec', () => {
    const [row] = emu.rows('ORDERS');
    for (const col of [
      'Timestamp', 'Internal Order ID', 'Public Order Number', 'Order Type', 'Status', 'Customer Name', 'Phone', 'Email', 'Address', 'Apartment', 'Floor',
      'Zone', 'Delivery Note', 'Order Note', 'Order Items', 'Subtotal', 'Delivery Cost', 'Total', 'Cash Provided', 'Change Required', 'Requested Time',
      'Scheduled Date', 'Scheduled Time', 'Accept By', 'Confirmed At', 'Preparing At', 'Ready At', 'Completed At', 'Rejected At', 'Source', 'Created At'
    ]) {
      assert.ok(col in row, `missing column ${col}`);
    }
    assert.equal(row['Order Type'], 'DELIVERY');
    assert.equal(row.Status, 'NEW');
    assert.equal(row.Phone, '+381641234567');
    assert.equal(row.Apartment, '4');
    assert.equal(row.Floor, '2');
    assert.equal(row.Zone, 'Novi Sad — grad');
    assert.equal(row.Subtotal, 1440);
    assert.equal(row['Delivery Cost'], 250);
    assert.equal(row['Cash Provided'], 2000);
    assert.equal(row['Change Required'], 310);
    assert.equal(row['Scheduled Date'], '');
    assert.match(row['Order Items'], /2× Klasik — .*BEZ: ljubičasti luk — napomena: dobro zapečeno/);
    assert.equal(row.Channel, 'instagram');
    assert.match(row['Email Status'], /^SENT 3 · kupac OK$/);
  });

  test('ORDER_ITEMS is structured: base price, options price, option ids, line total', () => {
    const items = emu.rows('ORDER_ITEMS');
    assert.equal(items.length, 2);
    assert.equal(items[0].Product, 'Klasik');
    assert.equal(items[0].Qty, 2);
    assert.equal(items[0]['Base Price'], 620);
    assert.equal(items[0]['Options Price'], 0);
    assert.equal(items[0]['Unit Price'], 620);
    assert.equal(items[0]['Line Total'], 1240);
    assert.match(items[0]['Option IDs'], /meso-pilece/);
    assert.equal(items[0].Category, 'Giros');
    const [customer] = emu.rows('CUSTOMERS');
    assert.equal(customer.Orders, 1);
    assert.equal(customer['Total Spent'], 1690);
  });

  test('the kitchen ticket goes to all three recipients, separately, with the 5-minute deadline', () => {
    const kitchen = emu.state.outbox.filter((m) => m.subject.startsWith('#1001 '));
    assert.deepEqual(kitchen.map((m) => m.to).sort(), ['kuhinja@grckigiros.test', 'smena@grckigiros.test', 'vlasnik@grckigiros.test']);
    const html = kitchen[0].htmlBody;
    assert.match(kitchen[0].subject, /^#1001 · DOSTAVA · ŠTO PRE · 1\.690 RSD · Nikola J\.$/);
    assert.match(html, /Prihvatite ili odbijte u roku od 5 min/);
    assert.match(html, /Kusur: <b[^>]*>310\sRSD/);
    assert.match(html, /stan 4, 2\. sprat/);
    assert.match(html, /BEZ: ljubičasti luk/);
    assert.match(html, /tel:\+381641234567/);
    assert.match(html, /Bez soli &lt;b&gt;molim&lt;\/b&gt;/, 'guest note is escaped');
    assert.match(html, /\/admin\//);
    assert.match(kitchen[0].body, /KUSUR: 310 RSD/);
  });

  test('guest email says received-not-confirmed and links to the live status page', () => {
    const conf = emu.state.outbox.find((m) => m.to === 'kupac@example.com');
    assert.equal(conf.subject, 'Primili smo porudžbinu #1001 — Grčki Giros');
    assert.match(conf.htmlBody, /\/porudzbina\/\?id=GG-20260923-1001-0001&amp;t=[0-9a-f]{20}/);
    assert.match(conf.htmlBody, /još nije potvrđena/);
  });

  test('log entry with duration and no errors', () => {
    const log = emu.rows('SYSTEM_LOG').find((r) => r.Function === 'order.create');
    assert.equal(log.Status, 'OK');
    assert.equal(log['Order ID'], 'GG-20260923-1001-0001');
    assert.ok(log['Duration ms'] >= 0);
    assert.equal(emu.rows('ERROR_LOG').length, 0);
  });
});

describe('pickup and scheduled orders', () => {
  test('pickup today at 15:30: no delivery fee, no cash question, pickup ticket', () => {
    const emu = freshBackend();
    const res = placeOrder(emu, { ...PICKUP, when: '2026-09-23 15:30' });
    assert.equal(res.ok, true, JSON.stringify(res.error));
    assert.equal(res.data.deliveryFee, 0);
    assert.equal(res.data.total, 820);
    assert.equal(res.data.cash, null);
    assert.equal(res.data.whenLabel, '15:30');
    assert.equal(res.data.whenText, 'ZAKAZANO sreda 23.09. u 15:30');
    const [row] = emu.rows('ORDERS');
    assert.equal(row['Order Type'], 'PICKUP');
    assert.equal(row['Requested Time'], '15:30');
    assert.equal(row['Scheduled Date'], '2026-09-23');
    assert.equal(row['Scheduled Time'], '15:30');
    assert.equal(row.Address, '');
    assert.match(emu.state.outbox[0].subject, /PREUZIMANJE · ZAKAZANO 23\.09\. 15:30/);
    assert.match(emu.state.outbox[0].htmlBody, /Plaća gotovinom na kasi/);
  });

  test('delivery scheduled for Saturday 19:00 (within 7 days)', () => {
    const emu = freshBackend();
    const res = placeOrder(emu, { when: '2026-09-26 19:00' });
    assert.equal(res.ok, true, JSON.stringify(res.error));
    assert.equal(res.data.scheduledDate, '2026-09-26');
    assert.match(emu.state.outbox[0].htmlBody, /ZAKAZANO subota 26\.09\. u 19:00/);
  });

  test('past, too-far, Sunday and off-grid slots are refused', () => {
    const emu = freshBackend();
    for (const when of ['2026-09-23 12:00', '2026-09-23 15:00', '2026-10-01 12:00', '2026-09-27 13:00', '2026-09-24 10:15', '19:00']) {
      const r = placeOrder(emu, { when });
      assert.equal(r.error.code, 'SLOT_UNAVAILABLE', when);
      assert.equal(r.error.field, 'when');
    }
    assert.equal(emu.rows('ORDERS').length, 0);
  });
});

describe('order numbers', () => {
  test('start at order_number_start and grow: #1001, #1002, …; internal ids stay unique', () => {
    const emu = freshBackend({ settings: { rate_limit_phone_count: '1000', rate_limit_global_per_min: '1000' } });
    emu.state.properties.ORDER_SEQ = '4242';
    const got = [];
    for (let i = 0; i < 3; i++) {
      const r = placeOrder(emu);
      assert.equal(r.ok, true, JSON.stringify(r.error));
      got.push([r.data.publicNumber, r.data.orderId]);
    }
    assert.deepEqual(got.map((g) => g[0]), [1001, 1002, 1003]);
    assert.deepEqual(got.map((g) => g[1]), ['GG-20260923-1001-1093', 'GG-20260923-1002-1094', 'GG-20260923-1003-1095']);
  });

  test('250 orders back to back: 250 distinct numbers and ids, no gaps, one row each', () => {
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
    assert.equal(new Set(numbers).size, 250);
    assert.equal(numbers[0], 1001);
    assert.equal(numbers[249], 1250);
    assert.equal(emu.rows('ORDERS').length, 250);
    assert.equal(new Set(emu.rows('ORDERS').map((r) => r['Internal Order ID'])).size, 250);
    assert.equal(emu.rows('ORDER_ITEMS').length, 500);
  });

  test('the counter only moves while the script lock is held, and every order takes and releases it', () => {
    const emu = freshBackend();
    assert.throws(() => emu.run('nextOrderNumber_', null, 1001), /without holding the script lock/);
    placeOrder(emu);
    placeOrder(emu, { customer: { phone: '0659876543' } });
    assert.deepEqual(plain(emu.state.lockLog.map((l) => l.event)), ['acquire', 'release', 'acquire', 'release']);
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

  test('counter reset before go-live: refused while orders exist, allowed once ORDERS is empty', () => {
    const emu = freshBackend();
    placeOrder(emu);
    assert.throws(() => emu.run('resetOrderCounter_'), /još ima 1 porudžbina/);
    const sh = emu.sheet('ORDERS');
    sh.data = [sh.data[0]];
    assert.equal(emu.run('resetOrderCounter_'), 1001);
    assert.equal(placeOrder(emu, { customer: { phone: '0659876543' } }).data.publicNumber, 1001);
  });

  test('owner can move the next number forward, never back onto a used one', () => {
    const emu = freshBackend();
    emu.run('setNextOrderNumber_', 2000);
    assert.equal(placeOrder(emu).data.publicNumber, 2000);
    assert.throws(() => emu.run('setNextOrderNumber_', 1500), /već iskorišćen/);
    assert.equal(placeOrder(emu, { customer: { phone: '0659876543' } }).data.publicNumber, 2001);
  });
});

describe('duplicate submission protection', () => {
  test('same requestId twice (double click, retry) returns the same order, stores it once, emails once', () => {
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

  test('two real orders with identical content but different requests are both kept', () => {
    const emu = freshBackend();
    const a = placeOrder(emu);
    const b = placeOrder(emu);
    assert.notEqual(a.data.orderId, b.data.orderId);
    assert.equal(emu.rows('ORDERS').length, 2);
  });
});

describe('validation (server never trusts the browser)', () => {
  const cases = [
    ['invalid phone', { customer: { phone: '123' } }, 'phone', /mobilnog telefona/],
    ['empty name', { customer: { name: ' ' } }, 'name', /ime i prezime/],
    ['missing address', { address: { street: '', number: '' } }, 'address.street', /ulicu/],
    ['no zone picked', { address: { zone: '' } }, 'address.zone', /naselje/],
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

  test('delivery minimum 500 RSD: refused with the missing amount; pickup has no minimum', () => {
    const emu = freshBackend();
    const small = { items: [{ productId: 'coca-cola', qty: 1, options: [] }], clientTotal: 450 };
    const r = placeOrder(emu, small);
    assert.equal(r.error.code, 'MIN_ORDER');
    assert.equal(r.error.message, 'Minimalna porudžbina za dostavu je 500 RSD. Dodajte još 300 RSD.');
    assert.equal(r.error.data.shortfall, 300);
    const pickup = placeOrder(emu, { ...PICKUP, items: small.items, clientTotal: 200 });
    assert.equal(pickup.ok, true, JSON.stringify(pickup.error));
  });

  test('zone rules: unknown or switched-off zone is refused; zone fee and zone minimum apply', () => {
    const emu = freshBackend();
    assert.equal(placeOrder(emu, { address: { zone: 'mars' } }).error.code, 'ZONE_UNAVAILABLE');
    const r = placeOrder(emu, { address: { zone: 'ns-okolina' }, clientTotal: 820 + 350 });
    assert.equal(r.ok, true, JSON.stringify(r.error));
    assert.equal(r.data.deliveryFee, 350);
    assert.equal(r.data.address.zone, 'Petrovaradin i Sremska Kamenica');
    setCell(emu, 'ZONES', 'id', 'ns-okolina', 'min_order', 1000);
    const high = placeOrder(emu, { address: { zone: 'ns-okolina' }, clientTotal: 820 + 350, customer: { phone: '0651231231' } });
    assert.equal(high.error.code, 'MIN_ORDER');
    assert.match(high.error.message, /1\.000 RSD\. Dodajte još 180 RSD/);
    setCell(emu, 'ZONES', 'id', 'ns-okolina', 'active', false);
    const off = placeOrder(emu, { address: { zone: 'ns-okolina' }, clientTotal: 820 + 350, customer: { phone: '0651231232' } });
    assert.equal(off.error.code, 'ZONE_UNAVAILABLE');
    assert.match(off.error.message, /Izaberite drugo naselje ili preuzimanje/);
  });

  test('unknown product and sold-out product', () => {
    const emu = freshBackend();
    const unknown = placeOrder(emu, { items: [{ productId: 'burger', qty: 1 }], clientTotal: 250 });
    assert.equal(unknown.error.code, 'ITEM_UNAVAILABLE');
    setCell(emu, 'PRODUCTS', 'id', 'coca-cola', 'available', false);
    const soldOut = placeOrder(emu);
    assert.equal(soldOut.error.code, 'ITEM_UNAVAILABLE');
    assert.match(soldOut.error.message, /Trenutno nema: Coca-Cola 0\.33 l\./);
  });

  test('stale cart: price or delivery fee changed after the page loaded', () => {
    const emu = freshBackend();
    setCell(emu, 'PRODUCTS', 'id', 'klasik', 'price', 650);
    const r = placeOrder(emu);
    assert.equal(r.error.code, 'PRICE_CHANGED');
    assert.equal(r.error.data.total, 1100);
    assert.match(r.error.message, /1\.100\sRSD/);
    setCell(emu, 'PRODUCTS', 'id', 'klasik', 'price', 620);
    setCell(emu, 'ZONES', 'id', 'ns-grad', 'fee', 300);
    const fee = placeOrder(emu);
    assert.equal(fee.error.code, 'PRICE_CHANGED');
    assert.equal(fee.error.data.deliveryFee, 300);
  });

  test('forged client total or foreign price is never accepted', () => {
    const emu = freshBackend();
    assert.equal(placeOrder(emu, { clientTotal: 10 }).error.code, 'PRICE_CHANGED');
    assert.equal(emu.rows('ORDERS').length, 0);
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

describe('historical accuracy', () => {
  test('changing a price later never changes an existing order', () => {
    const emu = freshBackend();
    const r = placeOrder(emu, { items: [{ productId: 'klasik', qty: 1, options: [...KLASIK_DEFAULTS, 'dod-meso'] }], clientTotal: 920 + 250 });
    assert.equal(r.ok, true, JSON.stringify(r.error));
    const before = emu.rows('ORDERS')[0];
    const itemsBefore = emu.rows('ORDER_ITEMS')[0];
    setCell(emu, 'PRODUCTS', 'id', 'klasik', 'price', 990);
    setCell(emu, 'OPTIONS', 'id', 'dod-meso', 'price', 500);
    setCell(emu, 'PRODUCTS', 'id', 'klasik', 'name', 'Klasik Novi');
    setCell(emu, 'ZONES', 'id', 'ns-grad', 'fee', 400);
    const after = emu.rows('ORDERS')[0];
    assert.equal(after.Total, 1170);
    assert.equal(after['Delivery Cost'], 250);
    assert.equal(after['Items JSON'], before['Items JSON']);
    const line = JSON.parse(after['Items JSON'])[0];
    assert.deepEqual([line.name, line.basePrice, line.optionsPrice, line.lineTotal], ['Klasik', 620, 300, 920]);
    assert.deepEqual(emu.rows('ORDER_ITEMS')[0], itemsBefore);
  });

  test('per-piece options: two Klasik, one with extra meat, one without onion → two structured lines', () => {
    const emu = freshBackend();
    const r = placeOrder(emu, {
      items: [
        { productId: 'klasik', qty: 1, options: [...KLASIK_DEFAULTS, 'dod-meso'] },
        { productId: 'klasik', qty: 1, options: KLASIK_DEFAULTS.filter((o) => o !== 'sal-luk') }
      ],
      clientTotal: 920 + 620 + 250
    });
    assert.equal(r.ok, true, JSON.stringify(r.error));
    const items = emu.rows('ORDER_ITEMS');
    assert.equal(items.length, 2);
    assert.match(items[0].Options, /Extra meso \+300/);
    assert.equal(items[0]['Options Price'], 300);
    assert.equal(items[1].Removed, 'BEZ: ljubičasti luk');
    assert.equal(items[1]['Options Price'], 0);
  });
});

describe('opening hours on the server', () => {
  test('Sunday: closed, says when ordering reopens', () => {
    const emu = freshBackend({ now: '2026-09-27T13:00:00+02:00' });
    const r = placeOrder(emu);
    assert.equal(r.error.code, 'CLOSED');
    assert.equal(r.error.message, 'Trenutno ne primamo porudžbine. Poručivanje ponovo sutra u 10:00.');
    assert.equal(placeOrder(emu, PICKUP).error.message, 'Trenutno ne primamo porudžbine. Poručivanje ponovo sutra u 09:00.');
  });

  test('before opening and after closing', () => {
    const before = freshBackend({ now: '2026-09-23T08:40:00+02:00' });
    assert.match(placeOrder(before, PICKUP).error.message, /Poručivanje ponovo danas u 09:00/);
    const after = freshBackend({ now: '2026-09-24T01:10:00+02:00' });
    assert.match(placeOrder(after, PICKUP).error.message, /Poručivanje ponovo ujutru u 09:00/);
  });

  test('delivery closed at 23:50 but pickup still open: says so', () => {
    const emu = freshBackend({ now: '2026-09-23T23:50:00+02:00' });
    assert.equal(placeOrder(emu).error.message, 'Dostava trenutno ne radi. Preuzimanje u lokalu je moguće do 00:45.');
  });

  test('after midnight the order belongs to the previous business day', () => {
    const emu = freshBackend({ now: '2026-09-24T00:30:00+02:00' });
    const r = placeOrder(emu, PICKUP);
    assert.equal(r.ok, true, JSON.stringify(r.error));
    assert.equal(r.data.businessDate, '2026-09-23');
    assert.match(r.data.orderId, /^GG-20260923-/);
  });

  test('break from the HOURS sheet closes ordering and reopens by itself', () => {
    const emu = freshBackend();
    setCell(emu, 'HOURS', 'dow', 3, 'break_start', '14:00');
    setCell(emu, 'HOURS', 'dow', 3, 'break_end', '15:00');
    const r = placeOrder(emu);
    assert.equal(r.error.code, 'CLOSED');
    assert.equal(r.error.message, 'Trenutno ne primamo porudžbine. Pauza je u toku, poručivanje ponovo danas u 15:00.');
    emu.setNow('2026-09-23T15:00:00+02:00');
    assert.equal(placeOrder(emu).ok, true);
  });

  test('global pause, delivery off, pickup off', () => {
    const emu = freshBackend();
    setSettings(emu, { ordering_enabled: 'FALSE', pause_message: 'Zatvoreno zbog kvara.' });
    assert.equal(placeOrder(emu).error.message, 'Zatvoreno zbog kvara. Pozovite nas: 064 227 4334.');
    setSettings(emu, { ordering_enabled: 'TRUE', delivery_enabled: 'FALSE' });
    assert.equal(placeOrder(emu).error.message, 'Dostava je trenutno isključena. Izaberite preuzimanje u lokalu.');
    assert.equal(placeOrder(emu, PICKUP).ok, true);
    setSettings(emu, { delivery_enabled: 'TRUE', pickup_enabled: 'FALSE' });
    assert.equal(placeOrder(emu, { ...PICKUP, customer: { phone: '0651231233' } }).error.message, 'Preuzimanje u lokalu je trenutno isključeno. Izaberite dostavu.');
    assert.equal(placeOrder(emu, { customer: { phone: '0651231234' } }).ok, true);
  });

  test('holiday from SPECIAL_HOURS', () => {
    const emu = freshBackend();
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
    assert.match(closed.error.message, /Poručivanje ponovo sutra u 10:00/);
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
    assert.equal(placeOrder(emu).data.publicNumber, 1001, 'no gap after a failed write');
  });

  test('email service down: order still accepted and saved, failure logged with retry', () => {
    const emu = freshBackend();
    emu.state.faults.mail = true;
    const r = placeOrder(emu);
    assert.equal(r.ok, true);
    assert.equal(emu.rows('ORDERS')[0]['Email Status'], 'FAILED');
    assert.equal(emu.rows('ERROR_LOG').filter((e) => e.Function === 'email.send').length, 3);
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
  test('needs the secret token; reports the 5-minute overdue state', () => {
    const emu = freshBackend();
    const { data } = placeOrder(emu);
    const ok = emu.doGet({ action: 'order.status', id: data.orderId, t: data.statusToken });
    assert.equal(ok.data.status, 'NEW');
    assert.equal(ok.data.overdue, false);
    assert.equal(ok.data.publicNumber, 1001);
    assert.ok(!('token' in ok.data), 'token is never echoed');
    assert.equal(emu.doGet({ action: 'order.status', id: data.orderId, t: 'wrong' }).ok, false);
    assert.equal(emu.doGet({ action: 'order.status', id: 'GG-20260923-1002-0002', t: data.statusToken }).ok, false);
    emu.setNow('2026-09-23T14:29:00+02:00');
    assert.equal(emu.doGet({ action: 'order.status', id: data.orderId, t: data.statusToken }).data.overdue, true);
  });
});

describe('bootstrap payload', () => {
  test('exposes public config only (no recipients, no test switches) and active zones with minimum', () => {
    const emu = freshBackend();
    const b = bootstrap(emu);
    assert.equal(b.business.business_name, 'Grčki Giros');
    assert.equal(b.business.phone_display, '064 227 4334');
    assert.equal(b.business.delivery_eta_max, '60');
    assert.equal(b.business.preorder_days, '7');
    assert.ok(!('order_email_recipients' in b.business));
    assert.ok(!('test_mode' in b.business));
    assert.ok(!('image_url_template' in b.business));
    assert.equal(b.catalog.products.length, 27);
    assert.equal(b.hours.find((h) => h.dow === 7).closed, true);
    assert.deepEqual(plain(b.zones.map((z) => [z.id, z.fee, z.minOrder])), [['ns-grad', 250, 500], ['ns-okolina', 350, 500]]);
    assert.equal(typeof b.serverNow, 'number');
    assert.match(b.version, /^[0-9a-f]{12}$/);
  });
});
