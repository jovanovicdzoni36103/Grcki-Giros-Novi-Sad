import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const P = require('../../src/scripts/shared/pricing.cjs');
const seed = JSON.parse(readFileSync(new URL('../fixtures/seed.demo.json', import.meta.url), 'utf8'));
const index = P.buildIndex(seed.catalog);
const defaults = (id) => P.defaultOptions(index, index.products[id]);

describe('priceLine', () => {
  test('Klasik with its defaults costs the base price and summarizes the choices', () => {
    const r = P.priceLine(index, { productId: 'klasik', qty: 1, options: defaults('klasik') }, { mode: 'delivery' });
    assert.equal(r.ok, true, JSON.stringify(r.errors));
    assert.equal(r.unitPrice, 620);
    assert.equal(r.summary, 'Pileće · Tzatziki · Paradajz, Ljubičasti luk · Origano');
    assert.equal(r.removedSummary, '');
  });

  test('removing default ingredients produces a kitchen-friendly BEZ line', () => {
    const opts = defaults('klasik').filter((id) => id !== 'sal-luk' && id !== 'pup-da');
    const r = P.priceLine(index, { productId: 'klasik', qty: 2, options: opts });
    assert.equal(r.ok, true);
    assert.equal(r.removedSummary, 'BEZ: ljubičasti luk, pomfrit u piti');
    assert.equal(r.lineTotal, 1240);
  });

  test('paid extras change the unit price', () => {
    const r = P.priceLine(index, { productId: 'klasik', qty: 3, options: [...defaults('klasik'), 'dod-meso'] });
    assert.equal(r.unitPrice, 920);
    assert.equal(r.lineTotal, 2760);
    assert.match(r.summary, /Extra meso \+300/);
  });

  test('required meat: missing or doubled is rejected', () => {
    const none = P.priceLine(index, { productId: 'slozi-svoj', qty: 1, options: defaults('slozi-svoj') });
    assert.equal(none.ok, false);
    assert.match(none.errors[0].message, /meso/i);
    const two = P.priceLine(index, { productId: 'slozi-svoj', qty: 1, options: [...defaults('slozi-svoj'), 'meso-pilece', 'meso-svinjsko'] });
    assert.equal(two.ok, false);
  });

  test('foreign option, unknown product, sold out product, bad quantity', () => {
    assert.equal(P.priceLine(index, { productId: 'coca-cola', qty: 1, options: ['meso-pilece'] }).ok, false);
    assert.equal(P.priceLine(index, { productId: 'ne-postoji', qty: 1, options: [] }).errors[0].code, 'ITEM_UNAVAILABLE');
    const soldOut = P.buildIndex({ ...seed.catalog, products: seed.catalog.products.map((p) => (p.id === 'fanta' ? { ...p, available: false } : p)) });
    assert.equal(P.priceLine(soldOut, { productId: 'fanta', qty: 1 }).errors[0].code, 'ITEM_UNAVAILABLE');
    assert.equal(P.priceLine(index, { productId: 'fanta', qty: 0 }).ok, false);
    assert.equal(P.priceLine(index, { productId: 'fanta', qty: 1.5 }).ok, false);
    assert.equal(P.priceLine(index, { productId: 'fanta', qty: 99 }).ok, false);
  });

  test('bundle with per-giros meat and drink choices', () => {
    const r = P.priceLine(index, { productId: 'giros-duo', qty: 1, options: [...defaults('giros-duo'), 'd1-pilece', 'd2-svinjsko'] });
    assert.equal(r.ok, true, JSON.stringify(r.errors));
    assert.equal(r.unitPrice, 1690);
    assert.match(r.summary, /^Pileće · Svinjsko/);
  });

  test('delivery-only restrictions are enforced per product', () => {
    const noDelivery = P.buildIndex({ ...seed.catalog, products: seed.catalog.products.map((p) => (p.id === 'mix-salata' ? { ...p, delivery: false } : p)) });
    assert.equal(P.priceLine(noDelivery, { productId: 'mix-salata', qty: 1 }, { mode: 'delivery' }).ok, false);
    assert.equal(P.priceLine(noDelivery, { productId: 'mix-salata', qty: 1 }, { mode: 'pickup' }).ok, true);
  });
});

describe('computeCart', () => {
  const lines = [
    { productId: 'klasik', qty: 2, options: defaults('klasik') },
    { productId: 'coca-cola', qty: 1, options: [] }
  ];

  test('delivery with a fixed fee', () => {
    const c = P.computeCart(index, lines, { mode: 'delivery', feeMode: 'fixed', defaultFee: 250 });
    assert.equal(c.ok, true);
    assert.equal(c.subtotal, 1440);
    assert.equal(c.deliveryFee, 250);
    assert.equal(c.total, 1690);
    assert.equal(c.itemCount, 3);
  });

  test('pickup never charges delivery', () => {
    const c = P.computeCart(index, lines, { mode: 'pickup', feeMode: 'fixed', defaultFee: 250 });
    assert.equal(c.deliveryFee, 0);
    assert.equal(c.total, 1440);
  });

  test('zone fee overrides the default; agency mode keeps it out of the total; free threshold', () => {
    assert.equal(P.computeCart(index, lines, { mode: 'delivery', feeMode: 'fixed', defaultFee: 250, zoneFee: 350 }).deliveryFee, 350);
    const agency = P.computeCart(index, lines, { mode: 'delivery', feeMode: 'agency', defaultFee: 250 });
    assert.equal(agency.total, 1440);
    assert.equal(agency.deliveryExternal, true);
    const free = P.computeCart(index, lines, { mode: 'delivery', feeMode: 'fixed', defaultFee: 250, freeThreshold: 1000 });
    assert.equal(free.deliveryFee, 0);
    assert.equal(free.deliveryFree, true);
  });

  test('empty cart and minimum order', () => {
    assert.equal(P.computeCart(index, [], { mode: 'pickup' }).ok, false);
    const min = P.computeCart(index, [{ productId: 'fanta', qty: 1 }], { mode: 'delivery', defaultFee: 250, minOrder: 500 });
    assert.equal(min.ok, false);
    assert.equal(min.minOrderShortfall, 300);
  });
});

describe('recommendations and bundle hints', () => {
  test('giros + drink bought separately suggests the Giros + sok bundle', () => {
    const lines = [
      { productId: 'klasik', unitPrice: 620 },
      { productId: 'coca-cola', unitPrice: 200 }
    ];
    assert.deepEqual(P.bundleHints(index, lines), [{ productId: 'giros-sok', name: 'Giros + sok', saving: 100 }]);
    assert.deepEqual(P.bundleHints(index, [{ productId: 'klasik', unitPrice: 620 }]), []);
  });

  test('pairs exclude what is already in the cart; data recs are merged', () => {
    const recs = P.recommendations(index, ['klasik', 'coca-cola'], { klasik: ['fanta'] }, 3).map((r) => r.productId);
    assert.deepEqual(recs, ['tzatziki-100', 'pomfrit-mali', 'fanta']);
  });

  test('line keys merge identical configurations regardless of option order', () => {
    assert.equal(P.lineKey({ productId: 'klasik', options: ['b', 'a'] }), P.lineKey({ productId: 'klasik', options: ['a', 'b'] }));
    assert.notEqual(P.lineKey({ productId: 'klasik', options: ['a'], note: 'bez soli' }), P.lineKey({ productId: 'klasik', options: ['a'] }));
  });
});
