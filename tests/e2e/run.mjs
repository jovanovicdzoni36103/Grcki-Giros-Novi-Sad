// End-to-end tests in a real browser (local Chrome) against the real Apps Script code in the emulator.
//   npm run test:e2e            (builds, starts its own servers on 5191/5192, writes tests/e2e/artifacts/)
// The presentational site of the 2026-10-06 brief, on the shop's real menu (data/seed.json): home with the logo
// seal, the menu without any ordering, the job application (the only form) with and without a CV, every link,
// responsive widths with an accessibility audit, keyboard, animations and a throttled performance check.
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
const NOW = '2026-10-06T14:00:00+02:00'; // Tuesday, open 09:00–01:00
const SUNDAY = '2026-10-11T12:00:00+02:00';
const q = (now = NOW) => `?__now=${encodeURIComponent(now)}`;
const PHONE = 'tel:+381642274334';
const EMAIL = 'nikola.jovanovic.mef@gmail.com';
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');

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
const nbsp = (s) => String(s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

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
execFileSync(process.execPath, [path.join(root, 'tools/build.mjs'), '--out', 'dist-prod', '--local-api'], { cwd: root, stdio: 'inherit' });

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
const tablet = { viewport: { width: 768, height: 1024 }, hasTouch: true, reducedMotion: 'reduce' };
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
  page.on('requestfailed', (r) => r.url().startsWith(BASE) && !/\/api(\?|$)|\/__/.test(r.url()) && !/ERR_ABORTED/.test(r.failure()?.errorText || '') && page.badRequests.push(`failed ${r.url().replace(BASE, '')}`));
  return page;
}

const clean = (page) => expect(!page.errors.length && !page.badRequests.length, 'console/network: ' + [...page.errors, ...new Set(page.badRequests)].join(' | '));
/** Wait until the live bootstrap from the (emulated) Apps Script has been applied. */
const live = (page) => page.waitForFunction(() => window.GG_READY && performance.getEntriesByType('resource').some((r) => /\/api\?/.test(r.name) && r.responseEnd > 0), null, { timeout: 15000 });

const PAGES = ['/', '/meni/', '/o-nama/', '/dostava/', '/kontakt/', '/posao/', '/privatnost/', '/404.html'];
// Brief of 2026-10-06: nothing of the old ordering and none of the removed copy, in what the guest sees.
const FORBIDDEN = [
  /naruči/i, /poruči online/i, /\bonline\b/i, /korp[aeiu]\b/i, /pita stiže iz atine/i, /meso sa ražnja/i, /ista pita, isti ukus/i, /caciki/i,
  /tucana žuta/i, /15–30/, /cena po zoni/i, /dostava 250/i, /minimaln/i, /dostavljate do mene/i, /koliko košta dostava/i, /kod stadiona/i, /—/, /zakaž/i
];

// -----------------------------------------------------------------------------
await test('Tok 1: početna. „Pravi Grčki Giros“ plavo bez tačke, pečat sa logom, bez poručivanja, status po radnom vremenu', async () => {
  for (const [label, opts] of [['390', mobile], ['768', tablet], ['1440', desktop]]) {
    const page = await newPage(opts);
    await page.goto(`${BASE}/${q()}`);
    await page.waitForFunction(() => /^Otvoreno do 01:00$/.test(document.querySelector('[data-hero-status] [data-status-text]')?.textContent || ''));
    const h1 = await page.$eval('h1', (h) => ({ text: h.textContent.trim(), color: getComputedStyle(h.querySelector('.accent')).color }));
    expect(h1.text === 'Pravi Grčki Giros' && h1.color === 'rgb(27, 79, 140)', `h1 "${h1.text}" ${h1.color}`);
    const seals = await page.$$eval('.stamp', (els) => els.map((s) => ({ text: s.querySelector('textPath').textContent, logo: s.querySelector('.stamp__core img')?.getAttribute('src') })));
    expect(seals.length === 2 && seals.every((s) => s.text === 'Grčki Giros, Friends & Food • ' && s.logo === '/assets/img/logo-112.png'), 'seals: ' + JSON.stringify(seals));
    expect(!(await page.$('form, [data-cart-open], .order-bar, [data-open-product], [data-add]')), 'ordering UI on the home page');
    const call = await page.$eval(label === '1440' ? '.header-cta' : '.header-call', (a) => [a.getAttribute('href'), getComputedStyle(a).display !== 'none']);
    expect(call[0] === PHONE && call[1], 'header call: ' + call);
    const ctas = await page.$$eval('.hero__ctas a', (as) => as.map((a) => a.getAttribute('href')));
    expect(ctas.join() === '/meni/,/kontakt/', 'hero CTAs: ' + ctas);
    const text = await page.evaluate(() => document.body.innerText);
    expect(/ispod stadiona „?Karađorđe/i.test(text) && /Preuzimanje 5–30 min/.test(text) && /vertikalnom ražnju/.test(text), 'location / pickup time / hero text');
    await shot(page, `01-home-${label}`);
    clean(page);
    await page.context().close();
  }
  const page = await newPage(desktop);
  await page.goto(`${BASE}/${q(SUNDAY)}`);
  await page.waitForFunction(() => /^Zatvoreno · otvaramo sutra u 09:00$/.test(document.querySelector('[data-status-text]')?.textContent || ''));
  note('Utorak 14:00 → „Otvoreno do 01:00“ · nedelja 12:00 → „Zatvoreno · otvaramo sutra u 09:00“');
  await page.context().close();
});

await test('Tok 2: meni. Ilustracije (bez fotografija), izbori za giros, piće sa zapreminom, Extra meso, posni vege, filter', async () => {
  const page = await newPage(mobile);
  await page.goto(`${BASE}/meni/${q()}`);
  await live(page);
  await page.waitForTimeout(400);
  const cats = await page.$$eval('[data-cat-nav] .chip', (els) => els.map((e) => e.textContent.replace(/\d+/g, '').trim()));
  expect(cats.join('|') === 'Giros|Akcije|Sa roštilja|Prilozi|Piće', 'categories: ' + cats.join('|'));
  const rows = await page.$$eval('[data-product]', (els) =>
    els.map((e) => ({ id: e.dataset.product, name: e.querySelector('.product__name').textContent, desc: e.querySelector('.product__desc')?.textContent || '', price: e.querySelector('.product__price').textContent, img: !!e.querySelector('img'), art: !!e.querySelector('svg.art use'), buttons: e.querySelectorAll('button').length }))
  );
  const row = (id) => rows.find((r) => r.id === id) || {};
  expect(rows.length === 28, 'products: ' + rows.length);
  expect(rows.every((r) => !r.img && r.art && !r.buttons), 'a product row has a photo or a button');
  expect(nbsp(row('extra-meso').price) === '330 RSD' && row('extra-meso').desc === '100 g mesa.', 'Extra meso: ' + JSON.stringify(row('extra-meso')));
  expect(row('coca-cola-zero').name === 'Coca-Cola Zero' && row('coca-cola-zero').desc === 'Limenka / 0,33 l', 'Coca-Cola Zero: ' + JSON.stringify(row('coca-cola-zero')));
  const drinks = rows.filter((r) => ['coca-cola', 'coca-cola-zero', 'fanta', 'sprite', 'schweppes', 'ultra', 'joy', 'rosa', 'knjaz-milos', 'pivo-alfa', 'pivo-tuborg', 'pivo-lav'].includes(r.id));
  expect(drinks.length === 12 && drinks.every((d) => !/\d,\d/.test(d.name) && /\d,\d+ l/.test(d.desc)), 'drinks: ' + drinks.map((d) => `${d.name} [${d.desc}]`).join(', '));
  expect(['vege-veliki', 'vege-mali'].every((id) => /^Posni giros\./.test(row(id).desc)), 'vege not marked posni');
  expect(/Tirokafteri ili urnebes|tirokafteri ili urnebes/.test(row('premaz-100').desc) && /^Tzatziki/.test(row('premaz-100').desc), 'premaz 100 g: ' + row('premaz-100').desc);
  const choices = nbsp(await page.textContent('.menu-choices'));
  expect(/Tzatziki/.test(choices) && /Tucana ljuta paprika/.test(choices) && /Pileće, Svinjsko, Mix/.test(choices), 'giros choices: ' + choices);
  await page.click('[data-filter="vegetarian"]');
  const vege = await page.$$eval('[data-product]:not([hidden])', (els) => els.map((e) => e.dataset.product));
  expect(vege.join() === 'vege-veliki,vege-mali', 'filter: ' + vege);
  await page.click('[data-filter="vegetarian"]');
  expect((await page.$$('[data-product]:not([hidden])')).length === 28, 'filter off');
  await page.click('[data-cat-link="pice"]');
  await page.waitForTimeout(600);
  await shot(page, '02-menu-pice-390');
  await page.locator('#kat-giros').scrollIntoViewIfNeeded();
  await shot(page, '02-menu-giros-390');
  note(`28 proizvoda, 0 fotografija, 0 dugmadi za poručivanje · Extra meso 330 RSD · ${drinks.length} pića sa zapreminom u opisu`);
  clean(page);
  await page.context().close();
});

await test('Tok 3: prijava za posao. Loš telefon i loš fajl se ne šalju; prijava sa CV-jem i prazna prijava stižu samo na EMAIL_1', async () => {
  await setCell('SETTINGS', 'key', 'EMAIL_1', 'value', EMAIL);
  await setCell('SETTINGS', 'key', 'EMAIL_2', 'value', '');
  const page = await newPage(mobile);
  await page.goto(`${BASE}/posao/`);
  const html = await page.content();
  expect(!/\srequired[\s>=]/.test(html) && !/063 877 33 63|Telefon za posao/.test(html), 'required field or job phone on the page');
  await page.fill('#j-phone', '12');
  await page.waitForTimeout(2600);
  await page.click('[data-job-form] [type="submit"]');
  await page.waitForSelector('[data-field="phone"].has-error');
  await page.fill('#j-phone', '');
  await page.setInputFiles('[name="cv"]', { name: 'cv.exe', mimeType: 'application/x-msdownload', buffer: PDF });
  await page.waitForSelector('[data-field="cv"].has-error');
  await shot(page, '03-job-errors-390', { fullPage: true });
  expect((await state()).sheets.JOBS.length === 0, 'an invalid application was stored');
  await page.fill('#j-name', 'Stefan Nikolić');
  await page.fill('#j-email', 'stefan@example.com');
  await page.fill('#j-phone', '065 222 3344');
  await page.fill('#j-position', 'Prodavac-kuvar, druga smena');
  await page.fill('#j-message', 'Radio sam dve godine u pekari.');
  await page.setInputFiles('[name="cv"]', { name: 'cv.pdf', mimeType: 'application/pdf', buffer: PDF });
  await page.click('[data-job-form] [type="submit"]');
  await page.waitForSelector('.form-success');
  const ok1 = nbsp(await page.innerText('.form-success'));
  expect(/Hvala, Stefan\. Vlasnik vam se javlja na 065 222 3344/.test(ok1), 'success text: ' + ok1);
  await shot(page, '03-job-success-cv-390');

  const empty = await newPage(desktop);
  await empty.goto(`${BASE}/posao/`);
  await empty.waitForTimeout(2600);
  await empty.click('[data-job-form] [type="submit"]');
  await empty.waitForSelector('.form-success');
  const ok2 = nbsp(await empty.innerText('.form-success'));
  expect(/^Prijava je stigla\. Hvala\.$/i.test(ok2), 'empty success text: ' + ok2);
  await shot(empty, '03-job-success-empty-1440');

  const s = await state();
  const [withCv, blank] = s.sheets.JOBS;
  expect(s.sheets.JOBS.length === 2, 'JOBS rows: ' + s.sheets.JOBS.length);
  expect(/drive\.google\.com/.test(withCv.CV) && withCv.Position === 'Prodavac-kuvar, druga smena' && withCv.Phone === '+381652223344', 'with CV: ' + JSON.stringify(withCv));
  expect(blank.Name === '' && blank.Phone === '' && blank.Email === '' && blank.CV === '' && blank.Position === 'Prodavac-kuvar', 'empty: ' + JSON.stringify(blank));
  const staff = s.outboxMails.filter((m) => /^Prijava za posao: /.test(m.subject));
  expect(staff.length === 2 && staff.every((m) => m.to === EMAIL), 'staff mails: ' + JSON.stringify(staff));
  expect(staff[0].attachments.length === 1 && staff[1].attachments.length === 0, 'CV attachment: ' + JSON.stringify(staff.map((m) => m.attachments)));
  expect(s.outboxMails.some((m) => m.to === 'stefan@example.com'), 'candidate confirmation');
  note(`Prijava sa CV-jem i prazna prijava: 2 reda u JOBS, 2 mejla samo na ${EMAIL} (CV u prilogu prvog), potvrda kandidatu sa emailom`);
  clean(page);
  clean(empty);
  await page.context().close();
  await empty.context().close();
});

await test('Tok 4: svi linkovi i dugmad. Interni rade, telefon i email tačni, nijedno dugme ne vodi u prazno', async () => {
  const page = await newPage(desktop);
  const links = new Map();
  const problems = [];
  const BUTTONS = ['[data-nav-toggle]', '[data-load-map]', '[data-filter]', '[data-clear-filter]', '[data-job-form] [type="submit"]'];
  for (const p of PAGES) {
    await page.goto(BASE + p + q());
    await live(page).catch(() => {});
    for (const href of await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')))) links.set(href, p);
    const stray = await page.$$eval('button', (bs, allowed) => bs.filter((b) => !allowed.some((s) => b.matches(s))).map((b) => b.outerHTML.slice(0, 90)), BUTTONS);
    if (stray.length) problems.push(`${p}: ${stray.join(' | ')}`);
  }
  for (const [href, from] of links) {
    if (href.startsWith('tel:')) href !== PHONE && problems.push(`${from}: ${href}`);
    else if (href.startsWith('mailto:')) href !== `mailto:${EMAIL}` && problems.push(`${from}: ${href}`);
    else if (href.startsWith('#')) {
      await page.goto(BASE + from);
      if (!(await page.$(href))) problems.push(`${from}: ${href} has no target`);
    } else if (href.startsWith('/')) {
      const [file, hash] = href.split('#');
      const res = await fetch(BASE + file);
      if (res.status !== 200) problems.push(`${from}: ${href} → ${res.status}`);
      if (hash && !(await res.text()).includes(`id="${hash}"`)) problems.push(`${from}: ${href} has no #${hash}`);
      if (/porudzbina|admin|panel/.test(href)) problems.push(`${from}: ${href}`);
    } else if (!/^https:\/\/(www\.google\.com\/maps\/|(www\.)?instagram\.com\/)/.test(href)) problems.push(`${from}: external ${href}`);
  }
  await page.goto(`${BASE}/kontakt/`);
  await page.click('[data-load-map]');
  expect(/maps\.google\.com\/maps\?q=/.test(await page.getAttribute('[data-map] iframe', 'src')), 'map loads on demand');
  note(`${links.size} različitih linkova na ${PAGES.length} stranica; dugmad samo: meni na telefonu, mapa, filter, slanje prijave`);
  expect(problems.length === 0, problems.slice(0, 6).join(' || '));
  await page.context().close();
});

// -----------------------------------------------------------------------------
// FLOW 5: responsive + accessibility audit + the copy as the guest sees it (after the live refresh)
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

const WIDTHS = [375, 390, 430, 768, 1024, 1440, 1920];
await test(`Tok 5: responsive 375–1920 px, audit pristupačnosti i tekst bez zabranjenih izraza (${PAGES.length} stranica × ${WIDTHS.length} širina)`, async () => {
  const problems = [];
  for (const width of WIDTHS) {
    const page = await newPage({ viewport: { width, height: width < 700 ? 844 : 900 }, isMobile: width < 700, hasTouch: width < 700, reducedMotion: 'reduce' });
    for (const p of PAGES) {
      const res = await page.goto(BASE + p + q());
      if (p !== '/404.html' && res.status() !== 200) problems.push(`${p} → HTTP ${res.status()}`);
      await live(page).catch(() => problems.push(`${p} @${width}: no live data`));
      await page.waitForTimeout(150);
      const audit = await page.evaluate(AUDIT);
      const h1 = await page.evaluate(() => document.querySelectorAll('h1').length);
      if (h1 !== 1) audit.push(`${h1} h1`);
      if (!(await page.$('main'))) audit.push('no main');
      if (width === 390) {
        const text = await page.evaluate(() => document.body.innerText + ' ' + document.title + ' ' + document.querySelector('meta[name=description]').content);
        FORBIDDEN.forEach((re) => re.test(text) && audit.push(`copy ${re} → ${text.match(re)[0]}`));
        const forms = await page.$$eval('form', (fs) => fs.map((f) => Object.keys(f.dataset).join()));
        if (forms.join() !== (p === '/posao/' ? 'jobForm' : '')) audit.push('forms: ' + forms);
      }
      if (audit.length) problems.push(`${p} @${width}: ${audit.join('; ')}`);
      if ([390, 768, 1440].includes(width)) await shot(page, `05-${p.replace(/\W+/g, '') || 'home'}-${width}`, { fullPage: true });
    }
    if (page.errors.length) problems.push(`@${width} console: ${page.errors.join(' | ')}`);
    if (page.badRequests.length) problems.push(`@${width} network: ${[...new Set(page.badRequests)].join(' | ')}`);
    await page.context().close();
  }
  note(problems.length ? problems.join('\n') : `0 problema na ${PAGES.length * WIDTHS.length} kombinacija stranica × širina`);
  expect(problems.length === 0, problems.slice(0, 6).join(' || '));
});

await test('Tok 6: tastatura i meni na telefonu. Skip link, fokus ostaje u meniju, Escape zatvara, FAQ se otvara', async () => {
  const page = await newPage(desktop);
  await page.goto(`${BASE}/dostava/`);
  await page.keyboard.press('Tab');
  expect((await page.evaluate(() => document.activeElement.className)).includes('skip-link'), 'first Tab is not the skip link');
  await page.click('.faq details:first-child summary');
  expect(await page.$eval('.faq details:first-child', (d) => d.open), 'FAQ does not open');
  const faq = await page.$$eval('.faq summary', (s) => s.map((x) => x.textContent.trim()));
  expect(faq.length === 9 && !faq.some((x) => /minimal|dostavljate do mene|košta dostava|Atine/i.test(x)), 'FAQ: ' + faq.join(' | '));
  await page.context().close();

  const phone = await newPage(mobile);
  await phone.goto(`${BASE}/`);
  await phone.click('[data-nav-toggle]');
  await phone.waitForSelector('[data-mobile-nav]:not([hidden])');
  for (let i = 0; i < 12; i++) await phone.keyboard.press('Tab');
  expect(await phone.evaluate(() => !!document.activeElement.closest('[data-mobile-nav], [data-header]')), 'focus escaped the open menu');
  await shot(phone, '06-mobile-nav-390');
  await phone.keyboard.press('Escape');
  await phone.waitForSelector('[data-mobile-nav]', { state: 'hidden' });
  note(`FAQ (${faq.length}): ${faq.join(' · ')}`);
  clean(phone);
  await phone.context().close();
});

await test('Tok 7: animacije. Pečat se okreće sa skrolom a logo stoji, koraci „Kako do girosa“ se smenjuju, hover na kartici', async () => {
  const page = await newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(600);
  const before = await page.$eval('.stamp__ring', (r) => r.style.transform);
  await page.evaluate(() => scrollTo(0, 600));
  await page.waitForTimeout(500);
  const after = await page.$eval('.stamp__ring', (r) => r.style.transform);
  const core = await page.$eval('.stamp__core', (c) => getComputedStyle(c).transform);
  expect(after && after !== before && core === 'none', `ring ${before} → ${after}, core ${core}`);
  const steps = [];
  const scene = await page.$eval('[data-steps]', (s) => s.getBoundingClientRect().top + scrollY);
  for (const k of [0.1, 0.45, 0.8]) {
    await page.evaluate(([top, f]) => scrollTo(0, top + f * (document.querySelector('[data-steps]').offsetHeight - innerHeight)), [scene, k]);
    await page.waitForTimeout(500);
    steps.push(await page.$eval('[data-steps]', (s) => [...s.querySelectorAll('[data-step]')].findIndex((x) => x.classList.contains('is-active'))));
  }
  expect(steps.join() === '0,1,2', 'steps: ' + steps);
  await page.locator('.feature-card').first().hover();
  await page.waitForTimeout(400);
  await shot(page, '07-feature-hover-1440');
  note(`Pečat: ${before || 'rotate(0)'} → ${after}; koraci: ${steps.join(' → ')}`);
  clean(page);
  await page.context().close();
});

// -----------------------------------------------------------------------------
// FLOW 8: performance on the production build (throttled phone)
// -----------------------------------------------------------------------------
await test('Tok 8: performanse produkcionog builda. Telefon, Fast 4G, CPU 4× sporiji', async () => {
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
  `# E2E izveštaj, ${new Date().toISOString()}`,
  '',
  `**${passed}/${results.length} prošlo.** Pravi Chrome, pravi Apps Script kod u emulatoru, lokalni server, pravi meni (data/seed.json).`,
  '',
  ...results.flatMap((r) => [`## ${r.ok ? '✔' : '✘'} ${r.name}`, r.error ? `Greška: ${r.error}` : '', ...r.notes.map((n) => `- ${n}`), ...r.shots.map((s) => `- ![](${s})`), ''])
].join('\n');
writeFileSync(path.join(ART, 'e2e-report.md'), md);
console.log(`\n${passed}/${results.length} passed · report: tests/e2e/artifacts/e2e-report.md`);
server.kill();
perfServer.kill();
process.exit(passed === results.length ? 0 : 1);
