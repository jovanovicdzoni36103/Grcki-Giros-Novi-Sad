import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { freshBackend, placeOrder, bootstrap } from './helpers.mjs';

const PIN = '482913';

function login(emu, pin = PIN) {
  return emu.doPost({ action: 'panel.login', payload: { pin } });
}

describe('panel authentication', () => {
  test('no PIN configured yet', () => {
    const emu = freshBackend();
    const r = login(emu);
    assert.equal(r.error.code, 'UNAUTHORIZED');
    assert.match(r.error.message, /PIN za panel još nije podešen/);
  });

  test('PIN rules, wrong PIN, lockout after repeated failures', () => {
    const emu = freshBackend();
    assert.throws(() => emu.run('setPanelPin_', '1234'), /6 do 8 cifara/);
    emu.run('setPanelPin_', PIN);
    assert.ok(!Object.values(emu.state.properties).includes(PIN), 'PIN is never stored in clear text');
    assert.equal(login(emu, '000000').error.message, 'Pogrešan PIN.');
    for (let i = 0; i < 7; i++) login(emu, '000000');
    const locked = login(emu, PIN);
    assert.equal(locked.error.code, 'RATE_LIMITED');
    emu.setNow('2026-09-23T14:40:00+02:00');
    assert.equal(login(emu).ok, true, 'lockout expires');
  });

  test('tampered and expired tokens are refused', () => {
    const emu = freshBackend();
    emu.run('setPanelPin_', PIN);
    const { token } = login(emu).data;
    const parts = token.split('.');
    const forged = `panel.${Number(parts[1]) + 999999}.${parts[2]}`;
    assert.equal(emu.doPost({ action: 'panel.orders', payload: { token: forged } }).error.code, 'UNAUTHORIZED');
    emu.setNow('2026-09-24T03:00:00+02:00');
    const expired = emu.doPost({ action: 'panel.orders', payload: { token } });
    assert.equal(expired.error.message, 'Sesija je istekla. Unesite PIN ponovo.');
  });
});

describe('panel operations', () => {
  const emu = freshBackend();
  emu.run('setPanelPin_', PIN);
  const order = placeOrder(emu, { customer: { email: '' } }).data;
  const { token } = login(emu).data;
  const call = (action, payload = {}) => emu.doPost({ action, payload: { token, ...payload } });

  test('lists today\'s orders with items, settings and products', () => {
    const r = call('panel.orders');
    assert.equal(r.ok, true);
    assert.equal(r.data.orders.length, 1);
    const o = r.data.orders[0];
    assert.equal(o.publicNumber, 1);
    assert.equal(o.status, 'NEW');
    assert.equal(o.items[0].name, 'Klasik');
    assert.equal(o.cash, 2000);
    assert.equal(o.change, 930);
    assert.equal(o.address.line, 'Bulevar oslobođenja 12a');
    assert.equal(r.data.settings.orderingEnabled, true);
    assert.equal(r.data.products.length, 27);
  });

  test('accept → ready → out for delivery → completed, with timestamps', () => {
    assert.equal(call('panel.status', { orderId: order.orderId, status: 'ACCEPTED' }).data.status, 'ACCEPTED');
    let row = emu.rows('ORDERS')[0];
    assert.match(row['Accepted At'], /^2026-09-23T14:23/);
    assert.equal(emu.rows('ORDER_ITEMS')[0].Status, 'ACCEPTED');
    assert.equal(emu.doGet({ action: 'order.status', id: order.orderId, t: order.statusToken }).data.status, 'ACCEPTED');
    emu.setNow('2026-09-23T14:41:00+02:00');
    call('panel.status', { orderId: order.orderId, status: 'OUT_FOR_DELIVERY' });
    row = emu.rows('ORDERS')[0];
    assert.equal(row['Actual Time'], '14:41');
    call('panel.status', { orderId: order.orderId, status: 'COMPLETED' });
    assert.match(emu.rows('ORDERS')[0]['Completed At'], /^2026-09-23T14:41/);
    assert.equal(call('panel.status', { orderId: order.orderId, status: 'LOST' }).error.code, 'BAD_REQUEST');
  });

  test('cancelling keeps the CRM honest', () => {
    const second = placeOrder(emu, { customer: { phone: '0651112223' } }).data;
    let customer = emu.rows('CUSTOMERS').find((c) => c.Phone === '+381651112223');
    assert.equal(customer.Orders, 1);
    call('panel.status', { orderId: second.orderId, status: 'CANCELLED' });
    customer = emu.rows('CUSTOMERS').find((c) => c.Phone === '+381651112223');
    assert.equal(customer.Orders, 0);
    assert.equal(customer['Total Spent'], 0);
    assert.equal(customer['Cancelled Orders'], 1);
  });

  test('sold-out toggle reaches the website and blocks the product', () => {
    call('panel.availability', { productId: 'coca-cola', available: false });
    const product = bootstrap(emu).catalog.products.find((p) => p.id === 'coca-cola');
    assert.equal(product.available, false);
    assert.equal(placeOrder(emu, { customer: { phone: '0667778889' } }).error.code, 'ITEM_UNAVAILABLE');
    call('panel.availability', { productId: 'coca-cola', available: true });
    assert.equal(bootstrap(emu).catalog.products.find((p) => p.id === 'coca-cola').available, true);
  });

  test('pause switch and busy time', () => {
    call('panel.settings', { orderingEnabled: false });
    assert.equal(bootstrap(emu).business.ordering_enabled, 'FALSE');
    assert.equal(placeOrder(emu, { customer: { phone: '0667778880' } }).error.code, 'CLOSED');
    call('panel.settings', { orderingEnabled: true, extraWaitMin: 15 });
    const busy = placeOrder(emu, { customer: { phone: '0667778881' } });
    assert.equal(busy.ok, true, JSON.stringify(busy.error));
    assert.equal(busy.data.promisedTime, '16:00', '14:41 + 60 min delivery + 15 min busy = 15:56, shown rounded up to 16:00');
    assert.equal(busy.data.etaMin, 75);
  });
});
