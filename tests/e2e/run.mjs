// End-to-end tests in a real browser (local Chrome) against the real Apps Script code in the emulator.
//   npm run test:e2e            (builds, starts its own servers on 5191/5192, writes tests/e2e/artifacts/)
// Guest: menu → per-piece options → cart → zone/minimum → ASAP or a slot up to 7 days ahead → cash → status → feedback.
// Shop: /admin/ login, new-order alert (banner + sound + 5-minute deadline), accept/reject, statuses, history,
// menu/prices/photos/add-ons/categories, zones, hours with a break, pauses, estimates, feedback.
// Plus failures, forms, responsive widths, an accessibility audit, keyboard and a throttled performance check.
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
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mP8z8Dwn4EIwDiqkL4KAcT9BfsR6vU9AAAAAElFTkSuQmCC', 'base64');

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
    // Playwright explains waits in the following lines (which element intercepts a click, etc.).
    current.detail = err.message.split('\n').slice(1, 10).join(' | ');
    if (current.detail) console.log('   ' + current.detail);
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

async function getJSON(url, init) {
  const res = await fetch(url, init);
  return res.json();
}

const state = () => getJSON(`${BASE}/__state`);
const setCell = (sheet, key, match, col, value) => getJSON(`${BASE}/__set?sheet=${sheet}&key=${key}&match=${encodeURIComponent(match)}&col=${col}&value=${encodeURIComponent(value)}`);
const lastOrder = async () => (await state()).sheets.ORDERS.at(-1);
const nbsp = (s) => String(s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

function startServer(port, extra = []) {
  return spawn(process.execPath, [path.join(root, 'tools/dev-server.mjs'), '--port', String(port), '--fresh', ...extra], { cwd: root, stdio: 'ignore' });
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
const tablet = { viewport: { width: 1024, height: 768 }, hasTouch: true, reducedMotion: 'reduce' };
const desktop = { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' };

async function newPage(opts) {
  const context = await browser.newContext(opts);
  const page = await context.newPage();
  page.errors = [];
  page.badRequests = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text()) && page.errors.push(m.text()));
  // Network audit: a page, script, style, font, image or icon sprite that fails to load (the API is judged by each flow).
  page.on('response', (r) => r.status() >= 400 && !/\/api(\?|$)|\/__/.test(r.url()) && page.badRequests.push(`${r.status()} ${r.url().replace(BASE, '')}`));
  page.on('requestfailed', (r) => !/\/api(\?|$)|\/__/.test(r.url()) && !/ERR_ABORTED/.test(r.failure()?.errorText || '') && page.badRequests.push(`failed ${r.url().replace(BASE, '')}`));
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

async function openSheet(page, productId) {
  await page.click(`[data-open-product="${productId}"]`);
  await page.waitForSelector('.sheet.is-open [data-sheet-add]');
}

async function addFromSheet(page, productId, actions = async () => {}) {
  await openSheet(page, productId);
  await actions();
  await page.click('.sheet.is-open [data-sheet-add]');
  await page.waitForSelector('.sheet:not(.is-open)', { state: 'attached' });
}

async function toCheckout(page) {
  await Promise.all([page.waitForURL('**/porudzbina/**'), page.click('.drawer [data-checkout]')]);
  await page.waitForSelector('[data-checkout-form]');
}

async function adminLogin(page, now = NOW) {
  await page.goto(`${BASE}/admin/${q(now)}`);
  await page.waitForSelector('#pin');
  await page.fill('#pin', '123456');
  await page.click('.pin__pad .is-ok');
  await page.waitForSelector('[data-view]');
  await page.waitForFunction(() => /Povezano/.test(document.querySelector('[data-conn]').textContent));
}

async function adminView(page, id) {
  await page.click(`[data-view-link="${id}"]`);
  await page.waitForFunction((v) => location.hash === '#' + v && !document.querySelector('[data-view] .admin__loading'), id);
}

/** Places an order straight through the API (as a second guest would), bypassing the UI. */
async function apiOrder(overrides = {}, now = NOW) {
  const body = {
    requestId: 'e2e' + Math.random().toString(36).slice(2, 12),
    mode: 'pickup',
    when: 'asap',
    customer: { name: 'Petar Petrović', phone: '06' + String(10000000 + Math.floor(Math.random() * 8999999)), email: '' },
    address: {},
    note: '',
    items: [{ productId: 'pomfrit-mali', qty: 1, options: [] }],
    clientTotal: 230,
    meta: { elapsedMs: 30000, channel: 'e2e', hp: '' },
    ...overrides
  };
  return getJSON(`${BASE}/api${q(now)}`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action: 'order.create', payload: body }) });
}

function statusLink(row, now = NOW) {
  return `${BASE}/porudzbina/?id=${encodeURIComponent(row['Internal Order ID'])}&t=${row['Status Token']}&__now=${encodeURIComponent(now)}`;
}

// -----------------------------------------------------------------------------
// FLOW 1 — delivery on a phone: two differently built Klasik + a drink, zone, ASAP, cash
// -----------------------------------------------------------------------------
await test('Tok 1 — dostava na telefonu: 2× Klasik različito složena + piće, zona, ŠTO PRE, 3.000 RSD, kusur', async () => {
  const page = await newPage(mobile);
  await page.goto(`${BASE}/${q()}`);
  await shot(page, '01-home-mobile');
  await page.click('.hero [data-order-cta]');
  await page.waitForURL('**/meni/');
  await openMenu(page);
  expect(await page.isChecked('[data-mode-switch] input[value="delivery"]'), 'Dostava is not preselected while open');
  const info = nbsp(await page.textContent('[data-mode-info]'));
  expect(/Dostava za 45–60 min/.test(info) && /7 dana unapred/.test(info), 'mode bar estimate: ' + info);
  await addFromSheet(page, 'klasik', async () => {
    await page.click('.sheet label:has(input[value="sal-luk"]) .chip');
    await page.click('.sheet [data-qty="1"]');
    await page.waitForSelector('.sheet [data-piece="1"][aria-selected="true"]');
    const summary1 = await page.textContent('.sheet [data-piece="0"] small');
    expect(/bez ljubičasti luk/.test(summary1), 'piece 1 summary: ' + summary1);
    const piece2Onion = await page.isChecked('.sheet input[value="sal-luk"]');
    expect(piece2Onion, 'piece 2 did not start from the defaults (onion should be on)');
    await page.click('.sheet label:has(input[value="dod-meso"]) .chip');
    const price = nbsp(await page.textContent('.sheet [data-add-price]'));
    expect(price === '1.540 RSD', `live price is "${price}", expected 1.540 RSD (620 + 920)`);
    await shot(page, '01-product-sheet-pieces');
  });
  await page.click('[data-add="coca-cola"]');
  await page.waitForFunction(() => document.querySelector('[data-cart-count]').textContent === '3');
  await page.click('[data-order-bar-link]');
  await page.waitForSelector('.drawer.is-open .totals');
  const before = nbsp(await page.textContent('.drawer .totals'));
  expect(/izaberite naselje/.test(before) && /1\.740 RSD \+ dostava/i.test(before), 'total before zone: ' + before);
  expect((await page.$$('.drawer .cart-line')).length === 3, 'two Klasik pieces must be two cart lines');
  await page.selectOption('#drawer-zone', { label: 'Centar' });
  await page.waitForFunction(() => /1\.990/.test(document.querySelector('.drawer .totals').textContent));
  const totals = nbsp(await page.textContent('.drawer .totals'));
  expect(/1\.740/.test(totals) && /250/.test(totals) && /1\.990/.test(totals), 'cart totals: ' + totals);
  expect(nbsp(await page.textContent('.drawer')).includes('BEZ: ljubičasti luk'), 'BEZ line missing in cart');
  await shot(page, '01-cart');
  await toCheckout(page);
  expect((await page.inputValue('[name="address.zone"]')) === 'ns-grad', 'zone not carried to checkout');
  await page.fill('[name="name"]', 'Nikola Jovanović');
  await page.fill('[name="phone"]', '064 123 4567');
  await page.fill('[name="email"]', 'nikola@example.com');
  await page.fill('[name="address.street"]', 'Bulevar oslobođenja');
  await page.fill('[name="address.number"]', '12a');
  await page.fill('[name="address.apt"]', '4');
  await page.fill('[name="address.floor"]', '2');
  await page.fill('[name="note"]', 'Pozovite kada stignete.');
  expect(await page.isChecked('[name="timing"][value="asap"]'), 'ŠTO PRE is not the default');
  await page.click('label:has(input[name="cashQuick"][value="custom"]) .chip');
  await page.fill('[name="cashCustom"]', '3000');
  await page.waitForFunction(() => /kusur od\s*1\.010/.test(document.querySelector('[data-cash-result]').textContent.replace(/ /g, ' ')));
  const review = nbsp(await page.textContent('[data-review]'));
  expect(review.includes('Bulevar oslobođenja 12a, stan 4, 2. sprat') && review.includes('stiže za 45–60 min') && review.includes('kusur 1.010 RSD'), 'review sentence: ' + review);
  note('Rezime pre slanja: ' + review);
  await shot(page, '01-checkout', { fullPage: true });
  await human(page);
  await page.click('[data-submit]');
  await page.waitForSelector('.confirm .ticket__number');
  const number = (await page.textContent('.confirm .ticket__number')).replace(/\D/g, '');
  expect(number === '1001', 'confirmation number is #' + number);
  const conf = nbsp(await page.textContent('.confirm'));
  expect(conf.includes('čeka potvrdu') && conf.includes('1.990 RSD') && conf.includes('3.000 RSD') && conf.includes('1.010 RSD'), 'confirmation: ' + conf.slice(0, 200));
  expect(/● Primljena ○ Potvrđena/.test(conf), 'tracker does not show "received, waiting": ' + conf);
  await shot(page, '01-confirmation', { fullPage: true });
  const s = await state();
  const row = s.sheets.ORDERS[0];
  expect(row.Status === 'NEW' && row['Order Type'] === 'DELIVERY' && row.Total === 1990 && row['Cash Provided'] === 3000 && row['Change Required'] === 1010, 'ORDERS row mismatch');
  expect(row.Apartment === '4' && row.Floor === '2' && row.Zone === 'Novi Sad — grad' && row['Accept By'] === '2026-09-23T14:28:00+02:00', 'address/zone/deadline columns');
  expect(/^GG-20260923-1001-[0-9A-F]{4}$/.test(row['Internal Order ID']), 'internal id ' + row['Internal Order ID']);
  const items = s.sheets.ORDER_ITEMS;
  expect(items.length === 3 && items.some((i) => i['Options Price'] === 300) && items.some((i) => i.Removed === 'BEZ: ljubičasti luk'), 'ORDER_ITEMS not structured per piece');
  note(`Sheets: ${row['Internal Order ID']} · ${row.Total} RSD · kusur ${row['Change Required']} · rok ${row['Accept By']} · email ${row['Email Status']}`);
  expect(page.errors.length === 0, 'console errors: ' + page.errors.join(' | '));
  expect(page.badRequests.length === 0, 'failed requests: ' + page.badRequests.join(' | '));
  const mail = await newPage({ viewport: { width: 390, height: 900 } });
  await mail.goto(`${BASE}/__outbox/0`);
  expect((await mail.title()).startsWith('#1001 · DOSTAVA · ŠTO PRE · 1.990 RSD'), 'ticket subject: ' + (await mail.title()));
  await shot(mail, '01-email-kitchen-ticket', { fullPage: true });
  const outbox = await (await fetch(`${BASE}/__outbox`)).text();
  expect(s.outbox === 3 && /Primili smo porudžbinu #1001/.test(outbox), `expected 2 kitchen tickets + the guest confirmation, outbox ${s.outbox}`);
});

// -----------------------------------------------------------------------------
// FLOW 2 — pickup on desktop, scheduled for tomorrow 12:00 (30-minute slots, 7 days)
// -----------------------------------------------------------------------------
await test('Tok 2 — preuzimanje na desktopu: paket sa obaveznim mesom, ZAKAŽI sutra 12:00, 7 dana, bez dostave i kusura', async () => {
  const page = await newPage(desktop);
  await openMenu(page);
  await page.click('label[for="menu-mode-pickup"]');
  await page.waitForFunction(() => /Spremno za/.test(document.querySelector('[data-mode-info]').textContent));
  await openSheet(page, 'giros-sok');
  const label = await page.textContent('.sheet [data-add-label]');
  expect(/meso/i.test(label), 'required meat not signalled on the button: ' + label);
  await page.click('.sheet [data-sheet-add]');
  expect(await page.$('.sheet.is-open'), 'sheet closed although meat is missing');
  await page.click('.sheet label[for="o-0-meso-svinjsko"]');
  await shot(page, '02-bundle-sheet');
  await page.click('.sheet [data-sheet-add]');
  await page.waitForSelector('.sheet:not(.is-open)', { state: 'attached' });
  await page.click('[data-add="pomfrit-mali"]');
  await page.click('.site-header [data-cart-open]');
  await page.waitForSelector('.drawer.is-open');
  const totals = nbsp(await page.textContent('.drawer .totals'));
  expect(/Preuzimanje u lokalu/.test(totals) && /950/.test(totals), 'pickup totals: ' + totals);
  await toCheckout(page);
  await page.click('label:has(input[name="timing"][value="later"]) .chip');
  await page.waitForSelector('[name="day"]', { state: 'attached' });
  const days = await page.$$eval('[name="day"]', (els) => els.map((e) => e.closest('label').textContent.trim()));
  expect(days.length === 7 && days[0] === 'Danas' && days[1] === 'Sutra' && days.at(-1) === 'Sre 30.09.' && !days.some((d) => /27\.09/.test(d)), 'days offered: ' + days.join(', '));
  await page.click('label:has(input[name="day"][value="2026-09-24"]) .chip');
  const times = await page.$$eval('[name="when"]', (els) => els.map((e) => e.value.slice(11)));
  const steps = times.slice(1).map((t, i) => (Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) - (Number(times[i].slice(0, 2)) * 60 + Number(times[i].slice(3))) + 1440) % 1440);
  expect(times[0] === '09:30' && times.at(-1) === '00:30' && steps.every((m) => m === 30), 'tomorrow pickup slots: ' + times.join(' '));
  await page.click('label:has(input[name="when"][value="2026-09-24 12:00"]) .chip');
  await page.fill('[name="name"]', 'Jelena Petrović');
  await page.fill('[name="phone"]', '+381 63 555 1234');
  expect(!(await page.$('[name="cashQuick"]')), 'pickup must not ask for cash amount');
  expect(await page.isHidden('[data-delivery-only]'), 'address section visible for pickup');
  expect(/sutra u 12:00/.test(await page.textContent('[data-review]')), 'review time');
  await shot(page, '02-checkout-pickup-scheduled', { fullPage: true });
  await human(page);
  await page.click('[data-submit]');
  await page.waitForSelector('.confirm .ticket__number');
  const conf = nbsp(await page.textContent('.confirm'));
  expect(conf.includes('#1002') || /1002/.test(await page.textContent('.confirm .ticket__number')), 'number');
  expect(conf.includes('Zakazano: četvrtak 24.09. u 12:00') && conf.includes('Preuzimanje u lokalu'), 'pickup confirmation: ' + conf.slice(0, 300));
  await shot(page, '02-confirmation-pickup', { fullPage: true });
  const row = await lastOrder();
  expect(row['Order Type'] === 'PICKUP' && row['Scheduled Date'] === '2026-09-24' && row['Scheduled Time'] === '12:00' && row['Requested Time'] === '12:00' && row['Delivery Cost'] === 0 && row.Total === 950 && row['Cash Provided'] === '', 'pickup row mismatch');
  note(`Dani: ${days.join(', ')} · sutra ${times.length} termina ${times[0]}–${times.at(-1)} na 30 min · Sheets ${row['Scheduled Date']} ${row['Scheduled Time']}`);
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
  expect(await page.$eval('.drawer .overlay__body', (b) => b.scrollHeight > b.clientHeight), 'cart body does not scroll');
  await shot(page, '02b-long-cart-375');
  note('12 stavki na 375×667: lista skroluje, „Nastavi na porudžbinu“ vidljivo na dnu');
});

// -----------------------------------------------------------------------------
// FLOW 3 — minimum, unsupported zone, validation
// -----------------------------------------------------------------------------
await test('Tok 3a — dostava ispod 500 RSD i naselje koje nije na spisku: slanje blokirano, jasno objašnjeno', async () => {
  const page = await newPage(mobile);
  await openMenu(page);
  await page.click('[data-add="coca-cola"]');
  await page.click('[data-order-bar-link]');
  await page.waitForSelector('.drawer.is-open');
  await page.selectOption('#drawer-zone', { label: 'Liman 2' });
  await page.waitForFunction(() => /Minimalna porudžbina za dostavu je 500 RSD\. Dodajte još 300 RSD/.test(document.querySelector('.drawer').textContent));
  expect((await page.getAttribute('.drawer [data-checkout]', 'aria-disabled')) === 'true', 'checkout allowed under the minimum');
  await shot(page, '03a-minimum');
  await page.selectOption('#drawer-zone', 'none');
  await page.waitForFunction(() => /Na tu adresu trenutno ne dostavljamo/.test(document.querySelector('.drawer').textContent));
  await page.goto(`${BASE}/porudzbina/`);
  await page.waitForSelector('[data-checkout-form]');
  expect(await page.isDisabled('[data-submit]'), 'submit enabled for an unsupported zone');
  expect(/Dostava na tu lokaciju trenutno nije dostupna/.test(await page.textContent('[data-zone-field]')), 'zone message missing');
  await page.click('label[for="mode-pickup"]');
  await page.waitForFunction(() => !document.querySelector('[data-submit]').disabled);
  note('200 RSD dostava: „Dodajte još 300 RSD“, dugme ugašeno · „Mog naselja nema“: poruka + blokada · preuzimanje otključava');
});

await test('Tok 3b — validacija: prazno ime, loš telefon, bez adrese, nedovoljno gotovine, bez termina', async () => {
  const page = await newPage(mobile);
  await openMenu(page);
  await page.click('[data-add="pomfrit-feta"]');
  await page.click('[data-add="coca-cola"]');
  await page.goto(`${BASE}/porudzbina/`);
  await page.waitForSelector('[data-checkout-form]');
  await page.selectOption('[name="address.zone"]', { label: 'Detelinara' });
  const before = (await state()).sheets.ORDERS.length;
  await page.click('[data-submit]');
  const errs = await page.$$eval('.field.has-error', (els) => els.map((e) => e.dataset.field));
  expect(['name', 'phone', 'address.street', 'address.number', 'cash'].every((f) => errs.includes(f)), 'missing errors: ' + errs.join(','));
  expect((await page.evaluate(() => document.activeElement.name)) === 'name', 'focus did not move to the first error');
  await shot(page, '03b-validation-errors', { fullPage: true });
  await page.fill('[name="name"]', 'A');
  await page.fill('[name="phone"]', '123');
  await page.fill('[name="address.street"]', 'Futoška');
  await page.fill('[name="address.number"]', 'bb');
  await page.click('label:has(input[name="cashQuick"][value="custom"]) .chip');
  await page.fill('[name="cashCustom"]', '300');
  expect(/najmanje/.test(await page.textContent('[data-cash-result]')), 'cash error not live');
  await page.click('label:has(input[name="timing"][value="later"]) .chip');
  await page.click('[data-submit]');
  expect(/mobilnog telefona/.test(await page.textContent('[data-field="phone"] .field__error')), 'phone error');
  expect(/Izaberite dan i vreme/.test(await page.textContent('[data-when-error]')), 'missing slot not explained');
  expect((await state()).sheets.ORDERS.length === before, 'an invalid order reached the backend');
  note('Greške: ' + errs.join(', ') + ' · fokus na prvom polju · „Zakaži“ bez termina objašnjeno · ništa nije poslato');
});

// -----------------------------------------------------------------------------
// FLOW 4 — closed hours and the break
// -----------------------------------------------------------------------------
await test('Tok 4 — zatvoreno (nedelja), dostava gotova a preuzimanje radi (23:50), pauza 16:00–17:00', async () => {
  const page = await newPage(mobile);
  await openMenu(page, '2026-09-27T12:00:00+02:00');
  await page.waitForSelector('[data-closed-notice]:not([hidden])');
  const notice = nbsp(await page.textContent('[data-closed-notice]'));
  expect(/Trenutno ne primamo porudžbine/.test(notice) && /sutra u 09:00/.test(notice) && /Meni možete da pregledate/.test(notice), 'closed notice: ' + notice);
  expect((await page.$$('[data-product]')).length > 20, 'menu not visible while closed');
  await openSheet(page, 'klasik');
  expect(await page.isDisabled('.sheet [data-sheet-add]'), 'add button enabled while closed');
  await shot(page, '04-closed-sunday');
  await page.keyboard.press('Escape');
  const late = await newPage(mobile);
  await openMenu(late, '2026-09-23T23:50:00+02:00');
  await late.waitForFunction(() => /poručivanje do 00:45/.test(document.querySelector('[data-mode-info]').textContent));
  expect(await late.isChecked('[data-mode-switch] input[value="pickup"]'), 'pickup was not selected automatically after delivery hours');
  await late.click('label[for="menu-mode-delivery"]');
  await late.waitForFunction(() => /Trenutno ne primamo porudžbine/.test(document.querySelector('[data-mode-info]').textContent) && /Preuzimanje radi/.test(document.querySelector('[data-mode-info]').textContent));
  await shot(late, '04-late-delivery-closed');
  await setCell('HOURS', 'dow', '3', 'break_start', '16:00');
  await setCell('HOURS', 'dow', '3', 'break_end', '17:00');
  const brk = await newPage(mobile);
  await openMenu(brk, '2026-09-23T16:20:00+02:00');
  await brk.waitForSelector('[data-closed-notice]:not([hidden])');
  const bnote = nbsp(await brk.textContent('[data-closed-notice]'));
  expect(/Pauza je u toku, poručivanje ponovo danas u 17:00/.test(bnote), 'break notice: ' + bnote);
  expect(/Pauza/.test(await brk.textContent('[data-status-pill]')), 'header pill does not show the break');
  await shot(brk, '04-break');
  const before = await newPage(mobile);
  await openMenu(before, '2026-09-23T14:23:00+02:00');
  await before.click('[data-add="pomfrit-feta"]');
  await before.click('[data-add="coca-cola"]');
  await before.goto(`${BASE}/porudzbina/`);
  await before.waitForSelector('[data-checkout-form]');
  await before.click('label[for="mode-pickup"]');
  await before.click('label:has(input[name="timing"][value="later"]) .chip');
  const today = await before.$$eval('[name="when"]', (els) => els.map((e) => e.value.slice(11)));
  expect(!today.some((t) => ['16:00', '16:30'].includes(t)) && today.includes('15:30') && today.includes('17:30'), 'slots around the break: ' + today.join(' '));
  expect(!today.includes('17:00'), '17:00 offered although the kitchen restarts at 17:00');
  await setCell('HOURS', 'dow', '3', 'break_start', '');
  await setCell('HOURS', 'dow', '3', 'break_end', '');
  note('Nedelja: „Trenutno ne primamo porudžbine… sutra u 09:00“, meni vidljiv · 23:50 bira preuzimanje · pauza 16–17: poruka + bez termina 16:00, 16:30, 17:00');
});

// -----------------------------------------------------------------------------
// FLOW 5 — failures
// -----------------------------------------------------------------------------
async function checkoutWith(page, product = 'pomfrit-feta') {
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
  const msg = nbsp(await page.textContent('[data-submit-error]'));
  expect(msg.includes('Porudžbina trenutno nije mogla da bude poslata') && msg.includes('064 227 4334'), 'error text: ' + msg);
  await shot(page, '05-sheets-failure');
  expect((await state()).sheets.ERROR_LOG.some((e) => /Spreadsheets failed/.test(e.Error)), 'no ERROR_LOG entry');
  await page.click('[data-retry]');
  await page.waitForSelector('.confirm .ticket__number');
  expect((await state()).sheets.ORDERS.length === before + 1, 'retry did not create exactly one order');
  note('Poruka: ' + msg.slice(0, 140));
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

await test('Tok 5c — dupli klik na „Pošalji“: samo jedna porudžbina', async () => {
  const page = await newPage(mobile);
  await checkoutWith(page);
  const before = (await state()).sheets.ORDERS.length;
  await page.dblclick('[data-submit]');
  await page.click('[data-submit]', { force: true, timeout: 1500 }).catch(() => {});
  await page.waitForSelector('.confirm .ticket__number');
  await page.waitForTimeout(800);
  expect((await state()).sheets.ORDERS.length === before + 1, 'double submit created more than one order');
});

await test('Tok 5d — stale korpa: cena promenjena dok je gost u korpi → jasna poruka, nov iznos, uspeh posle potvrde', async () => {
  const page = await newPage(desktop);
  await checkoutWith(page);
  await setCell('PRODUCTS', 'id', 'pomfrit-feta', 'price', '390');
  await page.click('[data-submit]');
  await page.waitForSelector('[data-submit-error]:not([hidden])');
  const msg = nbsp(await page.textContent('[data-submit-error]'));
  expect(/Cene ili dostava su se u međuvremenu promenile/.test(msg), 'price change message: ' + msg);
  await page.waitForFunction(() => /390/.test(document.querySelector('[data-submit-total]').textContent));
  await page.click('[data-submit]');
  await page.waitForSelector('.confirm .ticket__number');
  await setCell('PRODUCTS', 'id', 'pomfrit-feta', 'price', '360');
  note('Poruka: ' + msg);
});

await test('Tok 5e — proizvod rasprodat pre slanja, ugašena zona pre slanja, neočekivana greška servera', async () => {
  const page = await newPage(mobile);
  await checkoutWith(page, 'fanta');
  await setCell('PRODUCTS', 'id', 'fanta', 'available', 'FALSE');
  await page.click('[data-submit]');
  await page.waitForSelector('[data-submit-error]:not([hidden])');
  const msg = nbsp(await page.textContent('[data-submit-error]'));
  expect(/Trenutno nema: Fanta/.test(msg), 'sold-out message: ' + msg);
  await setCell('PRODUCTS', 'id', 'fanta', 'available', 'TRUE');
  const zp = await newPage(mobile);
  await openMenu(zp);
  await zp.click('[data-add="pomfrit-feta"]');
  await zp.click('[data-add="coca-cola"]');
  await zp.goto(`${BASE}/porudzbina/`);
  await zp.waitForSelector('[data-checkout-form]');
  await zp.selectOption('[name="address.zone"]', { label: 'Petrovaradin' });
  await zp.fill('[name="name"]', 'Zoran Zonić');
  await zp.fill('[name="phone"]', '064 999 1234');
  await zp.fill('[name="address.street"]', 'Preradovićeva');
  await zp.fill('[name="address.number"]', '5');
  await zp.click('label:has(input[name="cashQuick"][value="exact"]) .chip');
  await setCell('ZONES', 'id', 'ns-okolina', 'active', 'FALSE');
  await human(zp);
  await zp.click('[data-submit]');
  await zp.waitForSelector('[data-field="address.zone"].has-error');
  const zmsg = nbsp(await zp.textContent('[data-field="address.zone"] .field__error'));
  expect(/Dostava u izabrano naselje trenutno nije dostupna/.test(zmsg), 'zone switched off: ' + zmsg);
  await setCell('ZONES', 'id', 'ns-okolina', 'active', 'TRUE');
  const res = await getJSON(`${BASE}/api?action=bootstrap&__fail=exception`);
  expect(res.ok === false && res.error.code === 'SERVER_ERROR' && !/Spreadsheet|Exception|stack/i.test(res.error.message), 'server error leaks internals: ' + JSON.stringify(res.error));
  const bad = await (await fetch(`${BASE}/api`, { method: 'POST', body: '{"action":"order.create","payload":' })).json();
  expect(bad.error.code === 'BAD_REQUEST' && bad.error.message === 'Zahtev nije ispravan.', 'malformed request');
  note(`Rasprodato: ${msg} · zona ugašena: ${zmsg} · serverska greška: „${res.error.message}“`);
});

/** First order.create reaches the server and is saved, but the phone never hears back; the automatic retry fails too. */
async function loseTheAnswer(page) {
  let creates = 0;
  await page.route('**/api?**', async (route) => {
    const req = route.request();
    if (req.method() !== 'POST' || !(req.postData() || '').includes('"order.create"')) return route.continue();
    creates++;
    if (creates === 1) await route.fetch();
    return route.abort('internetdisconnected');
  });
  await page.click('[data-submit]');
  await page.waitForSelector('[data-submit-error]:not([hidden])', { timeout: 25000 });
  await page.unroute('**/api?**');
}

await test('Tok 5f — odgovor izgubljen posle upisa: osvežavanje stranice ili izmenjena forma ne prave drugu porudžbinu', async () => {
  const page = await newPage(mobile);
  await checkoutWith(page);
  const before = (await state()).sheets.ORDERS.length;
  await loseTheAnswer(page);
  expect((await state()).sheets.ORDERS.length === before + 1, 'the first attempt was not saved (test setup)');
  const lost = nbsp(await page.textContent('[data-submit-error]'));
  await page.reload();
  await page.waitForSelector('.confirm .ticket__number', { timeout: 15000 });
  const number = nbsp(await page.textContent('.confirm .ticket__number'));
  expect((await state()).sheets.ORDERS.length === before + 1, 'refresh created a second order');
  expect(number === '#' + (await lastOrder())['Public Order Number'], 'refresh shows another order: ' + number);

  const other = await newPage(mobile);
  await checkoutWith(other, 'pomfrit-mali');
  await loseTheAnswer(other);
  await other.fill('[name="phone"]', '062 333 4455');
  await other.fill('[name="note"]', 'Ipak bez kečapa');
  await human(other);
  await other.click('[data-submit]');
  await other.waitForSelector('.confirm .ticket__number', { timeout: 15000 });
  const toastText = nbsp(await other.textContent('.toast-region'));
  expect(/već stigla ranije — nije poslata dva puta/.test(toastText), 'no explanation: ' + toastText);
  expect((await state()).sheets.ORDERS.length === before + 2, 'edited resend created a duplicate');
  expect(!page.errors.length && !other.errors.length, 'console errors: ' + [...page.errors, ...other.errors].join(' | '));
  await shot(other, '05f-earlier-order-found');
  note(`Bez odgovora: „${lost.slice(0, 90)}“ · posle osvežavanja: ${number} (ista) · izmenjena forma: „${toastText.slice(0, 80)}“ · ukupno 2 porudžbine za 2 kupca`);
});

await test('Tok 5g — ručno izmenjen localStorage (količine, nepostojeći i „constructor“ proizvodi): stranica radi, total tačan', async () => {
  const page = await newPage(desktop);
  await openMenu(page);
  await page.evaluate(() =>
    localStorage.setItem(
      'gg:cart:v1',
      JSON.stringify({
        mode: 'pickup',
        zone: '',
        lines: [
          { productId: 'pomfrit-feta', qty: '3', options: [], note: '' },
          { productId: 'coca-cola', qty: 1e9, options: 'x', note: { a: 1 } },
          { productId: 'fanta', qty: -4, options: [] },
          { productId: 'voda', qty: 'abc', options: [] },
          null,
          'x',
          42,
          { productId: 'constructor', qty: 2, options: [] }
        ]
      })
    )
  );
  await page.goto(`${BASE}/porudzbina/`);
  await page.waitForSelector('[data-checkout-form]');
  const aside = nbsp(await page.textContent('[data-checkout-summary]'));
  expect(/5\.080 RSD/.test(aside), 'total with 3× feta (1.080) + 20× cola (4.000): ' + aside.slice(0, 200));
  const blocked = await page.isDisabled('[data-submit]');
  const reason = nbsp(await page.textContent('[data-closed]'));
  expect(blocked && /više nije u ponudi/.test(reason), 'unknown product must block with a reason: ' + reason);
  await page.click('[data-closed] [data-edit-cart]');
  await page.waitForSelector('.drawer:not([hidden]) .cart-line');
  const plus = page.locator('.drawer .cart-line', { hasText: 'Coca-Cola' }).locator('.qty button').last();
  expect(await plus.isDisabled(), '"+" stays active at the 20 limit');
  await page.locator('.drawer .cart-line', { hasText: 'više nije u ponudi' }).locator('[data-remove]').click();
  await page.waitForFunction(() => !document.querySelector('.drawer [data-checkout][aria-disabled]'));
  expect(!page.errors.length, 'console errors: ' + page.errors.join(' | '));
  note('Iz izmenjenog localStorage-a: 3× Pomfrit sa fetom + 20× Coca-Cola (1e9 → 20), negativne/tekstualne količine i smeće izbačeni, „constructor“ = „više nije u ponudi“ dok se ne ukloni · „+“ ugašen na 20');
});

await test('Tok 5h — „Nazad“ posle poručivanja: meni iz keša pregledača ne vraća već poručenu korpu', async () => {
  const page = await newPage(mobile);
  await openMenu(page);
  await page.click('[data-add="pomfrit-feta"]');
  await page.click('[data-add="pomfrit-feta"]');
  await page.click('.site-header [data-cart-open]');
  await page.waitForSelector('.drawer:not([hidden]) [data-checkout]');
  await toCheckout(page);
  await page.click('label[for="mode-pickup"]');
  await page.fill('[name="name"]', 'Bojan Nazad');
  await page.fill('[name="phone"]', '063 555 7788');
  await human(page);
  const before = (await state()).sheets.ORDERS.length;
  await page.click('[data-submit]');
  await page.waitForSelector('.confirm .ticket__number');
  await page.goBack();
  await page.waitForSelector('[data-add="coca-cola"]');
  const restored = await page.evaluate(() => performance.getEntriesByType('navigation')[0]?.type);
  await page.click('[data-add="coca-cola"]');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('gg:cart:v1')).lines.map((l) => `${l.qty}×${l.productId}`).join(','));
  expect(stored === '1×coca-cola', 'the ordered cart came back after "Nazad": ' + stored);
  expect((await state()).sheets.ORDERS.length === before + 1, 'unexpected orders');
  // Production hosting lets Chrome keep the menu in the back/forward cache (the dev server sends no-cache, so it
  // reloads instead): simulate that restore — the cart in memory is stale, storage says it was ordered.
  await page.click('[data-add="fanta"]');
  await page.evaluate(() => {
    localStorage.setItem('gg:cart:v1', JSON.stringify({ lines: [], mode: 'pickup', zone: '', updatedAt: Date.now() }));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await page.click('[data-add="voda"]');
  const afterRestore = await page.evaluate(() => JSON.parse(localStorage.getItem('gg:cart:v1')).lines.map((l) => `${l.qty}×${l.productId}`).join(','));
  expect(afterRestore === '1×voda', 'a page restored from the back/forward cache wrote its stale cart back: ' + afterRestore);
  note(`„Nazad“ posle porudžbine (${restored}), dodata Coca-Cola → korpa: ${stored} · simuliran povratak iz bfcache-a sa zastarelom korpom → posle dodavanja samo ${afterRestore}`);
});

// -----------------------------------------------------------------------------
// FLOW 6 — the shop: admin orders, alert, deadline, statuses, guest status, feedback, history
// -----------------------------------------------------------------------------
await test('Tok 6a — admin: PIN, vizuelni + zvučni alarm, rok 5 min, „Utišaj“, prihvatanje, gost vidi „Potvrđena“', async () => {
  const page = await newPage(tablet);
  await page.goto(`${BASE}/admin/${q('2026-09-23T14:24:00+02:00')}`);
  await page.fill('#pin', '000000');
  await page.click('.pin__pad .is-ok');
  await page.waitForFunction(() => /Pogrešan PIN/.test(document.querySelector('.pin__error').textContent));
  await page.fill('#pin', '123456');
  await page.click('.pin__pad .is-ok');
  await page.waitForSelector('[data-alert]:not([hidden])');
  const alert = nbsp(await page.textContent('[data-alert]'));
  expect(/nove porudžbine|Nova porudžbina/.test(alert) && /čeka/.test(alert), 'alert: ' + alert);
  const chimes = await page.evaluate(() => window.GG_ADMIN.chimes);
  expect(chimes >= 1, 'no sound signal for new orders');
  expect((await page.title()).startsWith('('), 'tab title does not flag new orders');
  await page.waitForSelector('.pcard [data-countdown]');
  const deadline = nbsp(await page.textContent('.pcard:has(.pcard__num:text-is("#1001")) [data-countdown]'));
  expect(/Prihvatite za [34]:\d\d/.test(deadline), 'countdown: ' + deadline);
  await shot(page, '06a-admin-new');
  await page.click('[data-silence]');
  await page.waitForFunction(() => !document.querySelector('[data-alert]').classList.contains('is-loud'));
  const card = page.locator('.pcard', { has: page.locator('.pcard__num', { hasText: /^#1001$/ }) });
  await card.locator('[data-status="CONFIRMED"]').click();
  await page.waitForFunction(() => ![...document.querySelectorAll('[data-view] .pcard__num')].some((n) => n.textContent === '#1001'));
  const row = (await state()).sheets.ORDERS.find((r) => r['Public Order Number'] === 1001);
  expect(row.Status === 'CONFIRMED' && row['Confirmed At'], 'status not saved');
  const guest = await newPage(mobile);
  await guest.goto(statusLink(row));
  await guest.waitForFunction(() => /✓ Primljena ● Potvrđena/.test((document.querySelector('[data-tracker]')?.textContent || '').replace(/\s+/g, ' ')));
  await shot(guest, '06a-guest-confirmed');
  const outbox = await (await fetch(`${BASE}/__outbox`)).text();
  expect(/Porudžbina #1001 je potvrđena/.test(outbox), 'guest did not get the "potvrđena" email');
  note(`Alarm: baner + ${chimes} zvučni signal · rok „${deadline}“ · #1001 NOVA → POTVRĐENA · gost vidi ✓ Primljena ● Potvrđena i dobija email „Porudžbina #1001 je potvrđena“`);
});

await test('Tok 6b — admin: istek roka od 5 min, odbijanje, gost vidi „Odbijena“, statusi do „Završena“, ocena kupca', async () => {
  const late = await apiOrder({ customer: { name: 'Kasni Kupac', phone: '0641231231', email: 'kasni@example.com' } });
  expect(late.ok, 'api order: ' + JSON.stringify(late.error));
  const page = await newPage(tablet);
  await adminLogin(page, '2026-09-23T14:30:00+02:00');
  await adminView(page, 'nove');
  const overdueCard = page.locator('.pcard.is-overdue', { has: page.locator('.pcard__num', { hasText: new RegExp(`^#${late.data.publicNumber}$`) }) });
  await overdueCard.waitFor();
  expect(/KASNI \d+ min/.test(await overdueCard.locator('[data-countdown]').textContent()), 'overdue text missing');
  expect(/kasn[ie]/.test(await page.textContent('[data-alert]')), 'alert does not say it is late');
  await shot(page, '06b-admin-overdue');
  const gRow = (await state()).sheets.ORDERS.find((r) => r['Internal Order ID'] === late.data.orderId);
  const guestLate = await newPage(mobile);
  await guestLate.goto(statusLink(gRow, '2026-09-23T14:30:00+02:00'));
  await guestLate.waitForFunction(() => /Lokal još nije potvrdio porudžbinu/.test(document.querySelector('[data-tracker]')?.textContent || ''));
  expect(/064 227 4334/.test(await guestLate.textContent('[data-tracker]')), 'overdue guest message without phone');
  await shot(guestLate, '06b-guest-overdue');
  await overdueCard.locator('[data-status="REJECTED"]').click();
  await page.waitForFunction((n) => ![...document.querySelectorAll('[data-view] .pcard__num')].some((x) => x.textContent === '#' + n), late.data.publicNumber);
  await guestLate.reload();
  await guestLate.waitForFunction(() => /Odbijena/.test(document.querySelector('[data-tracker]')?.textContent || '') && /Ništa ne plaćate/.test(document.querySelector('[data-tracker]').textContent));
  await shot(guestLate, '06b-guest-rejected');
  expect((await state()).sheets.ORDERS.find((r) => r['Internal Order ID'] === late.data.orderId).Status === 'REJECTED', 'reject not saved');
  // #1002 (pickup) through every step.
  await adminView(page, 'nove');
  const pickupCard = page.locator('.pcard', { has: page.locator('.pcard__num', { hasText: /^#1002$/ }) });
  await pickupCard.locator('[data-status="CONFIRMED"]').click();
  await adminView(page, 'aktivne');
  const active = page.locator('.pcard', { has: page.locator('.pcard__num', { hasText: /^#1002$/ }) });
  await active.locator('[data-status="PREPARING"]').click();
  await page.waitForFunction(() => [...document.querySelectorAll('.col')].some((c) => /U pripremi/.test(c.querySelector('h2').textContent) && /#1002/.test(c.textContent)));
  await active.locator('[data-status="READY"]').click();
  await page.waitForFunction(() => [...document.querySelectorAll('.col')].some((c) => /Spremne/.test(c.querySelector('h2').textContent) && /#1002/.test(c.textContent)));
  await shot(page, '06b-admin-active');
  await active.locator('[data-status="COMPLETED"]').click();
  await page.waitForTimeout(500);
  const done = (await state()).sheets.ORDERS.find((r) => r['Public Order Number'] === 1002);
  expect(done.Status === 'COMPLETED' && done['Preparing At'] && done['Ready At'] && done['Completed At'], 'timestamps missing');
  const guest = await newPage(mobile);
  await guest.goto(statusLink(done, '2026-09-23T14:30:00+02:00'));
  await guest.waitForSelector('[data-feedback]');
  expect(/✓ Primljena ✓ Potvrđena ✓ U pripremi ✓ Spremna ✓ Završena/.test(nbsp(await guest.textContent('[data-tracker]'))), 'completed tracker');
  await guest.click('[data-feedback] [type="submit"]');
  expect(/ocenu od 1 do 5/.test(await guest.textContent('[data-field="rating"] .field__error')), 'rating required');
  await guest.click('.star:nth-of-type(5)');
  await guest.click('[data-feedback] label:has(input[name="good"][value="taste"]) .chip');
  await guest.click('[data-feedback] label:has(input[name="improve"][value="speed"]) .chip');
  await guest.fill('[data-feedback] [name="comment"]', 'Odličan giros, malo smo čekali.');
  await shot(guest, '06b-guest-feedback');
  await guest.click('[data-feedback] [type="submit"]');
  await guest.waitForSelector('[data-feedback-done]');
  const fb = (await state()).sheets.FEEDBACK;
  expect(fb.length === 1 && fb[0].Rating === 5 && fb[0].Good === 'taste' && fb[0].Improve === 'speed', 'feedback not stored: ' + JSON.stringify(fb));
  await adminView(page, 'utisci');
  await page.waitForFunction(() => /Odličan giros/.test(document.querySelector('[data-view]').textContent));
  await shot(page, '06b-admin-feedback');
  await adminView(page, 'istorija');
  await page.fill('[data-history-form] [name="q"]', '064 123 4567');
  await page.click('[data-history-form] [type="submit"]');
  await page.waitForFunction(() => /Pronađeno: 1\b/.test(document.querySelector('[data-history-total]').textContent));
  await page.click('.otable--list tbody tr');
  await page.waitForSelector('.admin-drawer.is-open .odetail');
  const detail = nbsp(await page.textContent('.odetail'));
  expect(/Bulevar oslobođenja 12a, stan 4, 2\. sprat/.test(detail) && /Pozovite kada stignete/.test(detail) && /Kusur\s*1\.010/.test(detail) && /Extra meso/.test(detail), 'order detail: ' + detail.slice(0, 300));
  await shot(page, '06b-admin-history-detail');
  await page.keyboard.press('Escape');
  await page.selectOption('[data-history-form] [name="status"]', 'REJECTED');
  await page.fill('[data-history-form] [name="q"]', '');
  await page.click('[data-history-form] [type="submit"]');
  await page.waitForFunction(() => /Pronađeno: 1\b/.test(document.querySelector('[data-history-total]').textContent));
  await adminView(page, 'pregled');
  const kpis = nbsp(await page.textContent('.kpis'));
  expect(/Završene\s*1\b/.test(kpis) && /Odbijene\s*1\b/.test(kpis), 'dashboard: ' + kpis);
  await shot(page, '06b-admin-dashboard');
  note(`Rok istekao → „KASNI“, gost „Lokal još nije potvrdio… 064 227 4334“ · odbijanje → gost „Odbijena, ništa ne plaćate“ · #1002 do „Završena“ · ocena 5/5 u FEEDBACK i adminu · istorija po telefonu i statusu · dashboard ${kpis}`);
});

await test('Tok 6c — dve porudžbine skoro istovremeno: različiti brojevi, po jedan red, brojevi bez rupa', async () => {
  const [a, b] = await Promise.all([apiOrder(), apiOrder()]);
  expect(a.ok && b.ok, 'parallel orders failed');
  expect(a.data.publicNumber !== b.data.publicNumber && Math.abs(a.data.publicNumber - b.data.publicNumber) === 1, `numbers ${a.data.publicNumber} / ${b.data.publicNumber}`);
  const rows = (await state()).sheets.ORDERS.filter((r) => [a.data.orderId, b.data.orderId].includes(r['Internal Order ID']));
  expect(rows.length === 2, 'expected exactly two rows');
  const all = (await state()).sheets.ORDERS.map((r) => r['Public Order Number']);
  expect(new Set(all).size === all.length, 'duplicate public numbers: ' + all.join(','));
  note(`Paralelno: #${a.data.publicNumber} i #${b.data.publicNumber} · ${all.length} porudžbina, svi brojevi jedinstveni (emulator izvršava zahteve redom; pravi LockService nije testiran lokalno)`);
});

await test('Tok 6d — dva uređaja: telefon prihvati, tablet sa zastarelim ekranom pritisne „Odbij“ → odbijeno uz objašnjenje', async () => {
  const created = await apiOrder({ customer: { name: 'Dva Uređaja', phone: '0647770001', email: '' } });
  expect(created.ok, 'api order: ' + JSON.stringify(created.error));
  const n = created.data.publicNumber;
  const page = await newPage(tablet);
  await adminLogin(page);
  await adminView(page, 'nove');
  const card = page.locator('.pcard', { has: page.locator('.pcard__num', { hasText: new RegExp(`^#${n}$`) }) });
  await card.waitFor();
  const post = (action, payload) => getJSON(`${BASE}/api${q()}`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action, payload }) });
  const phone = await post('admin.login', { pin: '123456' });
  const accepted = await post('admin.status', { token: phone.data.token, orderId: created.data.orderId, status: 'CONFIRMED', from: 'NEW' });
  expect(accepted.ok, 'phone could not accept');
  await card.locator('[data-status="REJECTED"]').click();
  await page.waitForFunction(() => /u međuvremenu promenjena/.test(document.querySelector('.toast-region')?.textContent || ''));
  const row = (await state()).sheets.ORDERS.find((r) => r['Internal Order ID'] === created.data.orderId);
  expect(row.Status === 'CONFIRMED', 'stale tablet overwrote the phone: ' + row.Status);
  await page.waitForFunction((num) => ![...document.querySelectorAll('[data-view] .pcard__num')].some((x) => x.textContent === '#' + num), n);
  note(`#${n}: telefon → POTVRĐENA, tablet (zastareo) „Odbij“ → „${nbsp(await page.textContent('.toast-region')).slice(0, 110)}“ · ostaje POTVRĐENA, tablet se osvežio`);
});

await test('Tok 6e — admin otvoren celu smenu 09:00 → 00:30: sesija se sama produžava, nema odjave usred rada', async () => {
  const page = await newPage(tablet);
  await adminLogin(page, '2026-09-23T09:00:00+02:00');
  const tokenAt = () => page.evaluate(() => JSON.parse(localStorage.getItem('gg:admin:v1')).token);
  const first = await tokenAt();
  for (const t of ['2026-09-23T15:30:00+02:00', '2026-09-23T21:30:00+02:00', '2026-09-24T00:30:00+02:00']) {
    // The dev clock comes from ?__now= in the address bar: move it, then let the panel poll.
    await page.evaluate((now) => {
      history.replaceState(null, '', `/admin/?__now=${encodeURIComponent(now)}${location.hash}`);
      document.dispatchEvent(new Event('visibilitychange'));
    }, t);
    await page.waitForTimeout(900);
    expect(!(await page.$('#pin')), 'logged out at ' + t);
    expect(/Povezano/.test(await page.textContent('[data-conn]')), 'not connected at ' + t);
  }
  expect((await tokenAt()) !== first, 'the session was never renewed');
  note('Prijava 09:00 · 15:30, 21:30 i 00:30 i dalje povezano (token obnovljen), PIN ekran se nije pojavio');
});

// -----------------------------------------------------------------------------
// FLOW 7 — the shop changes the menu, zones, hours, pauses and estimates — no code
// -----------------------------------------------------------------------------
await test('Tok 7a — admin menja meni: cena, novi proizvod sa fotografijom, rasprodato, kategorija, dodatak', async () => {
  const page = await newPage(desktop);
  await adminLogin(page);
  await adminView(page, 'proizvodi');
  await page.click('[data-edit-product="klasik"]');
  await page.waitForSelector('.admin-drawer.is-open [data-product-form]');
  await page.fill('[data-product-form] [name="price"]', '690');
  await page.fill('[data-product-form] [name="description"]', 'Pileće meso, tzatziki, paradajz i pomfrit u piti.');
  await shot(page, '07a-admin-product-edit');
  await page.click('[data-product-form] [type="submit"]');
  await page.waitForFunction(() => /690/.test(document.querySelector('[data-product-row="klasik"]').textContent));
  await page.click('[data-edit-product=""]');
  await page.waitForSelector('.admin-drawer.is-open [data-product-form]');
  await page.fill('[data-product-form] [name="name"]', 'Pita sa spanaćem');
  await page.selectOption('[data-product-form] [name="categoryId"]', 'prilozi');
  await page.fill('[data-product-form] [name="price"]', '280');
  await page.setInputFiles('[data-upload]', { name: 'pita.png', mimeType: 'image/png', buffer: PNG });
  await page.waitForFunction(() => /\/__drive\/file-/.test(document.querySelector('[data-product-form] [name="image"]').value), null, { timeout: 15000 });
  await page.click('[data-product-form] [type="submit"]');
  await page.waitForSelector('[data-product-row="pita-sa-spanacem"]');
  await page.uncheck('[data-flag="available"][data-id="pomfrit-mali"]');
  await page.waitForFunction(() => document.querySelector('[data-product-row="pomfrit-mali"]').classList.contains('is-soldout'));
  await shot(page, '07a-admin-products');
  await adminView(page, 'kategorije');
  await page.click('[data-edit-category=""]');
  await page.fill('[data-category-form] [name="name"]', 'Deserti');
  await page.click('[data-category-form] [type="submit"]');
  await page.waitForFunction(() => /Deserti/.test(document.querySelector('[data-view]').textContent));
  await adminView(page, 'dodaci');
  await page.click('[data-edit-option=""][data-group="dodaci"]');
  await page.fill('[data-option-form] [name="name"]', 'Extra sir');
  await page.fill('[data-option-form] [name="price"]', '120');
  await page.click('[data-option-form] [type="submit"]');
  await page.waitForFunction(() => /Extra sir/.test(document.querySelector('[data-view]').textContent));
  await shot(page, '07a-admin-addons');
  const menu = await newPage(mobile);
  await openMenu(menu);
  expect(/690/.test(await menu.textContent('[data-product="klasik"]')), 'new price not on the menu');
  expect(await menu.locator('[data-product="pomfrit-mali"]').evaluate((n) => n.classList.contains('is-unavailable')), 'sold-out not on the menu');
  const pita = menu.locator('[data-product="pita-sa-spanacem"]');
  await pita.waitFor();
  expect(/280/.test(await pita.textContent()), 'new product price');
  expect(await pita.locator('img').getAttribute('src').then((s) => /\/__drive\/file-/.test(s)), 'uploaded photo not used on the menu');
  await openSheet(menu, 'klasik');
  expect(await menu.$('.sheet input[value="dodaci-extra-sir"]'), 'new add-on not in the product sheet');
  await menu.click('.sheet label:has(input[value="dodaci-extra-sir"]) .chip');
  expect(nbsp(await menu.textContent('.sheet [data-add-price]')) === '810 RSD', 'add-on price not applied');
  await shot(menu, '07a-menu-after-edits');
  await menu.keyboard.press('Escape');
  await setCell('PRODUCTS', 'id', 'pomfrit-mali', 'available', 'TRUE');
  note('Klasik 620 → 690 · nova „Pita sa spanaćem“ 280 RSD sa fotografijom sa Drive-a · Pomfrit mali rasprodat · kategorija Deserti · dodatak Extra sir +120 odmah u meniju');
});

await test('Tok 7b — admin: zona i cena dostave, radno vreme sa pauzom, pauza svih porudžbina, dostave, preuzimanja, procene', async () => {
  const page = await newPage(desktop);
  await adminLogin(page);
  await adminView(page, 'zone');
  await page.click('[data-edit-zone="ns-grad"]');
  await page.fill('[data-zone-form] [name="fee"]', '300');
  await page.fill('[data-zone-form] [name="minOrder"]', '600');
  await page.click('[data-zone-form] [type="submit"]');
  await page.waitForFunction(() => /300 RSD · min\. 600 RSD/.test(document.querySelector('[data-view]').textContent.replace(/ /g, ' ')));
  await shot(page, '07b-admin-zones');
  const guest = await newPage(mobile);
  await openMenu(guest);
  await guest.click('[data-add="pomfrit-feta"]');
  await guest.click('[data-order-bar-link]');
  await guest.waitForSelector('.drawer.is-open');
  await guest.selectOption('#drawer-zone', { label: 'Centar' });
  await guest.waitForFunction(() => /Dodajte još 240 RSD/.test(document.querySelector('.drawer').textContent) && /300/.test(document.querySelector('.drawer .totals').textContent));
  await adminView(page, 'radno-vreme');
  await page.fill('[name="d3.break_start"]', '15:00');
  await page.fill('[name="d3.break_end"]', '16:00');
  await page.uncheck('[name="d6.open_day"]');
  await page.click('[data-hours-form] [type="submit"]');
  await page.waitForFunction(() => /Radno vreme je sačuvano/.test(document.body.textContent));
  await shot(page, '07b-admin-hours');
  const hours = (await state()).sheets.HOURS;
  expect(hours.find((h) => h.dow === 3).break_start === '15:00' && hours.find((h) => h.dow === 6).closed === true, 'hours not saved');
  const brk = await newPage(mobile);
  await openMenu(brk, '2026-09-23T15:20:00+02:00');
  await brk.waitForFunction(() => /Pauza je u toku/.test(document.querySelector('[data-closed-notice]').textContent));
  await adminView(page, 'porucivanje');
  await page.uncheck('[data-setting-toggle="delivery_enabled"]');
  await page.waitForFunction(() => /Isključena/.test(document.querySelector('[data-view]').textContent));
  const nd = await newPage(mobile);
  await openMenu(nd);
  expect(/trenutno isključeno/.test(await nd.textContent('[data-mode-meta="delivery"]')) && (await nd.isChecked('[data-mode-switch] input[value="pickup"]')), 'delivery off not reflected');
  await page.check('[data-setting-toggle="delivery_enabled"]');
  await page.waitForTimeout(400);
  await page.uncheck('[data-setting-toggle="pickup_enabled"]');
  await page.waitForTimeout(400);
  const np = await newPage(mobile);
  await openMenu(np);
  expect(/trenutno isključeno/.test(await np.textContent('[data-mode-meta="pickup"]')), 'pickup off not reflected');
  await page.check('[data-setting-toggle="pickup_enabled"]');
  await page.waitForTimeout(400);
  await page.uncheck('[data-setting-toggle="ordering_enabled"]');
  await page.waitForFunction(() => document.body.classList.contains('is-paused'));
  await shot(page, '07b-admin-paused');
  const paused = await newPage(mobile);
  await openMenu(paused);
  await paused.waitForSelector('[data-closed-notice]:not([hidden])');
  expect(/Trenutno ne primamo porudžbine/.test(await paused.textContent('[data-closed-notice]')), 'global pause not on the menu');
  const blocked = await apiOrder();
  expect(!blocked.ok && blocked.error.code === 'CLOSED', 'server accepted an order while paused');
  await page.check('[data-setting-toggle="ordering_enabled"]');
  await page.waitForFunction(() => !document.body.classList.contains('is-paused'));
  await adminView(page, 'procene');
  await page.fill('#s-pickup_eta_min', '20');
  await page.fill('#s-pickup_eta_max', '40');
  await page.fill('#s-delivery_eta_min', '50');
  await page.fill('#s-delivery_eta_max', '70');
  await page.click('[data-view] [data-settings-form] [type="submit"]');
  await page.waitForFunction(() => /Sačuvano/.test(document.body.textContent));
  const est = await newPage(mobile);
  await openMenu(est);
  const meta = nbsp(await est.textContent('[data-mode-switch]'));
  expect(/50–70 min/.test(meta) && /20–40 min/.test(meta), 'new estimates not on the menu: ' + meta);
  const ok = await apiOrder();
  expect(ok.ok && ok.data.etaMin === 20 && ok.data.etaMax === 40, 'new estimate not used by the server');
  await page.fill('#s-pickup_eta_max', '5');
  await page.click('[data-view] [data-settings-form] [type="submit"]');
  await page.waitForSelector('[data-field="pickup_eta_min"].has-error');
  expect(/„od“ ne može biti veće od „do“/.test(await page.textContent('[data-field="pickup_eta_min"] .field__error')), 'min > max not explained');
  // Restore defaults for the rest of the run.
  await getJSON(`${BASE}/api${q()}`, {
    method: 'POST',
    body: JSON.stringify({ action: 'admin.settings.save', payload: { token: await page.evaluate(() => JSON.parse(localStorage.getItem('gg:admin:v1')).token), changes: { pickup_eta_min: 15, pickup_eta_max: 30, delivery_eta_min: 45, delivery_eta_max: 60 } } })
  });
  await setCell('HOURS', 'dow', '3', 'break_start', '');
  await setCell('HOURS', 'dow', '3', 'break_end', '');
  await setCell('HOURS', 'dow', '6', 'closed', 'FALSE');
  await setCell('ZONES', 'id', 'ns-grad', 'fee', '250');
  await setCell('ZONES', 'id', 'ns-grad', 'min_order', '500');
  note('Zona Novi Sad — grad: 300 RSD, min 600 → korpa traži još 240 RSD · pauza 15–16 i subota zatvorena · dostava/preuzimanje/sve porudžbine isključeni i uključeni · procene 20–40 / 50–70 na sajtu i serveru · „od > do“ odbijeno');
});

// -----------------------------------------------------------------------------
// FLOW 8 — contact + job application
// -----------------------------------------------------------------------------
await test('Tok 8 — kontakt forma i prijava za posao sa CV-jem', async () => {
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
  await shot(page, '08-job-success');
  const s = await state();
  expect(s.sheets.CONTACT.length === 1 && s.sheets.JOBS.length === 1 && /drive\.google\.com/.test(s.sheets.JOBS[0].CV), 'forms not stored');
});

// -----------------------------------------------------------------------------
// FLOW 9 — responsive + accessibility audit (site pages and every admin section)
// -----------------------------------------------------------------------------
const AUDIT = () => {
  const out = [];
  const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  if (overflow > 0) out.push(`overflow ${overflow}px`);
  if (!document.documentElement.lang) out.push('no lang');
  document.querySelectorAll('img').forEach((i) => !i.hasAttribute('alt') && out.push('img without alt'));
  document.querySelectorAll('button, a[href]').forEach((b) => {
    const name = (b.getAttribute('aria-label') || b.textContent || '').trim();
    if (!name && b.offsetParent !== null) out.push(`unnamed ${b.tagName.toLowerCase()} ${b.className}`);
  });
  document.querySelectorAll('input:not([type=hidden]), select, textarea').forEach((f) => {
    if (f.closest('.hp') || f.hidden) return;
    const labelled = f.labels?.length || f.getAttribute('aria-label') || f.getAttribute('aria-labelledby');
    if (!labelled) out.push(`unlabelled ${f.name || f.id}`);
  });
  return out;
};

const PAGES = ['/', '/meni/', '/porudzbina/', '/o-nama/', '/dostava/', '/kontakt/', '/posao/', '/privatnost/', '/404.html', '/admin/'];
const WIDTHS = [375, 390, 430, 768, 1024, 1440, 1920];
await test('Tok 9 — responsive 375–1920 px i audit pristupačnosti (10 stranica × 7 širina)', async () => {
  const problems = [];
  for (const width of WIDTHS) {
    const page = await newPage({ viewport: { width, height: width < 700 ? 844 : 900 }, isMobile: width < 700, hasTouch: width < 700, reducedMotion: 'reduce' });
    for (const p of PAGES) {
      const res = await page.goto(BASE + p);
      if (p !== '/404.html' && res.status() !== 200) problems.push(`${p} → HTTP ${res.status()}`);
      await page.waitForTimeout(250);
      const audit = await page.evaluate(AUDIT);
      const h1 = await page.evaluate(() => document.querySelectorAll('h1').length);
      if (p !== '/admin/' && h1 !== 1) audit.push(`${h1} h1`);
      if (p !== '/admin/' && !(await page.$('main'))) audit.push('no main');
      if (audit.length) problems.push(`${p} @${width}: ${audit.join('; ')}`);
      if (p === '/' || p === '/meni/' || p === '/porudzbina/') await shot(page, `09-${p.replace(/\W+/g, '') || 'home'}-${width}`);
    }
    if (page.errors.length) problems.push(`@${width} console: ${page.errors.join(' | ')}`);
    if (page.badRequests.length) problems.push(`@${width} network: ${[...new Set(page.badRequests)].join(' | ')}`);
    await page.context().close();
  }
  note(problems.length ? problems.join('\n') : `0 problema na ${PAGES.length * WIDTHS.length} kombinacija stranica × širina`);
  expect(problems.length === 0, problems.slice(0, 6).join(' || '));
});

const ADMIN_VIEWS = ['pregled', 'nove', 'aktivne', 'istorija', 'proizvodi', 'kategorije', 'dodaci', 'zone', 'radno-vreme', 'porucivanje', 'procene', 'utisci', 'podesavanja'];
await test('Tok 9b — admin na telefonu, tabletu i desktopu: 13 sekcija bez preliva, sva polja sa oznakom', async () => {
  const problems = [];
  for (const [label, opts] of [['390', mobile], ['1024', tablet], ['1440', desktop]]) {
    const page = await newPage(opts);
    await adminLogin(page);
    for (const v of ADMIN_VIEWS) {
      await adminView(page, v);
      await page.waitForTimeout(150);
      const audit = await page.evaluate(AUDIT);
      if (audit.length) problems.push(`#${v} @${label}: ${audit.join('; ')}`);
      if (['nove', 'proizvodi', 'radno-vreme', 'porucivanje'].includes(v)) await shot(page, `09b-admin-${v}-${label}`, { fullPage: v !== 'radno-vreme' });
    }
    await adminView(page, 'proizvodi');
    await page.click('[data-edit-product="atina"]');
    await page.waitForSelector('.admin-drawer.is-open [data-product-form]');
    const drawer = await page.evaluate(AUDIT);
    if (drawer.length) problems.push(`product editor @${label}: ${drawer.join('; ')}`);
    if (label === '390') await shot(page, '09b-admin-editor-390');
    if (page.errors.length) problems.push(`@${label} console: ${page.errors.join(' | ')}`);
    if (page.badRequests.length) problems.push(`@${label} network: ${[...new Set(page.badRequests)].join(' | ')}`);
    await page.context().close();
  }
  note(problems.length ? problems.join('\n') : `0 problema: 13 sekcija + editor × 3 širine`);
  expect(problems.length === 0, problems.slice(0, 6).join(' || '));
});

await test('Tok 9c — tastatura: skip link, fokus u sheet-u, Escape zatvara, fokus se vraća', async () => {
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
// FLOW 10 — performance on the production build (throttled phone)
// -----------------------------------------------------------------------------
await test('Tok 10 — performanse produkcionog builda: telefon, Fast 4G, CPU 4× sporiji', async () => {
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
