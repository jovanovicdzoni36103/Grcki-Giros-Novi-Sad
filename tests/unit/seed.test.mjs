// The shop's real menu (data/seed.json, from the handwritten menu of 29.09.2026): consistent, complete and
// priced exactly as written. When the shop changes a price in the admin panel, only this file's price table
// needs updating if data/seed.json is edited too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Pricing = require('../../src/scripts/shared/pricing.cjs');
const seed = JSON.parse(readFileSync(new URL('../../data/seed.json', import.meta.url), 'utf8'));
const { categories, groups, options, products } = seed.catalog;
const index = Pricing.buildIndex(seed.catalog);
const setting = (k) => (seed.settings.find((r) => r.key === k) || {}).value;

test('every reference in the real menu points at something that exists', () => {
  const unique = (list, what) => assert.equal(new Set(list.map((x) => x.id)).size, list.length, `duplicate ${what} id`);
  unique(categories, 'category');
  unique(groups, 'group');
  unique(options, 'option');
  unique(products, 'product');
  for (const o of options) assert.ok(index.groups[o.groupId], `${o.id}: group ${o.groupId}`);
  for (const g of groups) assert.ok((index.optionsByGroup[g.id] || []).length > 0, `${g.id} has options`);
  for (const p of products) {
    assert.ok(categories.some((c) => c.id === p.categoryId), `${p.id}: category`);
    assert.ok(Number.isInteger(p.price) && p.price > 0, `${p.id}: price`);
    for (const g of p.groups) assert.ok(index.groups[g], `${p.id}: group ${g}`);
    for (const d of p.defaults) assert.ok(index.options[d] && p.groups.includes(index.options[d].groupId), `${p.id}: default ${d}`);
    for (const x of p.pairs) assert.ok(index.products[x], `${p.id}: pair ${x}`);
    if (p.image) assert.ok(existsSync(new URL(`../../src${p.image}`, import.meta.url)), `${p.id}: image ${p.image}`);
    if (p.bundleHint) for (const t of p.bundleHint.split('+')) assert.ok(index.products[t.replace(/^p:/, '')], `${p.id}: hint ${t}`);
    assert.equal(p.demo, false, `${p.id} is real, not demo`);
  }
});

test('prices exactly as in the handwritten menu', () => {
  const expected = {
    'giros-veliki': 550,
    'giros-mali': 450,
    'giros-porcija': 950,
    'vege-mali': 350,
    'vege-veliki': 450,
    pomfrit: 230,
    'akcija-giros-veliki': 650,
    'akcija-giros-mali': 550,
    'akcija-pljeskavica': 550,
    'pljeskavica-velika': 450,
    'pljeskavica-mala': 400,
    gurmanska: 500,
    'banjalucki-cevap': 600,
    'kobasica-sa-sirom': 600,
    'premaz-100': 190,
    'coca-cola': 150,
    'coca-cola-zero': 150,
    fanta: 150,
    sprite: 150,
    schweppes: 150,
    ultra: 150,
    joy: 150,
    rosa: 150,
    'knjaz-milos': 150,
    'pivo-alfa': 300,
    'pivo-tuborg': 250,
    'pivo-lav': 250
  };
  assert.deepEqual(Object.fromEntries(products.map((p) => [p.id, p.price])), expected);
  assert.equal(index.options['dod-meso'].price, 330, 'Meso plus 100 g');
  assert.ok(options.filter((o) => o.id !== 'dod-meso').every((o) => o.price === 0), 'every other choice is free');
});

test('a giros is ordered the way the shop takes it at the counter', () => {
  const line = (productId, opts) => ({ productId, qty: 1, options: opts, note: '' });
  const noMeat = Pricing.computeCart(index, [line('giros-veliki', ['pr-caciki'])], { mode: 'pickup' });
  assert.match(noMeat.errors[0].message, /Izaberi: meso/, 'meat has to be chosen');
  const full = Pricing.computeCart(index, [line('giros-veliki', ['meso-mix', 'pr-urnebes', 'sal-beli-kupus', 'zac-origano', 'pak-stiropor', 'dod-meso'])], { mode: 'pickup' });
  assert.equal(full.ok, true, JSON.stringify(full.errors));
  assert.equal(full.total, 550 + 330);
  const l = full.lines[0];
  assert.match(l.summary, /Mix/);
  assert.match(l.summary, /Bez pite — u ketering stiroporu/);
  assert.match(l.summary, /Meso plus 100 g \+330/);
  assert.equal(l.removedSummary, 'BEZ: caciki (tzatziki), paradajz, ljubičasti luk, pomfrit u piti', 'the kitchen sees what was taken off');
  const cola = Pricing.computeCart(index, [line('coca-cola', ['pp-flasa'])], { mode: 'pickup' }).lines[0];
  assert.equal(cola.summary, 'Flaša 0,5 l');
  assert.equal(cola.removedSummary, '', 'a switched single choice is not "BEZ"');
  assert.match(Pricing.computeCart(index, [line('joy', [])], { mode: 'pickup' }).errors[0].message, /Izaberi: ukus/);
});

test('akcija is cheaper than the same things bought apart, and the cart suggests it', () => {
  const lines = Pricing.computeCart(index, [
    { productId: 'giros-veliki', qty: 1, options: ['meso-pilece', 'pr-caciki', 'sal-paradajz', 'sal-luk', 'pup-da'] },
    { productId: 'coca-cola', qty: 1, options: ['pp-limenka'] }
  ], { mode: 'pickup' }).lines;
  assert.deepEqual(Pricing.bundleHints(index, lines).map((h) => [h.productId, h.saving]), [['akcija-giros-veliki', 50]]);
});

test('shop facts from the notebook', () => {
  assert.equal(setting('address_street'), 'Dimitrija Tucovića 3');
  assert.equal(setting('phone_display'), '064 227 4334');
  assert.equal(setting('job_phone_e164'), '+381638773363');
  assert.match(setting('address_note'), /Karađorđe/);
  assert.match(setting('hours_note'), /godišnjeg odmora/);
  assert.match(setting('second_location'), /Bulevar kralja Petra I 61/);
  for (const h of seed.hours) {
    if (h.dow === 7) assert.equal(h.closed, true, 'Nedelja ne radi');
    else assert.deepEqual([h.open, h.close, h.closed], ['09:00', '01:00', false], h.day);
  }
});
