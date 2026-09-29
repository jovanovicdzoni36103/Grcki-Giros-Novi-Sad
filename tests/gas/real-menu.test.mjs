// The real menu (data/seed.json) through the real backend: every kind of product can be ordered and is
// priced by the server exactly like on the site.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { freshBackend, placeOrder, bootstrap, adminSession } from './helpers.mjs';

const REAL = JSON.parse(readFileSync(new URL('../../data/seed.json', import.meta.url), 'utf8'));
const line = (productId, options = [], qty = 1) => ({ productId, qty, options, note: '' });

test('bootstrap serves the real menu with photos, akcije and drinks', () => {
  const emu = freshBackend({ seed: REAL });
  const data = bootstrap(emu);
  assert.deepEqual(data.catalog.categories.map((c) => c.id), ['giros', 'akcije', 'rostilj', 'prilozi', 'pice']);
  assert.equal(data.catalog.products.length, REAL.catalog.products.length);
  assert.equal(data.catalog.products.find((p) => p.id === 'banjalucki-cevap').image, '/assets/img/menu/banjalucki-cevap.webp');
  assert.equal(data.business.job_phone_display, '063 877 33 63');
  assert.equal(data.business.second_location, 'Bulevar kralja Petra I 61, Novi Sad');
});

test('a realistic delivery order from the real menu: giros, akcija, roštilj, sides, drinks', () => {
  const emu = freshBackend({ seed: REAL, now: '2026-09-30T19:00:00+02:00' });
  const items = [
    line('giros-veliki', ['meso-pilece', 'pr-caciki', 'sal-paradajz', 'sal-luk', 'pup-da', 'dod-meso']), // 550 + 330
    line('giros-mali', ['meso-svinjsko', 'pr-urnebes', 'pak-stiropor'], 2), // 2 × 450
    line('akcija-giros-veliki', ['meso-mix', 'pr-caciki', 'sal-paradajz', 'sal-luk', 'pup-da']), // 650
    line('pljeskavica-velika', ['pr-urnebes', 'sal-beli-kupus']), // 450
    line('kobasica-sa-sirom', []), // 600
    line('pomfrit', ['uzp-kecap', 'uzp-so']), // 230
    line('premaz-100', ['pi-tirokafteri']), // 190
    line('coca-cola', ['pp-flasa']), // 150
    line('joy', ['joy-visnja']), // 150
    line('pivo-tuborg') // 250
  ];
  const subtotal = 880 + 900 + 650 + 450 + 600 + 230 + 190 + 150 + 150 + 250;
  const r = placeOrder(emu, { items, clientTotal: subtotal + 250, cash: 5000, when: 'asap' });
  assert.equal(r.ok, true, JSON.stringify(r.error));
  assert.equal(r.data.subtotal, subtotal);
  assert.equal(r.data.total, subtotal + 250);
  const ticket = emu.state.outbox.find((m) => /NOVA PORUDŽBINA/.test(m.htmlBody || ''));
  for (const text of ['Giros veliki', 'Meso plus 100 g', 'Bez pite — u ketering stiroporu', 'Kobasica sa sirom', 'Flaša 0,5 l', 'Višnja', 'Pivo Tuborg']) {
    assert.ok(ticket.htmlBody.includes(text), 'kitchen ticket shows ' + text);
  }
  const rows = emu.rows('ORDER_ITEMS');
  assert.equal(rows.length, items.length);
  assert.equal(rows.reduce((s, x) => s + x['Line Total'], 0), subtotal);
});

test('what the server refuses on the real menu: no meat, no Joy flavour, two drink sizes', () => {
  const emu = freshBackend({ seed: REAL, now: '2026-09-30T19:00:00+02:00' });
  const pickup = { mode: 'pickup', address: {}, cash: undefined };
  assert.match(placeOrder(emu, { ...pickup, items: [line('giros-veliki', ['pr-caciki'])], clientTotal: 550 }).error.message, /meso/);
  assert.match(placeOrder(emu, { ...pickup, items: [line('joy')], clientTotal: 150 }).error.message, /ukus/);
  assert.match(placeOrder(emu, { ...pickup, items: [line('coca-cola', ['pp-limenka', 'pp-flasa'])], clientTotal: 150 }).error.message, /samo jedan izbor/);
  assert.equal(emu.rows('ORDERS').length, 0);
});

test('the shop edits a real product in the admin panel: its photo that ships with the site is kept', () => {
  const emu = freshBackend({ seed: REAL });
  const { call } = adminSession(emu);
  const p = call('admin.catalog').data.products.find((x) => x.id === 'giros-veliki');
  const saved = call('admin.product.save', { product: { ...p, price: 560 } });
  assert.equal(saved.ok, true, JSON.stringify(saved.error));
  const after = saved.data.catalog.products.find((x) => x.id === 'giros-veliki');
  assert.deepEqual([after.price, after.image], [560, '/assets/img/menu/giros.webp']);
  for (const bad of ['/assets/img/../../x.webp', '/assets/img/a.webp"', 'javascript:alert(1)', '/etc/passwd', 'http://evil.example/x.png']) {
    assert.equal(call('admin.product.save', { product: { ...p, image: bad } }).error.field, 'image', bad);
  }
});
