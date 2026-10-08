// The real menu (data/seed.json) through the real backend: served to the site as briefed on 2026-10-06
// (presentational site), and the public API takes no orders.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { freshBackend, placeOrder, bootstrap } from './helpers.mjs';

const REAL = JSON.parse(readFileSync(new URL('../../data/seed.json', import.meta.url), 'utf8'));
const line = (productId, options = [], qty = 1) => ({ productId, qty, options, note: '' });

test('bootstrap serves the real menu: akcije, roštilj, drinks and Extra meso, no photos', () => {
  const emu = freshBackend({ seed: REAL });
  const data = bootstrap(emu);
  assert.deepEqual(data.catalog.categories.map((c) => c.id), ['giros', 'akcije', 'rostilj', 'prilozi', 'pice']);
  assert.equal(data.catalog.products.length, REAL.catalog.products.length);
  assert.ok(data.catalog.products.every((p) => !p.image), 'no food photos');
  assert.equal(data.catalog.products.find((p) => p.id === 'extra-meso').price, 330);
  assert.equal(data.business.job_phone_display, '');
  assert.equal(data.business.address_note, 'ispod stadiona „Karađorđe“');
  assert.equal(data.business.second_location, '', 'the second shop is crossed out in the owner notebook (2026-10-06)');
});

test('"Učitaj meni iz sajta" replaces an old menu in the sheet with data/seed.json, settings untouched', () => {
  const emu = freshBackend({ seed: REAL });
  const products = emu.sheet('PRODUCTS');
  const h = products.data[0];
  const zero = products.data.find((r, i) => i > 0 && r[h.indexOf('id')] === 'coca-cola-zero');
  zero[h.indexOf('name')] = 'Coca-Cola Zero 0,33 l';
  products.data.push(h.map((c) => (c === 'id' ? 'stari-proizvod' : c === 'name' ? 'Stari proizvod' : '')));
  emu.state.cache.clear();
  const out = emu.run('reloadCatalogFromSeed_');
  assert.match(JSON.stringify(out), /PRODUCTS: 28/);
  const data = bootstrap(emu);
  assert.equal(data.catalog.products.length, REAL.catalog.products.length);
  assert.equal(data.catalog.products.find((p) => p.id === 'coca-cola-zero').name, 'Coca-Cola Zero');
  assert.ok(!data.catalog.products.some((p) => p.id === 'stari-proizvod'));
  assert.equal(data.business.address_note, 'ispod stadiona „Karađorđe“');
});

test('the public API refuses an order on the real menu: ordering is switched off in SETTINGS', () => {
  const emu = freshBackend({ seed: REAL, now: '2026-09-30T19:00:00+02:00' });
  const r = placeOrder(emu, { mode: 'pickup', address: {}, cash: undefined, items: [line('giros-veliki', ['meso-pilece', 'pr-caciki'])], clientTotal: 550 });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'CLOSED');
  assert.equal(emu.rows('ORDERS').length, 0);
  assert.equal(emu.state.outbox.length, 0, 'no kitchen ticket');
});
