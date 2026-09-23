// End-to-end tests in a real browser (local Chrome) against the real Apps Script code in the emulator.
//   npm run test:e2e            (builds, starts its own servers on 5191/5192, writes tests/e2e/artifacts/)
// Covers the prompt's flows 65 (delivery), 66 (pickup), 67 (failures) plus closed hours, panel, forms,
// responsive widths, an accessibility audit and a throttled performance check.
import { chromium } from 'playwright-core';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ART = path.join(root, 'tests/e2e/artifacts');
const SHOTS = path.join(ART, 'e2e');
rmSync(SHOTS, { recursive: true, force: true });
mkdirSync(SHOTS, { recursive: true });

const PORT = 5191;
const PERF_PORT = 5192;
const BASE = `http://localhost:${PORT}`;
const NOW = '2026-09-23T14:23:00+02:00';
const q = (now = NOW) => `?__now=${encodeURIComponent(now)}`;

const results = [];
let current = null;

function expect(cond, message) {
  if (!cond) throw new Error(message);
}

async function test(name, fn) {
  const started = Date.now();
  current = { name, ok: false, notes: [], shots: [] };
  try {
    await fn(current);
    current.ok = true;
  } catch (err) {
    current.error = err.message.split('\n')[0];
  }
  current.ms = Date.now() - started;
  results.push(current);
  console.log(`${current.ok ? '✔' : '✘'} ${name}${current.ok ? '' : '  → ' + current.error} (${current.ms} ms)`);
}

function note(text) {
  current.notes.push(text);
}

async function shot(page, name, opts = {}) {
  const file = path.join(SHOTS, `${name}.png`);
  await page.screenshot({ path: file, ...opts });
  current.shots.push(path.relative(ART, file).split(path.sep).join('/'));
}

async function getJSON(url) {
  const res = await fetch(url);
  return res.json();
}

const state = () => getJSON(`${BASE}/__state`);
const setCell = (sheet, key, match, col, value) => getJSON(`${BASE}/__set?sheet=${sheet}&key=${key}&match=${encodeURIComponent(match)}&col=${col}&value=${encodeURIComponent(value)}`);

function startServer(port, extra = []) {
  const child = spawn(process.execPath, [path.join(root, 'tools/dev-server.mjs'), '--port', String(port), '--fresh', ...extra], { cwd: root, stdio: 'ignore' });
  return child;
}

async function waitFor(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* not yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('server did not start: ' + url);
}

// -----------------------------------------------------------------------------
console.log('building (dev + production)…');
execFileSync(process.execPath, [path.join(root, 'tools/build.mjs'), '--dev'], { cwd: root, stdio: 'inherit' });
execFileSync(process.execPath, [path.join(root, 'tools/build.mjs'), '--out', 'dist-prod'], { cwd: root, stdio: 'inherit' });

const server = startServer(PORT);
const perfServer = startServer(PERF_PORT, ['--dist', 'dist-prod']);
process.on('exit', () => {
  server.kill();
  perfServer.kill();
});
await waitFor(BASE + '/');
await waitFor(`http://localhost:${PERF_PORT}/`);

const browser = await chromium.launch({ channel: 'chrome' });
const mobile = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, reducedMotion: 'reduce' };
const desktop = { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' };

async function newPage(opts) {
  const context = await browser.newContext(opts);
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text()) && page.errors.push(m.text()));
  page.on('dialog', (d) => d.accept());
  return page;
}

/** Real people need more than 1.2 s to fill a checkout; the backend rejects faster submits as bots. */
const human = (page) => page.waitForTimeout(1300);

async function openMenu(page, now = NOW) {
  await page.goto(`${BASE}/meni/${q(now)}`);
  await page.waitForSelector('[data-mode-switch] input', { state: 'attached' });
  await page.waitForFunction(() => !!document.querySelector('[data-cat-nav] .chip'));
}

async function addFromSheet(page, productId, actions = async () => {}) {
  await page.click(`[data-open-product="${productId}"]`);
  await page.waitForSelector('.sheet.is-open [data-sheet-add]');
  await actions();
  await page.click('.sheet.is-open [data-sheet-add]');
  await page.waitForSelector('.sheet:not(.is-open)', { state: 'attached' });
}

// -----------------------------------------------------------------------------
// FLOW 1 — delivery on a phone (prompt 65)
// -----------------------------------------------------------------------------
let firstOrder = null;
await test('Tok 1 — dostava na telefonu: giros sa izmenama + piće, ŠTO PRE, 3.000 RSD, kusur', async () => {
  const page = await newPage(mobile);
  await page.goto(`${BASE}/${q()}`);
  await shot(page, '01-home-mobile');
  await page.click('.hero [data-order-cta]');
  await page.waitForURL('**/meni/');
  await openMenu(page);
  expect(await page.isChecked('[data-mode-switch] input[value="delivery"]'), 'Dostava is not preselected while open');
  await addFromSheet(page, 'klasik', async () => {
    await page.click('.sheet label:has(input[value="sal-luk"]) .chip');
    await page.click('.sheet label:has(input[value="dod-meso"]) .chip');
    await page.click('.sheet [data-qty="1"]');
    const price = (await page.textContent('.sheet [data-add-price]')).replace(/\s/g, ' ');
    expect(price === '1.840 RSD', `live price in the sheet is "${price}", expected 1.840 RSD (2 × (620 + 300))`);
    await shot(page, '01-product-sheet');
  });
  await page.click('[data-add="coca-cola"]');
  await page.waitForFunction(() => document.querySelector('[data-cart-count]').textContent === '3');
  await page.click('[data-order-bar-link]');
  await page.waitForSelector('.drawer.is-open .totals');
  const totals = await page.textContent('.drawer .totals');
  expect(/2\.040/.test(totals) && /250/.test(totals) && /2\.290/.test(totals), 'cart totals wrong: ' + totals.replace(/\s+/g, ' '));
  expect((await page.textContent('.drawer')).includes('BEZ: ljubičasti luk'), 'BEZ line missing in cart');
  await shot(page, '01-cart');
  await Promise.all([page.waitForURL('**/porudzbina/'), page.click('.drawer [data-checkout]')]);
  await page.waitForSelector('[data-checkout-form]');
  await page.fill('[name="name"]', 'Nikola Jovanović');
  await page.fill('[name="phone"]', '064 123 4567');
  await page.fill('[name="address.street"]', 'Bulevar oslobođenja');
  await page.fill('[name="address.number"]', '12a');
  await page.fill('[name="address.apt"]', 'stan 4, 2. sprat');
  expect(await page.isChecked('[name="when"][value="asap"]'), 'ŠTO PRE is not the default');
  await page.click('label:has(input[name="cashQuick"][value="custom"]) .chip');
  await page.fill('[name="cashCustom"]', '3000');
  await page.waitForFunction(() => /kusur od\s*710/.test(document.querySelector('[data-cash-result]').textContent.replace(/ /g, ' ')));
  const review = (await page.textContent('[data-review]')).replace(/ /g, ' ');
  expect(review.includes('Bulevar oslobođenja 12a') && review.includes('3.000 RSD') && review.includes('kusur 710 RSD'), 'review sentence incomplete: ' + review);
  note('Rezime pre slanja: ' + review.replace(/\s+/g, ' ').trim());
  await shot(page, '01-checkout', { fullPage: true });
  await human(page);
  await page.click('[data-submit]');
  await page.waitForSelector('.confirm .ticket__number');
  const number = (await page.textContent('.confirm .ticket__number')).replace(/\D/g, '');
  expect(number === '1', 'confirmation number is #' + number);
  const conf = (await page.textContent('.confirm')).replace(/ /g, ' ');
  expect(conf.includes('2.290 RSD') && conf.includes('3.000 RSD') && conf.includes('710 RSD') && conf.includes('Sačuvajte broj porudžbine'), 'confirmation incomplete');
  await shot(page, '01-confirmation', { fullPage: true });
  const s = await state();
  const row = s.sheets.ORDERS[0];
  firstOrder = row;
  expect(row['Order Type'] === 'DELIVERY' && row.Total === 2290 && row['Cash Provided'] === 3000 && row['Change Required'] === 710, 'ORDERS row mismatch');
  expect(/2× Klasik .*Extra meso \+300.*BEZ: ljubičasti luk/.test(row['Order Items']), 'items text: ' + row['Order Items']);
  expect(/^GG-20260923-1-[0-9A-F]{4}$/.test(row['Internal Order ID']), 'internal id ' + row['Internal Order ID']);
  expect(s.sheets.ORDER_ITEMS.length === 2 && s.sheets.CUSTOMERS.length === 1, 'ORDER_ITEMS/CUSTOMERS not written');
  note(`Sheets: ${row['Internal Order ID']} · ${row.Total} RSD · plaća ${row['Cash Provided']} · kusur ${row['Change Required']} · email ${row['Email Status']}`);
  expect(page.errors.length === 0, 'console errors: ' + page.errors.join(' | '));
  const mail = await newPage({ viewport: { width: 390, height: 900 } });
  await mail.goto(`${BASE}/__outbox/0`);
  expect((await mail.title()).startsWith('#1 · DOSTAVA · ŠTO PRE · 2.290 RSD'), 'ticket subject: ' + (await mail.title()));
  await shot(mail, '01-email-kitchen-ticket', { fullPage: true });
});

// -----------------------------------------------------------------------------
// FLOW 2 — pickup on desktop with a scheduled time (prompt 66)
// -----------------------------------------------------------------------------
await test('Tok 2 — preuzimanje na desktopu: paket sa obaveznim mesom, termin 15:30, bez dostave i kusura', async () => {
  const page = await newPage(desktop);
  await openMenu(page);
  await page.click('label[for="menu-mode-pickup"]');
  await page.waitForFunction(() => /Spremno za/.test(document.querySelector('[data-mode-info]').textContent));
  await page.click('[data-open-product="giros-sok"]');
  await page.waitForSelector('.sheet.is-open [data-sheet-add]');
  const label = await page.textContent('.sheet [data-add-label]');
  expect(/meso/i.test(label), 'required meat not signalled on the button: ' + label);
  await page.click('.sheet [data-sheet-add]');
  expect(await page.$('.sheet.is-open'), 'sheet closed although meat is missing');
  await page.click('.sheet label[for="o-meso-svinjsko"]');
  await shot(page, '02-bundle-sheet');
  await page.click('.sheet [data-sheet-add]');
  await page.waitForSelector('.sheet:not(.is-open)', { state: 'attached' });
  await page.click('[data-add="pomfrit-mali"]');
  await page.click('.site-header [data-cart-open]');
  await page.waitForSelector('.drawer.is-open');
  const totals = await page.textContent('.drawer .totals');
  expect(/Preuzimanje u lokalu/.test(totals) && /950/.test(totals), 'pickup totals: ' + totals.replace(/\s+/g, ' '));
  await Promise.all([page.waitForURL('**/porudzbina/'), page.click('.drawer [data-checkout]')]);
  await page.waitForSelector('[data-checkout-form]');
  await page.click('label:has(input[name="when"][value="15:30"]) .chip');
  await page.fill('[name="name"]', 'Jelena Petrović');
  await page.fill('[name="phone"]', '+381 63 555 1234');
  expect(!(await page.$('[name="cashQuick"]')), 'pickup must not ask for cash amount');
  expect(await page.isHidden('[data-delivery-only]'), 'address section visible for pickup');
  await shot(page, '02-checkout-pickup', { fullPage: true });
  await human(page);
  await page.click('[data-submit]');
  await page.waitForSelector('.confirm .ticket__number');
  const conf = await page.textContent('.confirm');
  expect(/#?\s*2/.test(await page.textContent('.confirm .ticket__number')) && conf.includes('Zakazano za 15:30') && conf.includes('Preuzimanje u lokalu'), 'pickup confirmation');
  await shot(page, '02-confirmation-pickup', { fullPage: true });
  const row = (await state()).sheets.ORDERS[1];
  expect(row['Order Type'] === 'PICKUP' && row['Requested Time'] === '15:30' && row['Delivery Cost'] === 0 && row.Total === 950 && row['Cash Provided'] === '', 'pickup row mismatch');
  note(`Sheets: ${row['Internal Order ID']} · PICKUP · ${row['Requested Time']} · ${row.Total} RSD`);
});

await test('Tok 2b — velika korpa na malom telefonu (375×667): lista skroluje, dugme za poručivanje ostaje dostupno', async () => {
  const page = await newPage({ ...mobile, viewport: { width: 375, height: 667 } });
  await openMenu(page);
  for (const id of ['coca-cola', 'fanta', 'sprite', 'voda', 'gazirana', 'pomfrit-mali', 'pomfrit-veliki', 'mix-salata', 'kupus-salata', 'tzatziki-100', 'urnebes-100', 'extra-pita']) {
    await page.click(`[data-add="${id}"]`);
  }
  await page.click('[data-order-bar-link]');
  await page.waitForSelector('.drawer.is-open [data-checkout]');
  const box = await page.locator('.drawer [data-checkout]').boundingBox();
  expect(box && box.y + box.height <= 667, `checkout button off screen (bottom at ${box && Math.round(box.y + box.height)} px)`);
  const scrolls = await page.$eval('.drawer .overlay__body', (b) => b.scrollHeight > b.clientHeight);
  expect(scrolls, 'cart body does not scroll');
  await shot(page, '02b-long-cart-375');
  const desk = await newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  await openMenu(desk);
  for (const id of ['coca-cola', 'fanta', 'sprite', 'voda', 'gazirana', 'pomfrit-mali', 'pomfrit-veliki', 'mix-salata', 'kupus-salata', 'tzatziki-100', 'urnebes-100', 'extra-pita']) {
    await desk.click(`[data-add="${id}"]`);
  }
  await desk.click('.site-header [data-cart-open]');
  await desk.waitForSelector('.drawer.is-open [data-checkout]');
  const dbox = await desk.locator('.drawer [data-checkout]').boundingBox();
  expect(dbox && dbox.y + dbox.height <= 720, `desktop checkout button off screen (bottom at ${dbox && Math.round(dbox.y + dbox.height)} px)`);
  note('12 stavki na 375×667 i 1280×720: lista skroluje, „Nastavi na porudžbinu“ vidljivo na dnu');
});

// -----------------------------------------------------------------------------
// FLOW 3 — validation (prompt 43 / 67)
// -----------------------------------------------------------------------------
await test('Tok 3 — validacija: prazno ime, loš telefon, bez adrese, nedovoljno gotovine', async () => {
  const page = await newPage(mobile);
  await openMenu(page);
  await page.click('[data-add="coca-cola"]');
  await page.goto(`${BASE}/porudzbina/`);
  await page.waitForSelector('[data-checkout-form]');
  const before = (await state()).sheets.ORDERS.length;
  await page.click('[data-submit]');
  const errs = await page.$$eval('.field.has-error', (els) => els.map((e) => e.dataset.field));
  expect(['name', 'phone', 'address.street', 'address.number', 'cash'].every((f) => errs.includes(f)), 'missing errors: ' + errs.join(','));
  const focused = await page.evaluate(() => document.activeElement.name);
  expect(focused === 'name', 'focus did not move to the first error: ' + focused);
  await shot(page, '03-validation-errors', { fullPage: true });
  await page.fill('[name="name"]', 'A');
  await page.fill('[name="phone"]', '123');
  await page.fill('[name="address.street"]', 'Futoška');
  await page.fill('[name="address.number"]', 'bb');
  await page.click('label:has(input[name="cashQuick"][value="custom"]) .chip');
  await page.fill('[name="cashCustom"]', '300');
  expect(/najmanje 450/.test((await page.textContent('[data-cash-result]')).replace(/\D+/g, (m) => (m.includes(' ') || m.includes('.') ? m : m))) || /najmanje/.test(await page.textContent('[data-cash-result]')), 'cash error not live');
  await page.click('[data-submit]');
  const phoneErr = await page.textContent('[data-field="phone"] .field__error');
  expect(/mobilnog telefona/.test(phoneErr), 'phone error: ' + phoneErr);
  expect((await state()).sheets.ORDERS.length === before, 'an invalid order reached the backend');
  note('Greške: ' + errs.join(', ') + ' · fokus na prvom polju · ništa nije poslato serveru');
});

// -----------------------------------------------------------------------------
// FLOW 4 — closed hours (prompt 17 / 57)
// -----------------------------------------------------------------------------
await test('Tok 4 — zatvoreno (nedelja 12:00), posle ponoći, dostava gotova a preuzimanje radi (23:50)', async () => {
  const page = await newPage(mobile);
  await page.goto(`${BASE}/${q('2026-09-27T12:00:00+02:00')}`);
  await page.waitForFunction(() => /Otvaramo/.test(document.querySelector('.hero [data-order-cta]').textContent));
  const cta = await page.textContent('.hero [data-order-cta]');
  expect(/Otvaramo sutra u 09:00/.test(cta), 'hero CTA while closed: ' + cta);
  await openMenu(page, '2026-09-27T12:00:00+02:00');
  await page.waitForSelector('[data-closed-notice]:not([hidden])');
  const notice = await page.textContent('[data-closed-notice]');
  expect(/Trenutno ne radimo/.test(notice) && /sutra u 09:00/.test(notice), 'closed notice: ' + notice);
  await page.click('[data-open-product="klasik"]');
  await page.waitForSelector('.sheet.is-open');
  expect(await page.isDisabled('.sheet [data-sheet-add]'), 'add button enabled while closed');
  await shot(page, '04-closed-sunday');
  await page.keyboard.press('Escape');
  // 23:50: delivery stopped at 23:45, pickup runs until 00:45 — the menu picks pickup on its own.
  const late = await newPage(mobile);
  await openMenu(late, '2026-09-23T23:50:00+02:00');
  await late.waitForFunction(() => /poručivanje do 00:45/.test(document.querySelector('[data-mode-info]').textContent));
  expect(await late.isChecked('[data-mode-switch] input[value="pickup"]'), 'pickup was not selected automatically after delivery hours');
  const deliveryMeta = await late.textContent('[data-mode-meta="delivery"]');
  expect(/sutra 10:00/.test(deliveryMeta), 'delivery meta after hours: ' + deliveryMeta);
  await late.click('label[for="menu-mode-delivery"]');
  await late.waitForFunction(() => /Dostava ne radi/.test(document.querySelector('[data-mode-info]').textContent) && /Preuzimanje radi/.test(document.querySelector('[data-mode-info]').textContent));
  await shot(late, '04-late-delivery-closed');
  note('Nedelja: CTA „Otvaramo sutra u 09:00“ · 23:50: meni sam bira preuzimanje (do 00:45), dostava piše „od sutra 10:00“');
});

// -----------------------------------------------------------------------------
// FLOW 5 — failures (prompt 67)
// -----------------------------------------------------------------------------
async function checkoutWith(page, product = 'coca-cola') {
  await openMenu(page);
  await page.click(`[data-add="${product}"]`);
  await page.goto(`${BASE}/porudzbina/`);
  await page.waitForSelector('[data-checkout-form]');
  await page.click('label[for="mode-pickup"]');
  await page.fill('[name="name"]', 'Marko Ilić');
  await page.fill('[name="phone"]', '062 111 22' + String(Math.floor(Math.random() * 90) + 10));
  await human(page);
}

await test('Tok 5a — pad Google Sheets-a: korisnička poruka sa telefonom, greška u ERROR_LOG, bezbedan ponovni pokušaj', async () => {
  const page = await newPage(desktop);
  await checkoutWith(page);
  const before = (await state()).sheets.ORDERS.length;
  let first = true;
  await page.route('**/api?**', (route) => {
    if (route.request().method() === 'POST' && first) {
      first = false;
      return route.continue({ url: route.request().url() + '&__fail=sheets' });
    }
    return route.continue();
  });
  await page.click('[data-submit]');
  await page.waitForSelector('[data-submit-error]:not([hidden])');
  const msg = await page.textContent('[data-submit-error]');
  expect(msg.includes('Porudžbina trenutno nije mogla da bude poslata') && msg.includes('064 227 4334'), 'error text: ' + msg);
  await shot(page, '05-sheets-failure');
  const s = await state();
  expect(s.sheets.ERROR_LOG.some((e) => /Spreadsheets failed/.test(e.Error)), 'no ERROR_LOG entry');
  await page.click('[data-retry]');
  await page.waitForSelector('.confirm .ticket__number');
  expect((await state()).sheets.ORDERS.length === before + 1, 'retry did not create exactly one order');
  note('Poruka: ' + msg.replace(/\s+/g, ' ').trim().slice(0, 140));
});

await test('Tok 5b — prekid mreže pri slanju: automatski ponovni pokušaj sa istim requestId, jedna porudžbina', async () => {
  const page = await newPage(mobile);
  await checkoutWith(page);
  const before = (await state()).sheets.ORDERS.length;
  let aborted = false;
  await page.route('**/api?**', (route) => {
    if (route.request().method() === 'POST' && !aborted) {
      aborted = true;
      return route.abort('connectionreset');
    }
    return route.continue();
  });
  await page.click('[data-submit]');
  await page.waitForSelector('.confirm .ticket__number', { timeout: 20000 });
  expect((await state()).sheets.ORDERS.length === before + 1, 'network retry duplicated or lost the order');
});

await test('Tok 5c — dupli klik na „Naruči“: samo jedna porudžbina', async () => {
  const page = await newPage(mobile);
  await checkoutWith(page);
  const before = (await state()).sheets.ORDERS.length;
  await page.dblclick('[data-submit]');
  await page.click('[data-submit]', { force: true, timeout: 1500 }).catch(() => {});
  await page.waitForSelector('.confirm .ticket__number');
  await page.waitForTimeout(800);
  expect((await state()).sheets.ORDERS.length === before + 1, 'double submit created more than one order');
});

await test('Tok 5d — cena promenjena u Sheets-u dok je gost u korpi: jasna poruka, nov iznos, uspeh posle potvrde', async () => {
  const page = await newPage(desktop);
  await checkoutWith(page);
  await setCell('PRODUCTS', 'id', 'coca-cola', 'price', '230');
  await page.click('[data-submit]');
  await page.waitForSelector('[data-submit-error]:not([hidden])');
  const msg = await page.textContent('[data-submit-error]');
  expect(/Cene su se u međuvremenu promenile/.test(msg), 'price change message: ' + msg);
  await page.waitForFunction(() => /230/.test(document.querySelector('[data-submit-total]').textContent));
  await page.click('[data-submit]');
  await page.waitForSelector('.confirm .ticket__number');
  await setCell('PRODUCTS', 'id', 'coca-cola', 'price', '200');
  note('Poruka: ' + msg.replace(/\s+/g, ' ').trim());
});

await test('Tok 5e — proizvod rasprodat pre slanja i neočekivana greška servera', async () => {
  const page = await newPage(mobile);
  await checkoutWith(page, 'fanta');
  await setCell('PRODUCTS', 'id', 'fanta', 'available', 'FALSE');
  await page.click('[data-submit]');
  await page.waitForSelector('[data-submit-error]:not([hidden])');
  const msg = await page.textContent('[data-submit-error]');
  expect(/Trenutno nema: Fanta/.test(msg), 'sold-out message: ' + msg);
  await setCell('PRODUCTS', 'id', 'fanta', 'available', 'TRUE');
  const res = await getJSON(`${BASE}/api?action=bootstrap&__fail=exception`);
  expect(res.ok === false && res.error.code === 'SERVER_ERROR' && !/Spreadsheet|Exception|stack/i.test(res.error.message), 'server error leaks internals: ' + JSON.stringify(res.error));
  const bad = await (await fetch(`${BASE}/api`, { method: 'POST', body: '{"action":"order.create","payload":' })).json();
  expect(bad.error.code === 'BAD_REQUEST' && bad.error.message === 'Zahtev nije ispravan.', 'malformed request');
  note(`Rasprodato: ${msg.replace(/\s+/g, ' ').trim()} · serverska greška: „${res.error.message}“`);
});

// -----------------------------------------------------------------------------
// FLOW 6 — order status link + shop panel
// -----------------------------------------------------------------------------
await test('Tok 6 — panel lokala: PIN, prihvatanje porudžbine, status kod gosta, rasprodato, pauza', async () => {
  const page = await newPage({ viewport: { width: 1180, height: 820 }, reducedMotion: 'reduce' });
  await page.goto(`${BASE}/panel/`);
  await page.fill('#pin', '000000');
  await page.click('.pin__pad .is-ok');
  await page.waitForFunction(() => /Pogrešan PIN/.test(document.querySelector('.pin__error').textContent));
  await page.fill('#pin', '123456');
  await page.click('.pin__pad .is-ok');
  await page.waitForSelector('.pcard');
  await shot(page, '06-panel-board');
  const card = page.locator('.pcard', { hasText: '#1' }).first();
  await card.locator('[data-status="ACCEPTED"]').click();
  await page.waitForFunction(() => [...document.querySelectorAll('[data-col="work"] .pcard__num')].some((n) => n.textContent === '#1'));
  const s = await state();
  const row = s.sheets.ORDERS.find((r) => r['Public Order Number'] === 1);
  expect(row.Status === 'ACCEPTED' && row['Accepted At'], 'status not saved');
  const guest = await newPage(mobile);
  await guest.goto(`${BASE}/porudzbina/?id=${encodeURIComponent(row['Internal Order ID'])}&t=${row['Status Token']}`);
  await guest.waitForFunction(() => /Potvrđena/.test(document.querySelector('[data-tracker]')?.textContent || ''));
  await shot(guest, '06-guest-status-link');
  await page.click('[data-open-products]');
  await page.locator('.pl__row', { hasText: 'Pomfrit mali' }).locator('input').uncheck();
  await page.waitForTimeout(400);
  const menu = await newPage(mobile);
  await openMenu(menu);
  expect(await menu.locator('[data-product="pomfrit-mali"]').evaluate((n) => n.classList.contains('is-unavailable')), 'sold-out not visible on the menu');
  await page.click('[data-close-products]');
  await page.click('.pbar__switch');
  await page.waitForTimeout(400);
  const paused = await newPage(mobile);
  await openMenu(paused);
  await paused.waitForSelector('[data-closed-notice]:not([hidden])');
  await page.click('.pbar__switch');
  await page.locator('.pl__row', { hasText: 'Pomfrit mali' }).locator('input').check({ force: true }).catch(() => {});
  await setCell('PRODUCTS', 'id', 'pomfrit-mali', 'available', 'TRUE');
  note('PIN (pogrešan → odbijen), #1 NEW → ACCEPTED, gost vidi „Potvrđena“, rasprodato i pauza stižu na meni');
});

// -----------------------------------------------------------------------------
// FLOW 7 — contact + job application
// -----------------------------------------------------------------------------
await test('Tok 7 — kontakt forma i prijava za posao sa CV-jem', async () => {
  const page = await newPage(mobile);
  await page.goto(`${BASE}/kontakt/`);
  await page.click('[data-contact-form] [type="submit"]');
  expect(await page.$('[data-field="message"].has-error'), 'contact validation');
  await page.fill('#c-name', 'Ana Marković');
  await page.fill('#c-email', 'ana@example.com');
  await page.fill('#c-message', 'Da li radite za Novu godinu?');
  await page.waitForTimeout(2600);
  await page.click('[data-contact-form] [type="submit"]');
  await page.waitForSelector('.form-success');
  await page.goto(`${BASE}/posao/`);
  await page.fill('#j-name', 'Stefan Nikolić');
  await page.fill('#j-phone', '065 222 3344');
  await page.setInputFiles('[name="cv"]', { name: 'cv.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF') });
  await page.waitForTimeout(2600);
  await page.click('[data-job-form] [type="submit"]');
  await page.waitForSelector('.form-success');
  await shot(page, '07-job-success');
  const s = await state();
  expect(s.sheets.CONTACT.length === 1 && s.sheets.JOBS.length === 1 && /drive\.google\.com/.test(s.sheets.JOBS[0].CV), 'forms not stored');
});

// -----------------------------------------------------------------------------
// FLOW 8 — responsive + accessibility audit on every page
// -----------------------------------------------------------------------------
const PAGES = ['/', '/meni/', '/porudzbina/', '/o-nama/', '/dostava/', '/kontakt/', '/posao/', '/privatnost/', '/404.html'];
const WIDTHS = [375, 390, 430, 768, 1024, 1440, 1920];
await test('Tok 8 — responsive 375–1920 px i audit pristupačnosti (svih 9 stranica × 7 širina)', async () => {
  const problems = [];
  for (const width of WIDTHS) {
    const page = await newPage({ viewport: { width, height: width < 700 ? 844 : 900 }, isMobile: width < 700, hasTouch: width < 700, reducedMotion: 'reduce' });
    for (const p of PAGES) {
      await page.goto(BASE + p);
      await page.waitForTimeout(250);
      const audit = await page.evaluate(() => {
        const out = [];
        const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
        if (overflow > 0) out.push(`overflow ${overflow}px`);
        if (document.querySelectorAll('h1').length !== 1) out.push(`${document.querySelectorAll('h1').length} h1`);
        if (!document.documentElement.lang) out.push('no lang');
        if (!document.querySelector('main')) out.push('no main');
        document.querySelectorAll('img').forEach((i) => !i.hasAttribute('alt') && out.push('img without alt'));
        document.querySelectorAll('button, a[href]').forEach((b) => {
          const name = (b.getAttribute('aria-label') || b.textContent || '').trim();
          if (!name && b.offsetParent !== null) out.push(`unnamed ${b.tagName.toLowerCase()} ${b.className}`);
        });
        document.querySelectorAll('input:not([type=hidden]), select, textarea').forEach((f) => {
          if (f.closest('.hp')) return;
          const labelled = f.labels?.length || f.getAttribute('aria-label') || f.getAttribute('aria-labelledby');
          if (!labelled) out.push(`unlabelled ${f.name || f.id}`);
        });
        return out;
      });
      if (audit.length) problems.push(`${p} @${width}: ${audit.join('; ')}`);
      if (p === '/' || p === '/meni/' || p === '/porudzbina/') await shot(page, `08-${(p.replace(/\W+/g, '') || 'home')}-${width}`);
    }
    if (page.errors.length) problems.push(`@${width} console: ${page.errors.join(' | ')}`);
    await page.context().close();
  }
  note(problems.length ? problems.join('\n') : `0 problema na ${PAGES.length * WIDTHS.length} kombinacija stranica × širina`);
  expect(problems.length === 0, problems.slice(0, 6).join(' || '));
});

await test('Tok 8b — tastatura: skip link, fokus u sheet-u, Escape zatvara, fokus se vraća', async () => {
  const page = await newPage(desktop);
  await openMenu(page);
  await page.keyboard.press('Tab');
  expect((await page.evaluate(() => document.activeElement.className)).includes('skip-link'), 'first Tab is not the skip link');
  await page.focus('[data-open-product="ljutko"]');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.sheet.is-open');
  const inside = await page.waitForFunction(() => !!document.activeElement.closest('.sheet'), null, { timeout: 2000 }).then(() => true, () => false);
  expect(inside, 'focus not moved into the dialog');
  for (let i = 0; i < 40; i++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement.closest('.sheet')), 'focus escaped the dialog (no trap)');
  await page.keyboard.press('Escape');
  await page.waitForSelector('.sheet:not(.is-open)', { state: 'attached' });
  expect(await page.evaluate(() => document.activeElement.dataset.openProduct === 'ljutko'), 'focus not restored to the opener');
});

// -----------------------------------------------------------------------------
// FLOW 9 — performance on the production build (throttled phone)
// -----------------------------------------------------------------------------
await test('Tok 9 — performanse produkcionog builda: telefon, Fast 4G, CPU 4× sporiji', async () => {
  const lines = [];
  for (const p of ['/', '/meni/']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.addInitScript(() => {
      window.__lcp = 0;
      new PerformanceObserver((l) => l.getEntries().forEach((e) => (window.__lcp = e.startTime))).observe({ type: 'largest-contentful-paint', buffered: true });
      window.__cls = 0;
      new PerformanceObserver((l) => l.getEntries().forEach((e) => !e.hadRecentInput && (window.__cls += e.value))).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto(`http://localhost:${PERF_PORT}${p}`, { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    const m = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const fcp = performance.getEntriesByName('first-contentful-paint')[0];
      const res = performance.getEntriesByType('resource');
      const bytes = res.reduce((n, r) => n + (r.transferSize || 0), 0) + (nav.transferSize || 0);
      return { fcp: Math.round(fcp ? fcp.startTime : 0), lcp: Math.round(window.__lcp), cls: +window.__cls.toFixed(3), load: Math.round(nav.loadEventEnd), kb: Math.round(bytes / 1024), requests: res.length + 1 };
    });
    lines.push(`${p}: FCP ${m.fcp} ms · LCP ${m.lcp} ms · CLS ${m.cls} · load ${m.load} ms · ${m.kb} KB · ${m.requests} zahteva`);
    expect(m.lcp < 2500, `${p} LCP ${m.lcp} ms ≥ 2500 ms`);
    expect(m.cls < 0.1, `${p} CLS ${m.cls}`);
    await context.close();
  }
  lines.forEach(note);
});

await browser.close();

// -----------------------------------------------------------------------------
const passed = results.filter((r) => r.ok).length;
writeFileSync(path.join(ART, 'e2e-report.json'), JSON.stringify({ at: new Date().toISOString(), passed, total: results.length, results }, null, 2));
const md = [
  `# E2E izveštaj — ${new Date().toISOString()}`,
  '',
  `**${passed}/${results.length} prošlo.** Pravi Chrome, pravi Apps Script kod u emulatoru, lokalni server.`,
  '',
  ...results.flatMap((r) => [`## ${r.ok ? '✔' : '✘'} ${r.name}`, r.error ? `Greška: ${r.error}` : '', ...r.notes.map((n) => `- ${n}`), ...r.shots.map((s) => `- ![](${s})`), ''])
].join('\n');
writeFileSync(path.join(ART, 'e2e-report.md'), md);
console.log(`\n${passed}/${results.length} passed · report: tests/e2e/artifacts/e2e-report.md`);
server.kill();
perfServer.kill();
process.exit(passed === results.length ? 0 : 1);
