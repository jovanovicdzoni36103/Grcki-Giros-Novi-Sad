import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { freshBackend, placeOrder, bootstrap, adminSession, setSettings, plain } from './helpers.mjs';

const PIN = '482913';
const PICKUP = { mode: 'pickup', address: {}, cash: undefined, clientTotal: 820 };
const KLASIK = ['meso-pilece', 'pita-atina', 'sos-tzatziki', 'sal-paradajz', 'sal-luk', 'zac-origano', 'pup-da'];

function login(emu, pin = PIN) {
  return emu.doPost({ action: 'admin.login', payload: { pin } });
}

describe('admin authentication', () => {
  test('no PIN configured yet', () => {
    const emu = freshBackend();
    const r = login(emu);
    assert.equal(r.error.code, 'UNAUTHORIZED');
    assert.match(r.error.message, /PIN za admin panel još nije podešen/);
  });

  test('PIN rules, wrong PIN, lockout after repeated failures', () => {
    const emu = freshBackend();
    assert.throws(() => emu.run('setPanelPin_', '1234'), /6 do 8 cifara/);
    emu.run('setPanelPin_', PIN);
    assert.ok(!Object.values(emu.state.properties).includes(PIN), 'PIN is never stored in clear text');
    assert.equal(login(emu, '000000').error.message, 'Pogrešan PIN.');
    for (let i = 0; i < 7; i++) login(emu, '000000');
    assert.equal(login(emu, PIN).error.code, 'RATE_LIMITED');
    emu.setNow('2026-09-23T14:40:00+02:00');
    assert.equal(login(emu).ok, true, 'lockout expires');
  });

  test('every admin action needs a valid token; tampered and expired tokens are refused', () => {
    const emu = freshBackend();
    emu.run('setPanelPin_', PIN);
    const { token } = login(emu).data;
    for (const action of ['admin.board', 'admin.catalog', 'admin.settings.save', 'admin.product.save', 'admin.status', 'admin.image.upload']) {
      assert.equal(emu.doPost({ action, payload: {} }).error.code, 'UNAUTHORIZED', action);
    }
    const parts = token.split('.');
    assert.equal(emu.doPost({ action: 'admin.board', payload: { token: `admin.${Number(parts[1]) + 999999}.${parts[2]}` } }).error.code, 'UNAUTHORIZED');
    emu.setNow('2026-09-24T03:00:00+02:00');
    assert.equal(emu.doPost({ action: 'admin.board', payload: { token } }).error.message, 'Sesija je istekla. Unesite PIN ponovo.');
  });

  test('PIN can be changed from the panel with the current PIN', () => {
    const emu = freshBackend();
    const { call } = adminSession(emu, PIN);
    assert.equal(call('admin.pin.change', { currentPin: '111111', newPin: '765432' }).error.field, 'currentPin');
    assert.equal(call('admin.pin.change', { currentPin: PIN, newPin: '12' }).error.field, 'newPin');
    assert.equal(call('admin.pin.change', { currentPin: PIN, newPin: '765432' }).ok, true);
    assert.equal(login(emu, PIN).ok, false);
    assert.equal(login(emu, '765432').ok, true);
  });
});

describe('orders: board, 5-minute deadline, statuses, guest emails', () => {
  const emu = freshBackend();
  const { call } = adminSession(emu, PIN);
  const first = placeOrder(emu, { customer: { email: 'kupac@example.com' } }).data;

  test('a new order is on the board as NEW with its deadline, and on the dashboard', () => {
    const r = call('admin.board');
    assert.equal(r.ok, true, JSON.stringify(r.error));
    const o = r.data.orders[0];
    assert.equal(o.publicNumber, 1001);
    assert.equal(o.status, 'NEW');
    assert.equal(o.statusLabel, 'NOVA');
    assert.equal(o.acceptBy, '2026-09-23T14:28:00+02:00');
    assert.equal(o.overdue, false);
    assert.deepEqual(plain(o.next), ['CONFIRMED', 'REJECTED']);
    assert.equal(o.items[0].name, 'Klasik');
    assert.equal(o.address.aptFloor, 'stan 4, 2. sprat');
    assert.equal(o.address.zone, 'Novi Sad — grad');
    assert.deepEqual(plain(r.data.dashboard), { businessDate: '2026-09-23', orders: 1, value: 1070, delivery: 1, pickup: 0, completed: 0, rejected: 0, active: 1, overdue: 0, newCount: 1 });
    assert.equal(r.data.settings.acceptTimeoutMin, 5);
    assert.equal(r.data.shop.open, true);
  });

  test('after 5 minutes without an answer the order is overdue — never shown as confirmed', () => {
    emu.setNow('2026-09-23T14:29:00+02:00');
    const r = call('admin.board');
    assert.equal(r.data.orders[0].status, 'NEW');
    assert.equal(r.data.orders[0].overdue, true);
    assert.equal(r.data.dashboard.overdue, 1);
    const guest = emu.doGet({ action: 'order.status', id: first.orderId, t: first.statusToken }).data;
    assert.equal(guest.status, 'NEW');
    assert.equal(guest.overdue, true);
  });

  test('illegal jumps are refused (NEW cannot go straight to preparing)', () => {
    const r = call('admin.status', { orderId: first.orderId, status: 'PREPARING' });
    assert.equal(r.error.code, 'BAD_REQUEST');
    assert.match(r.error.message, /NOVA i ne može da pređe u U PRIPREMI/);
    assert.equal(call('admin.status', { orderId: first.orderId, status: 'LOST' }).error.code, 'BAD_REQUEST');
  });

  test('confirm: stamp, items and guest status follow, guest gets a "potvrđena" email', () => {
    const r = call('admin.status', { orderId: first.orderId, status: 'CONFIRMED' });
    assert.equal(r.data.status, 'CONFIRMED');
    const row = emu.rows('ORDERS')[0];
    assert.match(row['Confirmed At'], /^2026-09-23T14:29/);
    assert.equal(emu.rows('ORDER_ITEMS')[0].Status, 'CONFIRMED');
    assert.equal(emu.doGet({ action: 'order.status', id: first.orderId, t: first.statusToken }).data.status, 'CONFIRMED');
    const mail = emu.state.outbox.find((m) => m.subject.startsWith('Porudžbina #1001 je potvrđena'));
    assert.ok(mail, 'confirmation email sent');
    assert.equal(mail.to, 'kupac@example.com');
    assert.match(mail.htmlBody, /Stiže za oko 45–60 minuta/);
    assert.match(row['Email Status'], /kupac POTVRĐENA OK/);
  });

  test('preparing → ready → completed, each stamped; delivery "ready" sends no email', () => {
    const before = emu.state.outbox.length;
    emu.setNow('2026-09-23T14:35:00+02:00');
    call('admin.status', { orderId: first.orderId, status: 'PREPARING' });
    emu.setNow('2026-09-23T14:50:00+02:00');
    call('admin.status', { orderId: first.orderId, status: 'READY' });
    emu.setNow('2026-09-23T15:20:00+02:00');
    call('admin.status', { orderId: first.orderId, status: 'COMPLETED' });
    const row = emu.rows('ORDERS')[0];
    assert.match(row['Preparing At'], /T14:35/);
    assert.match(row['Ready At'], /T14:50/);
    assert.match(row['Completed At'], /T15:20/);
    assert.equal(row.Status, 'COMPLETED');
    assert.equal(emu.state.outbox.length, before);
  });

  test('a mis-tap can be undone one step (ZAVRŠENA → SPREMNA)', () => {
    assert.equal(call('admin.status', { orderId: first.orderId, status: 'READY' }).data.status, 'READY');
    assert.equal(call('admin.status', { orderId: first.orderId, status: 'COMPLETED' }).data.status, 'COMPLETED');
  });

  test('reject: guest sees it, gets an email, CRM stays honest, and it is final', () => {
    const second = placeOrder(emu, { customer: { phone: '0651112223', email: 'drugi@example.com' } }).data;
    assert.equal(emu.rows('CUSTOMERS').find((c) => c.Phone === '+381651112223').Orders, 1);
    assert.equal(call('admin.status', { orderId: second.orderId, status: 'REJECTED' }).data.status, 'REJECTED');
    const customer = emu.rows('CUSTOMERS').find((c) => c.Phone === '+381651112223');
    assert.equal(customer.Orders, 0);
    assert.equal(customer['Rejected Orders'], 1);
    assert.equal(emu.doGet({ action: 'order.status', id: second.orderId, t: second.statusToken }).data.status, 'REJECTED');
    assert.ok(emu.state.outbox.some((m) => m.to === 'drugi@example.com' && /nije prihvaćena/.test(m.subject)));
    assert.equal(call('admin.status', { orderId: second.orderId, status: 'CONFIRMED' }).error.code, 'BAD_REQUEST');
    assert.match(emu.rows('ORDERS').find((r) => r['Internal Order ID'] === second.orderId)['Rejected At'], /^2026-09-23T15:20/);
  });

  test('pickup ready: the guest gets "možete da dođete"', () => {
    const p = placeOrder(emu, { ...PICKUP, customer: { phone: '0651112224', email: 'treci@example.com' } }).data;
    call('admin.status', { orderId: p.orderId, status: 'CONFIRMED' });
    call('admin.status', { orderId: p.orderId, status: 'READY' });
    assert.ok(emu.state.outbox.some((m) => m.to === 'treci@example.com' && /je spremna/.test(m.subject)));
  });

  test('dashboard at the end of the day', () => {
    const d = call('admin.board').data.dashboard;
    assert.equal(d.orders, 3);
    assert.equal(d.completed, 1);
    assert.equal(d.rejected, 1);
    assert.equal(d.delivery, 2);
    assert.equal(d.pickup, 1);
    assert.equal(d.value, 1070 + 820, 'rejected orders do not count');
  });

  test('no guest emails when the guest left no email address', () => {
    const before = emu.state.outbox.length;
    const o = placeOrder(emu, { customer: { phone: '0651112225', email: '' } }).data;
    const afterOrder = emu.state.outbox.length;
    call('admin.status', { orderId: o.orderId, status: 'CONFIRMED' });
    assert.equal(emu.state.outbox.length, afterOrder);
    assert.equal(afterOrder - before, 3, 'only the kitchen ticket');
  });
});

describe('history search', () => {
  const emu = freshBackend({ settings: { rate_limit_phone_count: '100' } });
  placeOrder(emu, { customer: { name: 'Ana Petrović', phone: '0641111111' } });
  placeOrder(emu, { customer: { name: 'Marko Ilić', phone: '0652222222' } });
  emu.setNow('2026-09-24T12:00:00+02:00');
  const { call } = adminSession(emu, PIN);
  const third = placeOrder(emu, { customer: { name: 'Ana Marković', phone: '0663333333' } }).data;
  call('admin.status', { orderId: third.orderId, status: 'REJECTED' });

  test('by number, name, phone (any notation), date and status', () => {
    assert.deepEqual(plain(call('admin.history', { q: '#1002' }).data.orders.map((o) => o.publicNumber)), [1002]);
    assert.deepEqual(plain(call('admin.history', { q: 'ana' }).data.orders.map((o) => o.publicNumber)), [1003, 1001]);
    assert.deepEqual(plain(call('admin.history', { q: '065 222' }).data.orders.map((o) => o.customer.name)), ['Marko Ilić']);
    assert.deepEqual(plain(call('admin.history', { q: '+38164111' }).data.orders.map((o) => o.publicNumber)), [1001]);
    assert.equal(call('admin.history', { date: '2026-09-23' }).data.total, 2);
    assert.deepEqual(plain(call('admin.history', { status: 'REJECTED' }).data.orders.map((o) => o.publicNumber)), [1003]);
    assert.equal(call('admin.history', {}).data.total, 3);
    assert.equal(call('admin.history', { q: 'nepostojeći' }).data.total, 0);
  });
});

describe('catalog management without code', () => {
  test('add a product: it appears on the site and can be ordered', () => {
    const emu = freshBackend();
    const { call } = adminSession(emu, PIN);
    const r = call('admin.product.save', { product: { name: 'Pita sa spanaćem', categoryId: 'prilozi', price: 280, description: 'Domaća.', groups: [], art: 'pita' } });
    assert.equal(r.ok, true, JSON.stringify(r.error));
    assert.equal(r.data.id, 'pita-sa-spanacem');
    const p = bootstrap(emu).catalog.products.find((x) => x.id === 'pita-sa-spanacem');
    assert.equal(p.price, 280);
    assert.equal(p.sort, 5, 'placed last in its category');
    const o = placeOrder(emu, { ...PICKUP, items: [{ productId: 'pita-sa-spanacem', qty: 2, options: [] }], clientTotal: 560 });
    assert.equal(o.ok, true, JSON.stringify(o.error));
  });

  test('edit price, description, image and category; old orders keep old values', () => {
    const emu = freshBackend();
    const { call } = adminSession(emu, PIN);
    const old = placeOrder(emu).data;
    const cat = call('admin.catalog').data;
    const klasik = cat.products.find((p) => p.id === 'klasik');
    const r = call('admin.product.save', { product: { ...klasik, price: 690, description: 'Novi opis.', image: 'https://lh3.googleusercontent.com/d/abc=w900' } });
    assert.equal(r.ok, true, JSON.stringify(r.error));
    const live = bootstrap(emu).catalog.products.find((p) => p.id === 'klasik');
    assert.deepEqual([live.price, live.description, live.image], [690, 'Novi opis.', 'https://lh3.googleusercontent.com/d/abc=w900']);
    const row = emu.rows('PRODUCTS').find((p) => p.id === 'klasik');
    assert.equal(row.demo, false, 'a product saved by the shop is no longer marked demo');
    assert.equal(emu.rows('ORDERS')[0].Total, old.total);
    assert.equal(JSON.parse(emu.rows('ORDERS')[0]['Items JSON'])[0].unitPrice, 620);
    const moved = call('admin.product.save', { product: { ...klasik, price: 690, categoryId: 'porcije' } });
    assert.equal(moved.ok, true);
    assert.equal(bootstrap(emu).catalog.products.find((p) => p.id === 'klasik').categoryId, 'porcije');
  });

  test('validation: name, price, category, image address', () => {
    const emu = freshBackend();
    const { call } = adminSession(emu, PIN);
    const base = { name: 'Test', categoryId: 'pice', price: 100 };
    assert.equal(call('admin.product.save', { product: { ...base, name: '' } }).error.field, 'name');
    assert.equal(call('admin.product.save', { product: { ...base, price: -5 } }).error.field, 'price');
    assert.equal(call('admin.product.save', { product: { ...base, price: 'abc' } }).error.field, 'price');
    assert.equal(call('admin.product.save', { product: { ...base, categoryId: 'nema' } }).error.field, 'categoryId');
    assert.equal(call('admin.product.save', { product: { ...base, image: 'javascript:alert(1)' } }).error.field, 'image');
    assert.equal(call('admin.product.save', { product: { ...base, id: 'ne-postoji' } }).error.code, 'BAD_REQUEST');
  });

  test('sold out (available) and hidden (active) switches', () => {
    const emu = freshBackend();
    const { call } = adminSession(emu, PIN);
    call('admin.product.flag', { id: 'coca-cola', field: 'available', value: false });
    assert.equal(bootstrap(emu).catalog.products.find((p) => p.id === 'coca-cola').available, false);
    assert.equal(placeOrder(emu).error.code, 'ITEM_UNAVAILABLE');
    call('admin.product.flag', { id: 'coca-cola', field: 'available', value: true });
    call('admin.product.flag', { id: 'fanta', field: 'active', value: false });
    assert.equal(bootstrap(emu).catalog.products.some((p) => p.id === 'fanta'), false, 'hidden from the menu');
    assert.ok(call('admin.catalog').data.products.some((p) => p.id === 'fanta' && p.active === false), 'still editable in admin');
    assert.equal(call('admin.product.flag', { id: 'fanta', field: 'price', value: 1 }).error.code, 'BAD_REQUEST');
  });

  test('reorder products within a category', () => {
    const emu = freshBackend();
    const { call } = adminSession(emu, PIN);
    call('admin.product.move', { id: 'ljutko', dir: 'up' });
    const order = bootstrap(emu).catalog.products.filter((p) => p.categoryId === 'giros').sort((a, b) => a.sort - b.sort).map((p) => p.id);
    assert.deepEqual(order.slice(0, 3), ['ljutko', 'klasik', 'atina']);
  });

  test('categories: add, rename, switch off (its products disappear), reorder', () => {
    const emu = freshBackend();
    const { call } = adminSession(emu, PIN);
    const added = call('admin.category.save', { category: { name: 'Deserti', description: 'Slatko.' } });
    assert.equal(added.data.id, 'deserti');
    assert.ok(bootstrap(emu).catalog.categories.some((c) => c.id === 'deserti'));
    call('admin.category.save', { category: { id: 'deserti', name: 'Slatkiši', active: true } });
    assert.equal(bootstrap(emu).catalog.categories.find((c) => c.id === 'deserti').name, 'Slatkiši');
    call('admin.category.save', { category: { id: 'pice', name: 'Piće', active: false } });
    assert.equal(bootstrap(emu).catalog.products.some((p) => p.categoryId === 'pice'), false);
    call('admin.category.move', { id: 'salate', dir: 'up' });
    const cats = bootstrap(emu).catalog.categories.sort((a, b) => a.sort - b.sort).map((c) => c.id);
    assert.deepEqual(cats.slice(3, 5), ['salate', 'prilozi']);
  });

  test('add-ons: new option with a price is chargeable; disabling it blocks orders that use it', () => {
    const emu = freshBackend();
    const { call } = adminSession(emu, PIN);
    const r = call('admin.option.save', { option: { groupId: 'dodaci', name: 'Extra sir', price: 120 } });
    assert.equal(r.ok, true, JSON.stringify(r.error));
    const id = r.data.id;
    assert.equal(id, 'dodaci-extra-sir');
    const order = placeOrder(emu, { items: [{ productId: 'klasik', qty: 1, options: [...KLASIK, id] }], clientTotal: 740 + 250 });
    assert.equal(order.ok, true, JSON.stringify(order.error));
    assert.match(emu.rows('ORDER_ITEMS')[0].Options, /Extra sir \+120/);
    call('admin.option.save', { option: { id, name: 'Extra sir', price: 150 } });
    assert.equal(bootstrap(emu).catalog.options.find((o) => o.id === id).price, 150);
    call('admin.option.save', { option: { id, name: 'Extra sir', price: 150, available: false } });
    const blocked = placeOrder(emu, { items: [{ productId: 'klasik', qty: 1, options: [...KLASIK, id] }], clientTotal: 770 + 250, customer: { phone: '0659998887' } });
    assert.equal(blocked.error.code, 'ITEM_UNAVAILABLE');
    const g = call('admin.group.save', { group: { name: 'Ljutina', type: 'single', required: true } });
    assert.equal(g.data.catalog.groups.find((x) => x.id === g.data.id).min, 1);
    assert.equal(call('admin.option.save', { option: { groupId: 'nema', name: 'X' } }).error.field, 'groupId');
  });
});

describe('zones, hours and settings from the panel', () => {
  test('zones: add with fee and minimum, switch off, blank minimum = 500', () => {
    const emu = freshBackend();
    const { call } = adminSession(emu, PIN);
    const r = call('admin.zone.save', { zone: { name: 'Veternik', areas: 'Veternik, Futog', fee: 400, minOrder: 1000 } });
    assert.equal(r.ok, true, JSON.stringify(r.error));
    const z = bootstrap(emu).zones.find((x) => x.id === 'veternik');
    assert.deepEqual(plain([z.fee, z.minOrder, z.areas]), [400, 1000, ['Veternik', 'Futog']]);
    assert.equal(placeOrder(emu, { address: { zone: 'veternik' }, clientTotal: 820 + 400 }).error.code, 'MIN_ORDER');
    call('admin.zone.save', { zone: { id: 'veternik', name: 'Veternik', areas: 'Veternik', fee: 400, minOrder: '', active: true } });
    assert.equal(bootstrap(emu).zones.find((x) => x.id === 'veternik').minOrder, 500);
    call('admin.zone.save', { zone: { id: 'veternik', name: 'Veternik', areas: 'Veternik', fee: 400, minOrder: 500, active: false } });
    assert.equal(bootstrap(emu).zones.some((x) => x.id === 'veternik'), false);
    assert.equal(placeOrder(emu, { address: { zone: 'veternik' }, clientTotal: 820 + 400, customer: { phone: '0651231239' } }).error.code, 'ZONE_UNAVAILABLE');
    assert.equal(call('admin.zone.save', { zone: { name: 'X', fee: -1 } }).error.field, 'name');
  });

  test('hours: break and a day off take effect at once; bad input is explained', () => {
    const emu = freshBackend();
    const { call } = adminSession(emu, PIN);
    const hours = call('admin.hours').data.hours;
    const wed = hours.find((h) => h.dow === 3);
    const edited = hours.map((h) => (h.dow === 3 ? { ...h, break_start: '14:00', break_end: '15:00' } : h.dow === 4 ? { ...h, closed: true } : h));
    const r = call('admin.hours.save', { hours: edited });
    assert.equal(r.ok, true, JSON.stringify(r.error));
    assert.equal(placeOrder(emu).error.code, 'CLOSED');
    assert.match(placeOrder(emu).error.message, /Pauza je u toku/);
    const b = bootstrap(emu);
    assert.equal(b.hours.find((h) => h.dow === 4).closed, true);
    assert.equal(b.hours.find((h) => h.dow === 3).break_start, '14:00');
    const bad = hours.map((h) => (h.dow === 3 ? { ...wed, break_start: '03:00', break_end: '04:00' } : h));
    assert.match(call('admin.hours.save', { hours: bad }).error.message, /Sreda: pauza mora biti unutar radnog vremena/);
    const noClose = hours.map((h) => (h.dow === 2 ? { ...h, close: '' } : h));
    assert.match(call('admin.hours.save', { hours: noClose }).error.message, /Utorak: unesite vreme otvaranja i zatvaranja/);
    assert.match(call('admin.hours.save', { hours: hours.map((h) => (h.dow === 1 ? { ...h, open: '9 ujutru' } : h)) }).error.message, /vreme u obliku 09:00/);
    assert.equal(call('admin.hours.save', { hours: hours.slice(0, 3) }).error.code, 'BAD_REQUEST');
  });

  test('ordering / delivery / pickup switches and time estimates', () => {
    const emu = freshBackend();
    const { call } = adminSession(emu, PIN);
    call('admin.settings.save', { changes: { ordering_enabled: false } });
    assert.equal(bootstrap(emu).business.ordering_enabled, 'FALSE');
    assert.equal(placeOrder(emu).error.code, 'CLOSED');
    call('admin.settings.save', { changes: { ordering_enabled: true, delivery_enabled: false } });
    assert.match(placeOrder(emu).error.message, /Dostava je trenutno isključena/);
    call('admin.settings.save', { changes: { delivery_enabled: true, delivery_eta_min: 30, delivery_eta_max: 40, pickup_eta_min: 10, pickup_eta_max: 20 } });
    const r = placeOrder(emu, { customer: { phone: '0651231240' } });
    assert.deepEqual([r.data.etaMin, r.data.etaMax, r.data.promisedTime], [30, 40, '14:55']);
    assert.equal(call('admin.settings.save', { changes: { pickup_eta_min: 50, pickup_eta_max: 20 } }).error.field, 'pickup_eta_min');
    assert.equal(call('admin.settings.save', { changes: { extra_wait_min: 500 } }).error.field, 'extra_wait_min');
    assert.equal(call('admin.settings.save', { changes: { order_email_recipients: 'kuhinja@lokal.rs, nije-email' } }).error.field, 'order_email_recipients');
    assert.equal(call('admin.settings.save', { changes: { test_mode: 'FALSE' } }).error.code, 'BAD_REQUEST', 'not editable from the panel');
    const ok = call('admin.settings.save', { changes: { order_email_recipients: 'kuhinja@lokal.rs,  vlasnik@lokal.rs', accept_timeout_min: 7 } });
    assert.equal(ok.data.settings.order_email_recipients, 'kuhinja@lokal.rs, vlasnik@lokal.rs');
    assert.equal(call('admin.board').data.settings.acceptTimeoutMin, 7);
  });
});

describe('menu photos', () => {
  test('upload goes to a public Drive file and returns the image address', () => {
    const emu = freshBackend({ settings: { image_url_template: 'http://localhost:5190/__drive/{id}' } });
    const { call } = adminSession(emu, PIN);
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]).toString('base64');
    const r = call('admin.image.upload', { type: 'image/jpeg', data: 'data:image/jpeg;base64,' + jpeg, name: 'Klasik' });
    assert.equal(r.ok, true, JSON.stringify(r.error));
    const file = emu.state.driveFiles[0];
    assert.equal(file.sharing, 'ANYONE_WITH_LINK');
    assert.match(file.name, /^klasik-\d{8}-\d{6}\.jpg$/);
    assert.equal(r.data.url, `http://localhost:5190/__drive/${file.id}`);
    assert.equal(call('admin.image.upload', { type: 'application/pdf', data: jpeg }).error.field, 'image');
    assert.equal(call('admin.image.upload', { type: 'image/png', data: '' }).error.field, 'image');
  });
});

describe('guest feedback', () => {
  test('only after completion, once, visible in the admin', () => {
    const emu = freshBackend();
    const { call } = adminSession(emu, PIN);
    const o = placeOrder(emu).data;
    const send = (extra = {}) => emu.doPost({ action: 'feedback.submit', payload: { id: o.orderId, t: o.statusToken, rating: 5, good: ['taste', 'speed', 'hacker'], improve: [], comment: 'Odlično!', ...extra } });
    assert.match(send().error.message, /kada porudžbina bude završena/);
    for (const s of ['CONFIRMED', 'PREPARING', 'READY', 'COMPLETED']) call('admin.status', { orderId: o.orderId, status: s });
    assert.equal(emu.doGet({ action: 'order.status', id: o.orderId, t: o.statusToken }).data.feedbackAllowed, true);
    assert.equal(send({ rating: 7 }).error.field, 'rating');
    assert.equal(send({ t: 'wrong' }).error.code, 'BAD_REQUEST');
    assert.equal(send().data.saved, true);
    assert.equal(send().data.duplicate, true);
    assert.equal(emu.rows('FEEDBACK').length, 1);
    assert.equal(emu.rows('FEEDBACK')[0].Good, 'taste, speed', 'unknown chips are dropped');
    assert.equal(emu.doGet({ action: 'order.status', id: o.orderId, t: o.statusToken }).data.feedbackAllowed, false);
    const list = call('admin.feedback').data;
    assert.equal(list.count, 1);
    assert.equal(list.average, 5);
    assert.deepEqual(plain(list.items[0].good), ['Ukus', 'Brzina']);
    assert.equal(list.items[0].orderNumber, 1001);
  });
});

describe('two orders at almost the same time', () => {
  test('each gets its own number and row; the lock is taken and released around every write', () => {
    const emu = freshBackend({ settings: { rate_limit_phone_count: '100' } });
    const a = placeOrder(emu, { customer: { phone: '0641000001' } });
    const b = placeOrder(emu, { customer: { phone: '0641000002' } });
    assert.deepEqual([a.data.publicNumber, b.data.publicNumber], [1001, 1002]);
    assert.equal(emu.rows('ORDERS').length, 2);
    assert.equal(emu.rows('ORDER_ITEMS').length, 4);
    const events = plain(emu.state.lockLog.map((l) => l.event));
    assert.deepEqual(events, ['acquire', 'release', 'acquire', 'release']);
  });

  test('old panel.* actions no longer exist', () => {
    const emu = freshBackend();
    assert.equal(emu.doPost({ action: 'panel.orders', payload: {} }).error.code, 'BAD_REQUEST');
  });
});

describe('pause settings keep the menu visible', () => {
  test('bootstrap still returns the full menu while paused', () => {
    const emu = freshBackend();
    setSettings(emu, { ordering_enabled: 'FALSE' });
    assert.equal(bootstrap(emu).catalog.products.length, 27);
  });
});
