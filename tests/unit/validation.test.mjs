import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const V = require('../../src/scripts/shared/validation.cjs');
const M = require('../../src/scripts/shared/money.cjs');

describe('phone', () => {
  for (const raw of ['064 227 4334', '0642274334', '+381 64 227 4334', '00381642274334', '381642274334', '64 227 4334', '064/227-4334', '(064) 227 43 34']) {
    test(`accepts ${raw}`, () => {
      const r = V.normalizePhone(raw);
      assert.equal(r.ok, true, raw);
      assert.equal(r.e164, '+381642274334');
      assert.equal(r.display, '064 227 4334');
    });
  }

  test('9-digit mobile and international numbers', () => {
    assert.equal(V.normalizePhone('063 123 456').e164, '+38163123456');
    assert.equal(V.normalizePhone('+36 30 123 4567').kind, 'intl');
  });

  for (const raw of ['', '123', 'abc', '021 456 789', '064 12', '+381 21 456789', '0642274334999', '++381642274334', 'call me']) {
    test(`rejects "${raw}" for orders`, () => {
      assert.equal(V.normalizePhone(raw).ok, false);
    });
  }

  test('landline allowed where it makes sense (contact form)', () => {
    assert.equal(V.normalizePhone('021 456 789', { allowLandline: true }).ok, true);
  });
});

describe('name, email, address', () => {
  test('names', () => {
    assert.equal(V.validateName('Nikola Jovanović').ok, true);
    assert.equal(V.validateName('Đorđe Čolić-Šarić').ok, true);
    assert.equal(V.validateName('Ана').ok, true);
    assert.equal(V.validateName(' ').ok, false);
    assert.equal(V.validateName('A').ok, false);
    assert.equal(V.validateName('<script>').ok, false);
    assert.equal(V.validateName('x'.repeat(61)).ok, false);
  });

  test('email is optional but must be valid when present', () => {
    assert.equal(V.validateEmail('', false).ok, true);
    assert.equal(V.validateEmail('ime@primer.rs').ok, true);
    assert.equal(V.validateEmail('ime@primer').ok, false);
    assert.equal(V.validateEmail('ime primer@x.rs').ok, false);
  });

  test('address needs street and number (bb allowed)', () => {
    assert.equal(V.validateAddress({ street: 'Bulevar oslobođenja', number: '12a' }).ok, true);
    assert.equal(V.validateAddress({ street: 'Futoški put', number: 'bb' }).ok, true);
    assert.equal(V.validateAddress({ street: 'Liman', number: '5/3' }).ok, true);
    const missing = V.validateAddress({ street: '', number: '' });
    assert.deepEqual(Object.keys(missing.errors).sort(), ['number', 'street']);
    assert.equal(V.validateAddress({ street: 'Ulica', number: 'abc' }).ok, false);
  });

  test('order contact: delivery requires address, pickup does not', () => {
    const base = { customer: { name: 'Nikola Jovanović', phone: '0641234567' } };
    assert.equal(V.validateOrderContact({ ...base, mode: 'pickup' }).ok, true);
    const d = V.validateOrderContact({ ...base, mode: 'delivery', address: {} });
    assert.equal(d.ok, false);
    assert.ok(d.errors['address.street']);
    assert.equal(V.validateOrderContact({ ...base }).errors.mode, 'Izaberite dostavu ili preuzimanje.');
  });
});

describe('cash and change', () => {
  test('amount parsing in Serbian notation', () => {
    assert.equal(V.parseAmount('2.000'), 2000);
    assert.equal(V.parseAmount('2 000 RSD'), 2000);
    assert.equal(V.parseAmount('1850'), 1850);
    assert.ok(Number.isNaN(V.parseAmount('dve hiljade')));
  });

  test('cash must cover the total', () => {
    const ok = V.validateCash('2000', 1280, 20000);
    assert.equal(ok.ok, true);
    assert.equal(ok.change, 720);
    assert.equal(V.validateCash(1280, 1280, 20000).change, 0);
    assert.equal(V.validateCash(1000, 1280, 20000).ok, false);
    assert.equal(V.validateCash('', 1280, 20000).ok, false);
    assert.equal(V.validateCash(50000, 1280, 20000).ok, false);
  });

  test('quick suggestions are realistic banknote totals above the bill', () => {
    assert.deepEqual(M.cashSuggestions(1280), [1500, 2000, 5000]);
    assert.deepEqual(M.cashSuggestions(1850), [2000, 5000]);
    assert.deepEqual(M.cashSuggestions(620), [700, 1000, 2000]);
    assert.deepEqual(M.cashSuggestions(3290), [3500, 4000, 5000]);
  });

  test('RSD formatting', () => {
    assert.equal(M.formatRSD(1850), '1.850 RSD');
    assert.equal(M.formatNumber(3842510), '3.842.510');
    assert.equal(M.formatNumber(0), '0');
  });
});

describe('sanitizing', () => {
  test('formula injection is neutralized for Sheets', () => {
    assert.equal(V.sheetSafe('=HYPERLINK("x")'), "'=HYPERLINK(\"x\")");
    assert.equal(V.sheetSafe('+381641234567'), "'+381641234567");
    assert.equal(V.sheetSafe('Bez luka'), 'Bez luka');
  });

  test('html is escaped for emails', () => {
    assert.equal(V.escapeHtml('<b>"x"</b>'), '&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
  });

  test('clean strips control characters and caps length', () => {
    assert.equal(V.clean('  a\u0000b​  c ', 10), 'a b c');
    assert.equal(V.clean('red1\r\nred2\n\n\n\nred3', 100, true), 'red1\nred2\n\nred3');
  });
});
