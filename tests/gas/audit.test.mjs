/*
 * Production audit: adversarial requests against the real Apps Script code.
 * Every case here is something a guest, a bot or a curious person with DevTools can send.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { freshBackend, placeOrder, orderBody, adminSession, setSettings, setCell, bootstrap, plain } from './helpers.mjs';

const KLASIK = ['meso-pilece', 'pita-atina', 'sos-tzatziki', 'sal-paradajz', 'zac-origano', 'pup-da'];
const COLA = { productId: 'coca-cola', qty: 1, options: [] };
const FRIES = { productId: 'pomfrit-veliki', qty: 1, options: [] };
const PICKUP = { mode: 'pickup', address: {}, cash: undefined };

function noOrders(emu, msg) {
  assert.equal(emu.rows('ORDERS').length, 0, msg || 'nothing may be written');
  assert.equal(emu.rows('ORDER_ITEMS').length, 0, msg || 'nothing may be written');
}

function noServerErrors(emu) {
  assert.deepEqual(emu.rows('ERROR_LOG').map((r) => r.Error), [], 'no unhandled exception');
}

/** Sets one HOURS row (dow 1 = Monday … 7 = Sunday). */
function setDay(emu, dow, values) {
  const sh = emu.sheet('HOURS');
  const h = sh.data[0];
  const row = sh.data.findIndex((r, i) => i > 0 && r && Number(r[h.indexOf('dow')]) === dow);
  for (const [k, v] of Object.entries(values)) sh.data[row][h.indexOf(k)] = v;
  emu.state.cache.clear();
}

describe('price manipulation', () => {
  test('object-prototype names as product ids are unknown products, never free items', () => {
    for (const id of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf', 'isPrototypeOf']) {
      const emu = freshBackend();
      const r = placeOrder(emu, { ...PICKUP, items: [{ productId: id, qty: 1, options: [] }, COLA], clientTotal: 200 });
      assert.equal(r.ok, false, id);
      assert.equal(r.error.code, 'ITEM_UNAVAILABLE', id);
      noOrders(emu, id);
      noServerErrors(emu);
    }
  });

  test('object-prototype names as option ids are refused', () => {
    for (const id of ['constructor', '__proto__', 'toString']) {
      const emu = freshBackend();
      const r = placeOrder(emu, { ...PICKUP, items: [{ productId: 'klasik', qty: 1, options: [...KLASIK, id] }], clientTotal: 620 });
      assert.equal(r.ok, false, id);
      noOrders(emu, id);
      noServerErrors(emu);
    }
  });

  test('quantity: 0, negative, fractional, huge, text, missing — refused, nothing saved', () => {
    for (const qty of [0, -1, -20, 0.5, 1.5, 21, 1e9, Infinity, 'dva', null, undefined, [], {}]) {
      const emu = freshBackend();
      const r = placeOrder(emu, { ...PICKUP, items: [{ productId: 'coca-cola', qty, options: [] }], clientTotal: 200 });
      assert.equal(r.ok, false, String(qty));
      assert.equal(r.error.code, 'VALIDATION', String(qty));
      noOrders(emu, String(qty));
      noServerErrors(emu);
    }
  });

  test('prices, fee and totals sent by the browser are ignored; the sheet decides', () => {
    const emu = freshBackend();
    const r = placeOrder(emu, {
      items: [
        { productId: 'klasik', qty: 1, options: KLASIK, price: 1, unitPrice: 1, lineTotal: 1 },
        { productId: 'coca-cola', qty: 1, options: [], price: 1 }
      ],
      address: { zone: 'ns-grad', fee: 0 },
      subtotal: 2,
      deliveryFee: 0,
      total: 2,
      clientTotal: 620 + 200 + 250
    });
    assert.equal(r.ok, true, JSON.stringify(r.error));
    const row = emu.rows('ORDERS')[0];
    assert.equal(row.Subtotal, 820);
    assert.equal(row['Delivery Cost'], 250);
    assert.equal(row.Total, 1070);
    assert.deepEqual(emu.rows('ORDER_ITEMS').map((i) => [i['Product ID'], i['Unit Price'], i['Line Total']]), [['klasik', 620, 620], ['coca-cola', 200, 200]]);
  });

  test('a 500 RSD item can not be sent as 1 RSD: the total must match the server price', () => {
    const emu = freshBackend();
    for (const clientTotal of [1, 0, -1070, '1', null, undefined, 1069, 1071]) {
      const r = placeOrder(emu, { clientTotal });
      assert.equal(r.error.code, 'PRICE_CHANGED', String(clientTotal));
      assert.equal(r.error.data.total, 1070);
    }
    noOrders(emu);
  });

  test('the same add-on twice is charged once and listed once', () => {
    const emu = freshBackend();
    const r = placeOrder(emu, { ...PICKUP, items: [{ productId: 'klasik', qty: 1, options: [...KLASIK, 'dod-meso', 'dod-meso'] }], clientTotal: 920 });
    assert.equal(r.ok, true, JSON.stringify(r.error));
    assert.equal(emu.rows('ORDER_ITEMS')[0]['Option IDs'].split(', ').filter((x) => x === 'dod-meso').length, 1);
  });

  test('an option switched off after the page loaded blocks the order with a clear message', () => {
    const emu = freshBackend();
    setCell(emu, 'OPTIONS', 'id', 'dod-meso', 'available', false);
    const r = placeOrder(emu, { ...PICKUP, items: [{ productId: 'klasik', qty: 1, options: [...KLASIK, 'dod-meso'] }], clientTotal: 920 });
    assert.equal(r.error.code, 'ITEM_UNAVAILABLE');
    assert.match(r.error.message, /Trenutno nema: Extra meso \(Klasik\)\. Uklonite ga iz korpe/);
    noOrders(emu);
  });

  test('items that are not a list, lines that are not objects', () => {
    for (const items of ['klasik', { 0: COLA }, 42, [null], ['coca-cola'], [[COLA]]]) {
      const emu = freshBackend();
      const r = placeOrder(emu, { ...PICKUP, items, clientTotal: 200 });
      assert.equal(r.ok, false, JSON.stringify(items));
      noOrders(emu, JSON.stringify(items));
      noServerErrors(emu);
    }
  });
});

describe('malformed and hostile requests', () => {
  test('action names from the object prototype are unknown actions', () => {
    const emu = freshBackend();
    for (const action of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf', '__defineGetter__']) {
      const post = emu.doPost({ action, payload: {} });
      assert.equal(post.ok, false, 'POST ' + action);
      assert.equal(post.error.code, 'BAD_REQUEST', 'POST ' + action);
      const get = emu.doGet({ action });
      assert.equal(get.ok, false, 'GET ' + action);
      assert.equal(get.error.code, 'BAD_REQUEST', 'GET ' + action);
    }
    noServerErrors(emu);
  });

  test('bodies of the wrong shape are refused politely, without a server error', () => {
    const emu = freshBackend();
    for (const body of ['', 'null', '[]', '"order.create"', '42', '{"action":5}', '{"action":null}', '{"action":"order.create"}', '{"action":"order.create","payload":null}', '{"action":"order.create","payload":[]}', '{"action":"order.create","payload":"x"}']) {
      const r = emu.doPost(body);
      assert.equal(r.ok, false, body);
      assert.equal(r.error.code, 'BAD_REQUEST', body);
      assert.ok(r.error.message && !/Error|at \w|\.gs|undefined|null/.test(r.error.message), body + ': ' + r.error.message);
    }
    noServerErrors(emu);
    noOrders(emu);
  });

  test('fields of the wrong type never crash the pipeline', () => {
    const variants = [
      { customer: 'Ana' },
      { customer: null },
      { customer: { name: ['Ana'], phone: { n: 1 } } },
      { address: 'Bulevar 12' },
      { address: null },
      { address: { street: 12, number: {}, zone: ['ns-grad'] } },
      { mode: null },
      { mode: ['delivery'] },
      { when: null },
      { when: { date: 'x' } },
      { cash: { amount: 5000 } },
      { cash: -5 },
      { cash: 1070.5 },
      { items: [{ productId: { id: 'klasik' }, qty: 1, options: 'meso-pilece' }] },
      { items: [{ productId: 'klasik', qty: 1, options: [{}, null, 5] }] }
    ];
    for (const v of variants) {
      const emu = freshBackend();
      const body = orderBody();
      Object.assign(body, v);
      const r = emu.doPost({ action: 'order.create', payload: body });
      assert.equal(r.ok, false, JSON.stringify(v));
      assert.notEqual(r.error.code, 'SERVER_ERROR', JSON.stringify(v) + ' → ' + r.error.message);
      noServerErrors(emu);
      noOrders(emu, JSON.stringify(v));
    }
  });

  test('optional fields of the wrong type are dropped, never stored as "[object Object]"', () => {
    for (const v of [{ note: { x: 1 } }, { note: ['a', 'b'] }, { meta: 'bot' }, { meta: null }, { address: { note: { x: 1 }, apt: [4], floor: {} } }, { customer: { email: { a: 1 } } }]) {
      const emu = freshBackend();
      const body = orderBody();
      Object.assign(body, v);
      if (v.address) body.address = { ...orderBody().address, ...v.address };
      if (v.customer) body.customer = { ...orderBody().customer, ...v.customer };
      const r = emu.doPost({ action: 'order.create', payload: body });
      assert.equal(r.ok, true, JSON.stringify(v) + ' ' + JSON.stringify(r.error));
      assert.doesNotMatch(JSON.stringify(emu.rows('ORDERS')), /object Object/, JSON.stringify(v));
      noServerErrors(emu);
    }
  });

  test('a crash inside Google services never leaks a stack trace or secret', () => {
    const emu = freshBackend();
    adminSession(emu);
    emu.state.faults.sheetsRead = 'ORDERS';
    const r = placeOrder(emu);
    assert.equal(r.error.code, 'SERVER_ERROR');
    assert.doesNotMatch(JSON.stringify(r), /Service Spreadsheets|injected|\.gs|at \w+ \(|TOKEN_SECRET|PANEL_PIN/);
    assert.match(r.error.message, /pozovite nas na 064 227 4334/);
    emu.state.faults.sheetsRead = false;
    const status = emu.doGet({ action: 'order.status', id: 'GG-20260923-1001-ABCD', t: 'x' });
    assert.doesNotMatch(JSON.stringify(status), /Service|\.gs|stack/i);
  });

  test('the public bootstrap exposes no secrets, recipients or internal switches', () => {
    const emu = freshBackend();
    adminSession(emu);
    const text = JSON.stringify(bootstrap(emu));
    for (const secret of ['kuhinja@grckigiros.test', 'TOKEN_SECRET', 'PANEL_PIN', 'test_mode', 'EMAIL_1', 'rate_limit', 'image_url_template', 'jobs_email_recipients']) {
      assert.ok(!text.includes(secret), secret);
    }
  });

  test('HTML and formulas typed by a guest reach the kitchen email escaped and the sheet as text', () => {
    const emu = freshBackend();
    const r = placeOrder(emu, {
      note: '=HYPERLINK("http://evil","klik") <img src=x onerror=alert(1)> <script>alert(1)</script>',
      address: { note: '"><b>kurir</b>' }
    });
    assert.equal(r.ok, true, JSON.stringify(r.error));
    const mail = emu.state.outbox.find((m) => /NOVA PORUDŽBINA/.test(m.htmlBody || ''));
    assert.ok(mail);
    assert.doesNotMatch(mail.htmlBody, /<img src=x|<script>|<b>kurir<\/b>/);
    assert.match(mail.htmlBody, /&lt;img src=x/);
    assert.equal(emu.rows('ORDERS')[0]['Order Note'].slice(0, 10), '=HYPERLINK', 'kept as the guest typed it');
    assert.equal(emu.run('cellValue_', emu.rows('ORDERS')[0]['Order Note']).charAt(0), "'", 'written with a text marker, so Sheets never evaluates it');
  });
});

describe('delivery rules on the server', () => {
  test('minimum 500 RSD: 499 refused, exactly 500 accepted, 501 accepted — fee is not counted', () => {
    const emu = freshBackend();
    setCell(emu, 'PRODUCTS', 'id', 'pomfrit-mali', 'price', 499);
    const low = placeOrder(emu, { items: [{ productId: 'pomfrit-mali', qty: 1, options: [] }], clientTotal: 749, customer: { phone: '0641111111' } });
    assert.equal(low.error.code, 'MIN_ORDER');
    assert.equal(low.error.data.shortfall, 1);
    setCell(emu, 'PRODUCTS', 'id', 'pomfrit-mali', 'price', 500);
    const exact = placeOrder(emu, { items: [{ productId: 'pomfrit-mali', qty: 1, options: [] }], clientTotal: 750, customer: { phone: '0642222222' } });
    assert.equal(exact.ok, true, JSON.stringify(exact.error));
    assert.equal(exact.data.total, 750);
    setCell(emu, 'PRODUCTS', 'id', 'pomfrit-mali', 'price', 501);
    assert.equal(placeOrder(emu, { items: [{ productId: 'pomfrit-mali', qty: 1, options: [] }], clientTotal: 751, customer: { phone: '0643333333' } }).ok, true);
  });

  test('zones: valid, switched off, nonexistent, prototype names, other zone fee', () => {
    const emu = freshBackend();
    assert.equal(placeOrder(emu, { address: { zone: 'ns-okolina' }, clientTotal: 820 + 350, customer: { phone: '0641111111' } }).ok, true);
    for (const zone of ['atlantida', 'constructor', '__proto__', 'NS-GRAD', 'ns-grad; ns-okolina', ['ns-grad'], { id: 'ns-grad' }]) {
      const r = placeOrder(emu, { address: { zone }, customer: { phone: '0645555555' } });
      assert.ok(r.error && ['ZONE_UNAVAILABLE', 'VALIDATION'].includes(r.error.code), JSON.stringify(zone));
    }
    setCell(emu, 'ZONES', 'id', 'ns-grad', 'active', false);
    const off = placeOrder(emu, { customer: { phone: '0646666666' } });
    assert.equal(off.error.code, 'ZONE_UNAVAILABLE');
    assert.match(off.error.message, /nije dostupna/);
    assert.equal(emu.rows('ORDERS').length, 1);
  });

  test('delivery fee raised while the guest was in checkout: refused with the new total, then accepted', () => {
    const emu = freshBackend();
    setCell(emu, 'ZONES', 'id', 'ns-grad', 'fee', 300);
    const stale = placeOrder(emu);
    assert.equal(stale.error.code, 'PRICE_CHANGED');
    assert.deepEqual(plain(stale.error.data), { subtotal: 820, deliveryFee: 300, total: 1120 });
    assert.equal(placeOrder(emu, { clientTotal: 1120 }).ok, true);
  });
});

describe('scheduling on the server (Wed 23.09.2026 14:23)', () => {
  const at = (when, extra = {}) => ({ when, ...extra });

  test('ASAP, the current slot, +30 min, last slot of the day, tomorrow', () => {
    const emu = freshBackend();
    const ok = (body, phone) => {
      const r = placeOrder(emu, { ...body, customer: { phone } });
      assert.equal(r.ok, true, JSON.stringify(body) + ' ' + JSON.stringify(r.error));
      return r.data;
    };
    const no = (body, phone) => {
      const r = placeOrder(emu, { ...body, customer: { phone } });
      assert.equal(r.ok, false, JSON.stringify(body));
      assert.equal(r.error.code, 'SLOT_UNAVAILABLE', JSON.stringify(body));
    };
    ok(at('asap'), '0641000001');
    no(at('2026-09-23 14:30', PICKUP), '0641000002'); // the half hour we are in: not enough time to cook
    ok(at('2026-09-23 15:00', { ...PICKUP, clientTotal: 820 }), '0641000003'); // pickup lead is 30 min
    no(at('2026-09-23 15:00'), '0641000004'); // delivery needs 60 min
    ok(at('2026-09-23 15:30'), '0641000005');
    ok(at('2026-09-23 23:30'), '0641000006'); // delivery ends 00:00, last slot 23:30
    no(at('2026-09-24 00:00'), '0641000007');
    ok(at('2026-09-24 00:30', { ...PICKUP, clientTotal: 820 }), '0641000008'); // pickup until 01:00
    no(at('2026-09-24 01:00', { ...PICKUP, clientTotal: 820 }), '0641000009');
    ok(at('2026-09-24 12:00'), '0641000010');
  });

  test('7th day inside the window, 8th day refused, past refused, Sunday refused, junk refused', () => {
    const emu = freshBackend();
    let n = 0;
    const r = (when) => placeOrder(emu, { when, customer: { phone: '06420000' + String(++n).padStart(2, '0') } });
    assert.equal(r('2026-09-30 14:00').ok, true, 'Wednesday next week, before now+7×24h');
    assert.equal(r('2026-09-30 15:00').error.code, 'SLOT_UNAVAILABLE', 'past now+7×24h');
    assert.equal(r('2026-10-01 12:00').error.code, 'SLOT_UNAVAILABLE', '8th day');
    assert.equal(r('2026-09-22 18:00').error.code, 'SLOT_UNAVAILABLE', 'yesterday');
    assert.equal(r('2026-09-23 12:00').error.code, 'SLOT_UNAVAILABLE', 'earlier today');
    assert.equal(r('2026-09-27 18:00').error.code, 'SLOT_UNAVAILABLE', 'Sunday, closed');
    for (const junk of ['2026-09-31 12:00', '2026-02-30 12:00', '2026-09-24 12:15', '2026-09-24 25:00', '2026-09-24 12:00:00', 'sutra u 12', '', 'ASAP', '2026-9-24 12:00']) {
      assert.equal(r(junk).error.code, 'SLOT_UNAVAILABLE', junk);
    }
    assert.equal(emu.rows('ORDERS').length, 1);
    noServerErrors(emu);
  });

  test('slots inside a break are refused; the first slot after it waits for the kitchen', () => {
    const emu = freshBackend();
    setDay(emu, 4, { break_start: '15:00', break_end: '16:00' });
    let n = 0;
    const r = (when) => placeOrder(emu, { ...PICKUP, clientTotal: 820, when, customer: { phone: '06430000' + String(++n).padStart(2, '0') } });
    assert.equal(r('2026-09-24 14:30').ok, true);
    assert.equal(r('2026-09-24 15:00').error.code, 'SLOT_UNAVAILABLE');
    assert.equal(r('2026-09-24 15:30').error.code, 'SLOT_UNAVAILABLE');
    assert.equal(r('2026-09-24 16:00').error.code, 'SLOT_UNAVAILABLE', 'kitchen restarts at 16:00, pickup needs 15 min');
    assert.equal(r('2026-09-24 16:30').ok, true);
  });

  test('a scheduled slot is refused while its channel is paused; the other channel keeps working', () => {
    const emu = freshBackend({ settings: { pickup_enabled: 'FALSE' } });
    const p = placeOrder(emu, { ...PICKUP, clientTotal: 820, when: '2026-09-24 12:00' });
    assert.equal(p.error.code, 'CLOSED');
    assert.match(p.error.message, /Preuzimanje u lokalu je trenutno isključeno/);
    assert.equal(placeOrder(emu, { when: '2026-09-24 12:00' }).ok, true);
    setSettings(emu, { pickup_enabled: 'TRUE', delivery_enabled: 'FALSE' });
    const d = placeOrder(emu, { when: '2026-09-24 12:00', customer: { phone: '0649999999' } });
    assert.equal(d.error.code, 'CLOSED');
    assert.match(d.error.message, /Dostava je trenutno isključena/);
    assert.equal(placeOrder(emu, { ...PICKUP, clientTotal: 820, when: '2026-09-24 12:00', customer: { phone: '0648888888' } }).ok, true);
  });
});

describe('a real working day (10:00–23:00, break 15:00–16:00)', () => {
  const emu = freshBackend({ now: '2026-09-23T09:55:00+02:00' });
  setDay(emu, 3, { open: '10:00', close: '23:00', delivery_open: '10:00', delivery_close: '23:00', break_start: '15:00', break_end: '16:00' });
  const { call } = adminSession(emu);
  let phone = 0;
  const order = (time, body = {}) => {
    emu.setNow(`2026-09-23T${time}:00+02:00`);
    return placeOrder(emu, { ...body, customer: { phone: '06450000' + String(++phone).padStart(2, '0') } });
  };
  const pickup = (time, extra = {}) => order(time, { ...PICKUP, clientTotal: 820, ...extra });

  test('09:55 closed, with the opening time in the message', () => {
    const r = order('09:55');
    assert.equal(r.error.code, 'CLOSED');
    assert.match(r.error.message, /Trenutno ne primamo porudžbine\. Poručivanje ponovo danas u 10:00\./);
    assert.equal(pickup('09:59').error.code, 'CLOSED');
  });

  test('10:00 opens; 10:15 pickup, 10:17 and 10:18 delivery', () => {
    assert.equal(pickup('10:00').ok, true);
    assert.equal(pickup('10:15').data.publicNumber, 1002);
    assert.equal(order('10:17').data.publicNumber, 1003);
    assert.equal(order('10:18').data.publicNumber, 1004);
  });

  test('10:20 a product runs out; 10:22 nobody can order it, other products still sell', () => {
    emu.setNow('2026-09-23T10:20:00+02:00');
    assert.equal(call('admin.product.flag', { id: 'coca-cola', field: 'available', value: false }).ok, true);
    const r = order('10:22');
    assert.equal(r.error.code, 'ITEM_UNAVAILABLE');
    assert.match(r.error.message, /Trenutno nema: Coca-Cola/);
    assert.equal(bootstrap(emu).catalog.products.find((p) => p.id === 'coca-cola').available, false);
    assert.equal(order('10:22', { items: [{ productId: 'klasik', qty: 1, options: KLASIK }], clientTotal: 870 }).ok, true);
  });

  test('11:30 delivery paused: delivery refused, 11:40 pickup still works', () => {
    emu.setNow('2026-09-23T11:30:00+02:00');
    assert.equal(call('admin.settings.save', { changes: { delivery_enabled: false } }).ok, true);
    const d = order('11:31', { items: [{ productId: 'klasik', qty: 1, options: KLASIK }], clientTotal: 870 });
    assert.equal(d.error.code, 'CLOSED');
    assert.match(d.error.message, /Dostava je trenutno isključena/);
    assert.equal(pickup('11:40', { items: [{ productId: 'klasik', qty: 1, options: KLASIK }], clientTotal: 620 }).ok, true);
  });

  test('12:00 delivery back on', () => {
    emu.setNow('2026-09-23T12:00:00+02:00');
    call('admin.settings.save', { changes: { delivery_enabled: true } });
    assert.equal(order('12:00', { items: [{ productId: 'klasik', qty: 1, options: KLASIK }], clientTotal: 870 }).ok, true);
  });

  test('ordering stops 15 min before the break, reopens by itself at 16:00', () => {
    const klasik = { items: [{ productId: 'klasik', qty: 1, options: KLASIK }], clientTotal: 620 };
    assert.equal(pickup('14:44', klasik).ok, true);
    for (const t of ['14:45', '15:00', '15:30', '15:59']) {
      const r = pickup(t, klasik);
      assert.equal(r.error.code, 'CLOSED', t);
      assert.match(r.error.message, /Pauza je u toku, poručivanje ponovo danas u 16:00/, t);
    }
    assert.equal(pickup('16:00', klasik).ok, true);
  });

  test('22:44 last ASAP order, 22:45 and 22:50 refused with tomorrow\'s time, 23:00 closed', () => {
    const klasik = { items: [{ productId: 'klasik', qty: 1, options: KLASIK }], clientTotal: 620 };
    assert.equal(pickup('22:30', { ...klasik, when: 'asap' }).ok, true);
    assert.equal(pickup('22:44', klasik).ok, true);
    for (const t of ['22:45', '22:50', '23:00', '23:30']) {
      const r = pickup(t, klasik);
      assert.equal(r.error.code, 'CLOSED', t);
      assert.match(r.error.message, /Poručivanje ponovo sutra u 09:00/, t);
    }
  });

  test('the board and dashboard add up at the end of the day', () => {
    emu.setNow('2026-09-23T23:05:00+02:00');
    const board = adminSession(emu).call('admin.board').data;
    const numbers = board.orders.map((o) => o.publicNumber).sort((a, b) => a - b);
    assert.deepEqual(numbers, numbers.map((_, i) => 1001 + i), 'consecutive numbers');
    assert.equal(new Set(board.orders.map((o) => o.id)).size, board.orders.length);
    assert.equal(board.dashboard.orders, board.orders.length);
    assert.equal(board.dashboard.newCount, board.orders.length);
    assert.equal(board.dashboard.overdue, board.orders.length, 'nobody answered: all overdue, none shown as confirmed');
    assert.equal(emu.rows('ORDERS').length, board.orders.length);
    noServerErrors(emu);
  });
});

describe('admin API without a valid session', () => {
  const ADMIN_ACTIONS = [
    'admin.board', 'admin.order', 'admin.status', 'admin.history', 'admin.catalog', 'admin.product.save', 'admin.product.move',
    'admin.product.flag', 'admin.category.save', 'admin.category.move', 'admin.group.save', 'admin.option.save', 'admin.option.move',
    'admin.image.upload', 'admin.zones', 'admin.zone.save', 'admin.zone.move', 'admin.hours', 'admin.hours.save', 'admin.settings',
    'admin.settings.save', 'admin.feedback', 'admin.pin.change'
  ];

  test('every admin action refuses missing, forged, truncated and foreign tokens and changes nothing', () => {
    const emu = freshBackend();
    const { token } = adminSession(emu);
    placeOrder(emu);
    const orderId = emu.rows('ORDERS')[0]['Internal Order ID'];
    const [, exp, sig] = token.split('.');
    const forged = [undefined, '', 'admin', 'admin..', `admin.${exp}`, `admin.${exp}.`, `admin.${exp}.x`, `user.${exp}.${sig}`, `admin.${Number(exp) + 1}.${sig}`, `admin.${exp}.${sig}.x`, { t: token }, [token]];
    const before = JSON.stringify(emu.toJSON().sheets.filter((s) => !['SYSTEM_LOG', 'ERROR_LOG'].includes(s.name)));
    for (const action of ADMIN_ACTIONS) {
      for (const t of forged) {
        const r = emu.doPost({ action, payload: { token: t, orderId, status: 'CONFIRMED', id: 'klasik', field: 'available', value: false, product: { id: 'klasik', name: 'X', price: 1, categoryId: 'giros' }, changes: { ordering_enabled: false } } });
        assert.equal(r.ok, false, action + ' ' + JSON.stringify(t));
        assert.equal(r.error.code, 'UNAUTHORIZED', action + ' ' + JSON.stringify(t));
      }
      assert.equal(emu.doGet({ action, token }).error.code, 'BAD_REQUEST', 'GET never reaches admin: ' + action);
    }
    const after = JSON.stringify(emu.toJSON().sheets.filter((s) => !['SYSTEM_LOG', 'ERROR_LOG'].includes(s.name)));
    assert.equal(after, before, 'no sheet changed');
    noServerErrors(emu);
  });

  test('a panel left open for a whole 09:00–01:00 shift stays logged in (sliding session); an idle one expires', () => {
    const emu = freshBackend({ now: '2026-09-23T09:00:00+02:00' });
    let { token } = adminSession(emu);
    const idle = token;
    for (const t of ['12:00', '15:30', '18:00', '21:30', '23:59']) {
      emu.setNow(`2026-09-23T${t}:00+02:00`);
      const r = emu.doPost({ action: 'admin.board', payload: { token } });
      assert.equal(r.ok, true, t + ' ' + JSON.stringify(r.error));
      if (r.session) token = r.session.token;
    }
    emu.setNow('2026-09-24T00:59:00+02:00');
    assert.equal(emu.doPost({ action: 'admin.board', payload: { token } }).ok, true, 'still logged in at 00:59');
    assert.equal(emu.doPost({ action: 'admin.board', payload: { token: idle } }).error.code, 'UNAUTHORIZED', 'a token nobody used since 09:00 expired at 21:00');
  });

  test('changing the PIN logs out every other device', () => {
    const emu = freshBackend();
    const a = adminSession(emu, '482913');
    const other = a.token;
    const r = a.call('admin.pin.change', { currentPin: '482913', newPin: '555777' });
    assert.equal(r.ok, true);
    assert.ok(r.data.token, 'the device that changed the PIN gets a fresh session');
    const stale = emu.doPost({ action: 'admin.board', payload: { token: other } });
    assert.equal(stale.error.code, 'UNAUTHORIZED');
    assert.equal(emu.doPost({ action: 'admin.board', payload: { token: r.data.token } }).ok, true);
  });

  test('a wrong current PIN in "change PIN" counts as a failed login', () => {
    const emu = freshBackend();
    const { call } = adminSession(emu);
    for (let i = 0; i < 8; i++) call('admin.pin.change', { currentPin: '000000', newPin: '123456' });
    assert.equal(emu.doPost({ action: 'admin.login', payload: { pin: '482913' } }).error.code, 'RATE_LIMITED');
  });
});

describe('status rules are the same everywhere', () => {
  const ALL = ['NEW', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'REJECTED'];
  const ALLOWED = {
    NEW: ['CONFIRMED', 'REJECTED'],
    CONFIRMED: ['PREPARING', 'READY', 'COMPLETED', 'REJECTED'],
    PREPARING: ['READY', 'COMPLETED', 'CONFIRMED', 'REJECTED'],
    READY: ['COMPLETED', 'PREPARING', 'REJECTED'],
    COMPLETED: ['READY'],
    REJECTED: []
  };

  test('full matrix: allowed moves pass, everything else is refused and leaves the row untouched', () => {
    const emu = freshBackend();
    const { call } = adminSession(emu);
    placeOrder(emu);
    const id = emu.rows('ORDERS')[0]['Internal Order ID'];
    for (const from of ALL) {
      for (const to of ALL) {
        if (from === to) continue;
        setCell(emu, 'ORDERS', 'Internal Order ID', id, 'Status', from);
        const r = call('admin.status', { orderId: id, status: to });
        const expected = ALLOWED[from].includes(to);
        assert.equal(r.ok, expected, `${from} → ${to}: ${JSON.stringify(r.error)}`);
        assert.equal(emu.rows('ORDERS')[0].Status, expected ? to : from, `${from} → ${to}`);
        if (!expected) assert.match(r.error.message, /ne može da pređe/);
      }
      setCell(emu, 'ORDERS', 'Internal Order ID', id, 'Status', from);
      assert.deepEqual(plain(call('admin.order', { orderId: id }).data.next), ALLOWED[from], 'the panel offers exactly the backend rules for ' + from);
    }
  });

  test('unknown statuses and unknown or empty order ids', () => {
    const emu = freshBackend();
    const { call } = adminSession(emu);
    placeOrder(emu);
    const id = emu.rows('ORDERS')[0]['Internal Order ID'];
    for (const status of ['DELETED', 'new', '', null, 'constructor', ['CONFIRMED']]) {
      assert.equal(call('admin.status', { orderId: id, status }).error.code, 'BAD_REQUEST', String(status));
    }
    for (const orderId of ['', '*', 'GG-*', null, ['x'], 'GG-20260923-9999-ABCD']) {
      assert.equal(call('admin.status', { orderId, status: 'CONFIRMED' }).error.code, 'BAD_REQUEST', String(orderId));
    }
    assert.equal(emu.rows('ORDERS')[0].Status, 'NEW');
    noServerErrors(emu);
  });

  test('two devices: a button pressed on a stale screen can not overwrite the other device\'s decision', () => {
    const emu = freshBackend();
    const tablet = adminSession(emu);
    const phoneToken = emu.doPost({ action: 'admin.login', payload: { pin: '482913' } }).data.token;
    const phone = { call: (action, payload) => emu.doPost({ action, payload: { token: phoneToken, ...payload } }) };
    placeOrder(emu);
    const id = emu.rows('ORDERS')[0]['Internal Order ID'];
    assert.equal(phone.call('admin.status', { orderId: id, status: 'CONFIRMED', from: 'NEW' }).ok, true);
    const stale = tablet.call('admin.status', { orderId: id, status: 'REJECTED', from: 'NEW' });
    assert.equal(stale.error.code, 'CONFLICT');
    assert.match(stale.error.message, /u međuvremenu promenjena u „POTVRĐENA“/);
    assert.equal(emu.rows('ORDERS')[0].Status, 'CONFIRMED');
    const same = tablet.call('admin.status', { orderId: id, status: 'CONFIRMED', from: 'NEW' });
    assert.equal(same.ok, true, 'both devices pressing "Prihvati" is fine');
    assert.equal(emu.rows('ORDERS')[0].Status, 'CONFIRMED');
    assert.equal(emu.state.outbox.filter((m) => /potvrđena/i.test(m.subject || '')).length <= 1, true, 'no second guest email');
  });

  test('pickup "spremna" email goes out once; undoing "Preuzeto" never calls the guest back', () => {
    const emu = freshBackend();
    const { call } = adminSession(emu);
    const o = placeOrder(emu, { ...PICKUP, clientTotal: 820, customer: { email: 'pera@example.com' } }).data;
    const ready = () => emu.state.outbox.filter((m) => m.to === 'pera@example.com' && /je spremna/.test(m.subject)).length;
    for (const s of ['CONFIRMED', 'PREPARING', 'READY']) call('admin.status', { orderId: o.orderId, status: s });
    assert.equal(ready(), 1);
    call('admin.status', { orderId: o.orderId, status: 'COMPLETED' });
    call('admin.status', { orderId: o.orderId, status: 'READY' });
    call('admin.status', { orderId: o.orderId, status: 'PREPARING' });
    call('admin.status', { orderId: o.orderId, status: 'READY' });
    assert.equal(ready(), 1, 'undo steps send nothing');
    assert.equal(emu.state.outbox.filter((m) => m.to === 'pera@example.com').length, 3, 'received, confirmed, ready — nothing else');
  });

  test('the guest status page follows every change at once', () => {
    const emu = freshBackend();
    const { call } = adminSession(emu);
    const o = placeOrder(emu).data;
    const poll = () => emu.doGet({ action: 'order.status', id: o.orderId, t: o.statusToken }).data;
    assert.equal(poll().status, 'NEW');
    for (const s of ['CONFIRMED', 'PREPARING', 'READY', 'COMPLETED']) {
      call('admin.status', { orderId: o.orderId, status: s });
      assert.equal(poll().status, s);
    }
    call('admin.status', { orderId: o.orderId, status: 'READY' });
    assert.equal(poll().status, 'READY', 'undo is visible too');
  });
});

describe('5-minute acceptance', () => {
  test('new → overdue at 5:00 → accepted late → never both; handled orders are never overdue', () => {
    const emu = freshBackend();
    const { call } = adminSession(emu);
    const a = placeOrder(emu).data;
    const b = placeOrder(emu, { customer: { phone: '0647777777' } }).data;
    const poll = (o) => emu.doGet({ action: 'order.status', id: o.orderId, t: o.statusToken }).data;
    emu.setNow('2026-09-23T14:27:59+02:00');
    assert.equal(poll(a).overdue, false);
    call('admin.status', { orderId: b.orderId, status: 'CONFIRMED' });
    emu.setNow('2026-09-23T14:28:01+02:00');
    assert.equal(poll(a).overdue, true);
    assert.equal(poll(a).status, 'NEW', 'still NEW, not shown as accepted');
    let board = call('admin.board').data;
    assert.deepEqual([board.dashboard.newCount, board.dashboard.overdue], [1, 1]);
    assert.equal(board.orders.find((o) => o.id === b.orderId).overdue, false, 'accepted in time');
    emu.setNow('2026-09-23T14:40:00+02:00');
    call('admin.status', { orderId: a.orderId, status: 'CONFIRMED' });
    assert.equal(poll(a).overdue, false);
    board = call('admin.board').data;
    assert.deepEqual([board.dashboard.newCount, board.dashboard.overdue], [0, 0]);
    const c = placeOrder(emu, { customer: { phone: '0646666666' } }).data;
    emu.setNow('2026-09-23T14:50:00+02:00');
    call('admin.status', { orderId: c.orderId, status: 'REJECTED' });
    assert.equal(poll(c).overdue, false);
    assert.equal(poll(c).status, 'REJECTED');
  });
});

describe('historical integrity', () => {
  test('product 620→650, add-on 300→350, zone fee 250→300: the old order keeps every old value everywhere', () => {
    const emu = freshBackend();
    const { call } = adminSession(emu);
    const o = placeOrder(emu, { items: [{ productId: 'klasik', qty: 2, options: [...KLASIK, 'dod-meso'] }], clientTotal: 2 * 920 + 250, cash: 5000, customer: { email: 'ana@example.com' } }).data;
    assert.equal(o.total, 2090);
    call('admin.product.save', { product: { ...call('admin.catalog').data.products.find((p) => p.id === 'klasik'), price: 650 } });
    call('admin.option.save', { option: { id: 'dod-meso', name: 'Dodatno meso', price: 350 } });
    call('admin.zone.save', { zone: { id: 'ns-grad', name: 'Novi Sad — grad', fee: 300, minOrder: 500 } });
    assert.equal(bootstrap(emu).catalog.products.find((p) => p.id === 'klasik').price, 650, 'new price is live');
    call('admin.status', { orderId: o.orderId, status: 'CONFIRMED' });
    const row = emu.rows('ORDERS')[0];
    assert.deepEqual([row.Subtotal, row['Delivery Cost'], row.Total], [1840, 250, 2090]);
    const item = emu.rows('ORDER_ITEMS')[0];
    assert.deepEqual([item['Base Price'], item['Options Price'], item['Unit Price'], item['Line Total']], [620, 300, 920, 1840]);
    const dto = call('admin.order', { orderId: o.orderId }).data;
    assert.deepEqual([dto.subtotal, dto.deliveryFee, dto.total, dto.items[0].unitPrice, dto.items[0].lineTotal], [1840, 250, 2090, 920, 1840]);
    assert.equal(emu.doGet({ action: 'order.status', id: o.orderId, t: o.statusToken }).data.total, 2090);
    const mail = emu.state.outbox.filter((m) => m.to === 'ana@example.com').pop();
    assert.match(mail.htmlBody, /2\.090/);
    assert.doesNotMatch(mail.htmlBody, /2\.190|2\.240/);
  });
});

describe('duplicates and concurrency', () => {
  test('five identical submits (double tap, retries, refresh) = one order, one set of emails', () => {
    const emu = freshBackend();
    const body = orderBody({ customer: { email: 'ana@example.com' } });
    const results = [];
    for (let i = 0; i < 5; i++) results.push(emu.doPost({ action: 'order.create', payload: body }));
    assert.ok(results.every((r) => r.ok && r.data.publicNumber === 1001));
    assert.equal(emu.rows('ORDERS').length, 1);
    assert.equal(emu.rows('ORDER_ITEMS').length, 2);
    assert.equal(emu.state.outbox.filter((m) => m.to === 'ana@example.com').length, 1);
  });

  test('a retry after the rate limit window still returns the original order, not a limit error', () => {
    const emu = freshBackend();
    const body = orderBody();
    emu.doPost({ action: 'order.create', payload: body });
    placeOrder(emu);
    placeOrder(emu);
    emu.state.cache.forEach((v, k) => k.startsWith('idem:') && emu.state.cache.delete(k));
    const retry = emu.doPost({ action: 'order.create', payload: body });
    assert.equal(retry.ok, true, JSON.stringify(retry.error));
    assert.equal(retry.data.publicNumber, 1001);
    assert.equal(emu.rows('ORDERS').length, 3);
  });

  test('"did my earlier attempt arrive?" finds a saved order by its request id and never creates one', () => {
    const emu = freshBackend();
    const body = orderBody();
    const lookup = (requestId) => emu.doPost({ action: 'order.lookup', payload: { requestId } });
    assert.deepEqual(plain(lookup(body.requestId).data), { found: false });
    assert.equal(emu.rows('ORDERS').length, 0, 'lookup never creates');
    emu.doPost({ action: 'order.create', payload: body });
    assert.equal(lookup(body.requestId).data.order.publicNumber, 1001);
    emu.state.cache.clear();
    assert.equal(lookup(body.requestId).data.order.publicNumber, 1001, 'found in the sheet after the cache is gone');
    for (const bad of ['', 'x', null, { a: 1 }, '../../etc', 'a'.repeat(80)]) assert.equal(lookup(bad).error.code, 'BAD_REQUEST', String(bad));
    assert.equal(emu.rows('ORDERS').length, 1);
  });

  test('customers A, B, C at the same moment: unique numbers, complete rows, items linked', () => {
    const emu = freshBackend();
    const bodies = ['0641000001', '0641000002', '0641000003'].map((phone, i) => orderBody({ customer: { phone, name: 'Kupac ' + 'ABC'[i] } }));
    const res = bodies.map((b) => emu.doPost({ action: 'order.create', payload: b }));
    assert.deepEqual(res.map((r) => r.data.publicNumber), [1001, 1002, 1003]);
    const orders = emu.rows('ORDERS');
    const items = emu.rows('ORDER_ITEMS');
    for (const o of orders) {
      for (const col of ['Internal Order ID', 'Public Order Number', 'Customer Name', 'Phone', 'Total', 'Status', 'Items JSON', 'Status Token', 'Request ID', 'Accept By']) {
        assert.ok(o[col] !== '' && o[col] !== undefined, col + ' is filled');
      }
      assert.equal(items.filter((i) => i['Order ID'] === o['Internal Order ID']).length, 2, 'items linked to ' + o['Public Order Number']);
    }
    assert.deepEqual(plain(emu.state.lockLog.map((l) => l.event)), ['acquire', 'release', 'acquire', 'release', 'acquire', 'release']);
  });
});

describe('feedback abuse', () => {
  test('wrong token, not completed, bad ratings, twice', () => {
    const emu = freshBackend();
    const { call } = adminSession(emu);
    const o = placeOrder(emu).data;
    const send = (extra) => emu.doPost({ action: 'feedback.submit', payload: { id: o.orderId, t: o.statusToken, rating: 5, good: [], improve: [], comment: '', ...extra } });
    assert.equal(send({ t: 'x' }).error.code, 'BAD_REQUEST');
    assert.match(send({}).error.message, /kada porudžbina bude završena/);
    call('admin.status', { orderId: o.orderId, status: 'CONFIRMED' });
    call('admin.status', { orderId: o.orderId, status: 'COMPLETED' });
    for (const rating of [0, 6, -1, 2.5, 'pet', null, '__proto__']) assert.equal(send({ rating }).error.code, 'VALIDATION', String(rating));
    assert.equal(send({ rating: 4, comment: '=IMPORTXML("x")' }).ok, true);
    assert.equal(send({ rating: 1 }).data.duplicate, true);
    assert.equal(emu.rows('FEEDBACK').length, 1);
    assert.equal(emu.rows('FEEDBACK')[0].Rating, 4);
    noServerErrors(emu);
  });
});

describe('Google Sheets data after a mixed day', () => {
  test('every row is complete, linked and adds up; statuses agree across ORDERS and ORDER_ITEMS', () => {
    const emu = freshBackend({ now: '2026-09-23T11:00:00+02:00' });
    const { call } = adminSession(emu);
    const bodies = [
      {},
      { ...PICKUP, clientTotal: 820 },
      { items: [{ productId: 'klasik', qty: 2, options: [...KLASIK, 'dod-meso'] }, { ...COLA, qty: 3 }], clientTotal: 2 * 920 + 600 + 250, cash: 5000 },
      { address: { zone: 'ns-okolina' }, clientTotal: 820 + 350 },
      { ...PICKUP, when: '2026-09-24 12:00', items: [{ productId: 'giros-duo', qty: 1, options: ['d1-pilece', 'd2-svinjsko', 'pita-atina', 'ds1-cola', 'ds2-fanta'] }], clientTotal: 1690 },
      { when: '2026-09-23 20:30', note: 'Interfon ne radi' },
      { ...PICKUP, items: [FRIES, COLA, { productId: 'tzatziki-100', qty: 2, options: [] }], clientTotal: 290 + 200 + 240 }
    ];
    const orders = bodies.map((b, i) => {
      emu.setNow(`2026-09-23T11:${String(10 + i * 5).padStart(2, '0')}:00+02:00`);
      const r = placeOrder(emu, { ...b, customer: { phone: '06410000' + String(i).padStart(2, '0'), email: i % 2 ? '' : `kupac${i}@example.com` } });
      assert.equal(r.ok, true, i + ' ' + JSON.stringify(r.error));
      return r.data;
    });
    call('admin.product.save', { product: { ...call('admin.catalog').data.products.find((p) => p.id === 'klasik'), price: 700 } });
    const moves = [['CONFIRMED', 'PREPARING', 'READY', 'COMPLETED'], ['REJECTED'], ['CONFIRMED', 'READY'], ['CONFIRMED', 'PREPARING', 'CONFIRMED'], [], ['CONFIRMED', 'COMPLETED', 'READY'], ['CONFIRMED']];
    moves.forEach((list, i) => list.forEach((s) => assert.equal(call('admin.status', { orderId: orders[i].orderId, status: s }).ok, true, `${i} → ${s}`)));

    const rows = emu.rows('ORDERS');
    const items = emu.rows('ORDER_ITEMS');
    assert.equal(rows.length, bodies.length, 'one row per order');
    assert.deepEqual(rows.map((r) => r['Public Order Number']), bodies.map((_, i) => 1001 + i), 'consecutive, unique numbers');
    assert.equal(new Set(rows.map((r) => r['Internal Order ID'])).size, rows.length);
    const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;
    rows.forEach((r, i) => {
      const tag = `#${r['Public Order Number']}`;
      assert.match(r['Internal Order ID'], /^GG-20260923-\d{4}-[0-9A-F]{4,}$/, tag);
      for (const col of ['Business Date', 'Order Type', 'Status', 'Customer Name', 'Phone', 'Order Items', 'Items Count', 'Subtotal', 'Total', 'Requested Time', 'Promised Time', 'Accept By', 'Request ID', 'Status Token', 'Created At', 'Updated At', 'Items JSON', 'Email Status', 'Location ID']) {
        assert.ok(r[col] !== '' && r[col] !== undefined && r[col] !== null, `${tag}: ${col} is empty`);
      }
      assert.equal(r['Business Date'], '2026-09-23');
      for (const col of ['Accept By', 'Created At', 'Updated At']) assert.match(r[col], iso, `${tag} ${col}`);
      assert.equal(r.Total, r.Subtotal + (r['Delivery Cost'] || 0), `${tag} total`);
      const own = items.filter((it) => it['Order ID'] === r['Internal Order ID']);
      assert.ok(own.length > 0, `${tag} has items`);
      assert.equal(own.reduce((s, it) => s + it['Line Total'], 0), r.Subtotal, `${tag} items add up to the subtotal`);
      assert.equal(own.reduce((s, it) => s + it.Qty, 0), r['Items Count'], `${tag} item count`);
      own.forEach((it) => {
        assert.equal(it.Status, r.Status, `${tag} item status follows the order`);
        assert.equal(it['Public Number'], r['Public Order Number']);
        assert.equal(it['Unit Price'] * it.Qty, it['Line Total']);
        assert.equal(it['Base Price'] + it['Options Price'], it['Unit Price']);
      });
      assert.equal(JSON.parse(r['Items JSON']).reduce((s, l) => s + l.lineTotal, 0), r.Subtotal, `${tag} Items JSON`);
      if (r['Order Type'] === 'DELIVERY') {
        for (const col of ['Address', 'Zone', 'Cash Provided']) assert.ok(r[col] !== '', `${tag}: ${col}`);
        assert.equal(r['Change Required'], r['Cash Provided'] - r.Total);
      } else {
        assert.equal(r.Address, '');
        assert.equal(r['Delivery Cost'], 0);
      }
    });
    const byNo = (n) => rows.find((r) => r['Public Order Number'] === n);
    assert.equal(byNo(1003)['Order Items'].includes('Klasik'), true);
    assert.equal(items.find((it) => it['Order ID'] === orders[2].orderId && it['Product ID'] === 'klasik')['Base Price'], 620, 'price change later does not touch the old order');
    assert.deepEqual([byNo(1001).Status, byNo(1002).Status, byNo(1003).Status, byNo(1004).Status, byNo(1005).Status, byNo(1006).Status, byNo(1007).Status], ['COMPLETED', 'REJECTED', 'READY', 'CONFIRMED', 'NEW', 'READY', 'CONFIRMED']);
    assert.ok(byNo(1001)['Confirmed At'] && byNo(1001)['Preparing At'] && byNo(1001)['Ready At'] && byNo(1001)['Completed At']);
    assert.ok(byNo(1002)['Rejected At'] && !byNo(1002)['Confirmed At']);
    assert.equal(byNo(1005)['Scheduled Date'], '2026-09-24');
    assert.equal(byNo(1005)['Scheduled Time'], '12:00');
    assert.equal(emu.rows('CUSTOMERS').length, bodies.length, 'one customer per phone');
    assert.equal(emu.rows('CUSTOMERS').find((c) => c.Phone === '+381641000001')['Rejected Orders'], 1);
    noServerErrors(emu);
  });
});

describe('daily email quota (free Gmail: 100 recipients a day)', () => {
  test('guest emails stop first so the last sends still reach the kitchen; the panel shows what is left', () => {
    const emu = freshBackend();
    const { call } = adminSession(emu);
    emu.state.mailQuota = 14;
    const guest = { customer: { email: 'gost@example.com' } };
    placeOrder(emu, { ...guest, customer: { email: 'gost@example.com', phone: '0641000001' } }); // 3 kitchen + 1 guest → 10 left
    placeOrder(emu, { ...guest, customer: { email: 'gost@example.com', phone: '0641000002' } }); // 3 kitchen, guest skipped (would leave 6)
    placeOrder(emu, { customer: { phone: '0641000003' } }); // 3 kitchen → 4 left
    placeOrder(emu, { customer: { phone: '0641000004' } }); // 3 kitchen → 1 left
    placeOrder(emu, { customer: { phone: '0641000005' } }); // only the first kitchen address
    const statuses = emu.rows('ORDERS').map((r) => r['Email Status']);
    assert.match(statuses[0], /^SENT 3 · kupac OK$/);
    assert.match(statuses[1], /^SENT 3 · kupac quota_reserved$/);
    assert.match(statuses[4], /^PARTIAL 1\/3$/);
    assert.equal(emu.state.outbox.filter((m) => m.to === 'kuhinja@grckigiros.test').length, 5, 'every order reached the kitchen');
    emu.state.cache.clear();
    const board = call('admin.board').data;
    assert.equal(board.settings.emailQuota, 0);
    assert.ok(emu.rows('SYSTEM_LOG').some((l) => /email kupcu je preskočen/.test(l.Message)));
  });
});
