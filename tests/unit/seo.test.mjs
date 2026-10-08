// Checks the built HTML (run `npm run build` first; skipped when dist/ is missing).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../dist');
const PUBLIC = ['index.html', 'meni/index.html', 'o-nama/index.html', 'dostava/index.html', 'kontakt/index.html', 'posao/index.html', 'privatnost/index.html'];
const read = (p) => readFileSync(path.join(dist, p), 'utf8');
const skip = !existsSync(path.join(dist, 'index.html'));

test('every public page has a unique title, description, one h1, canonical and OG tags', { skip }, () => {
  const titles = new Set();
  const descriptions = new Set();
  for (const p of PUBLIC) {
    const html = read(p);
    const title = html.match(/<title>([^<]+)<\/title>/)[1];
    const desc = html.match(/<meta name="description" content="([^"]+)"/)[1];
    assert.ok(title.length >= 15 && title.length <= 70, `${p} title length ${title.length}`);
    assert.ok(desc.length >= 70 && desc.length <= 170, `${p} description length ${desc.length}`);
    titles.add(title);
    descriptions.add(desc);
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, `${p} h1 count`);
    assert.match(html, /<link rel="canonical" href="https:\/\/grckigiros\.rs\//);
    assert.match(html, /<meta property="og:image" content="https:\/\/grckigiros\.rs\/assets\/img\/og\.png">/);
    assert.match(html, /<html lang="sr-Latn"/);
  }
  assert.equal(titles.size, PUBLIC.length);
  assert.equal(descriptions.size, PUBLIC.length);
});

test('JSON-LD parses and carries the expected types', { skip }, () => {
  const types = {};
  for (const p of PUBLIC) {
    for (const m of read(p).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      const obj = JSON.parse(m[1]);
      [].concat(obj['@type']).forEach((t) => (types[t] = (types[t] || 0) + 1));
    }
  }
  for (const t of ['Restaurant', 'FoodEstablishment', 'Menu', 'FAQPage', 'JobPosting', 'BreadcrumbList']) assert.ok(types[t], `missing ${t}`);
  const restaurant = JSON.parse(read('index.html').match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(restaurant.address.streetAddress, 'Dimitrija Tucovića 3');
  assert.equal(restaurant.telephone, '+381642274334');
  assert.ok(restaurant.openingHoursSpecification.length >= 12, 'Mon–Sat 09–01 split across midnight');
  assert.ok(!restaurant.openingHoursSpecification.some((s) => s.dayOfWeek === 'Sunday' && s.opens === '09:00'), 'Sunday must not open');
});

test('menu is in the HTML without JavaScript (PDF: radi bez JS-a za osnovni prikaz)', { skip }, () => {
  // Whatever menu the build was made from (real or the test fixture): every product with its price is in the HTML.
  const html = read('meni/index.html').replace(/\u00a0/g, ' ');
  const snapshot = JSON.parse(read('assets/data/snapshot.json'));
  const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  for (const p of snapshot.catalog.products) {
    assert.ok(html.includes(escape(p.name)), p.name);
    assert.ok(html.includes(String(p.price).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' RSD'), `${p.name}: ${p.price} RSD`);
  }
});

test('robots and sitemap: the public pages, nothing of the old ordering or admin', { skip }, () => {
  assert.match(read('robots.txt'), /^User-agent: \*\nAllow: \/\n\nSitemap: /);
  const sitemap = read('sitemap.xml');
  assert.ok(!sitemap.includes('/panel/') && !sitemap.includes('/porudzbina/') && !sitemap.includes('/admin/') && !sitemap.includes('404'));
  assert.equal((sitemap.match(/<url>/g) || []).length, PUBLIC.length);
  for (const gone of ['porudzbina/index.html', 'admin/index.html', 'panel/index.html']) assert.ok(!existsSync(path.join(dist, gone)), gone);
});

// Client brief of 2026-10-06: a presentational site. The only form is the job application, nothing can be
// ordered online, and the copy follows the brief (location, terminology, no em dash).
test('presentational site: no ordering anywhere, the job form is the only form, copy as briefed', { skip }, () => {
  const FORBIDDEN = [
    /data-(open-product|add|cart|order)/, /order-bar/, /\/porudzbina\//, /korp[aeiu]\b/i, /naruči/i, /naručite/i, /poruči online/i, /\bonline\b/i,
    /pita stiže iz atine/i, /meso sa ražnja/i, /ista pita, isti ukus/i, /caciki/i, /tucana žuta/i, /15–30/, /cena po zoni/i,
    /dostava 250/i, /minimaln/i, /dostavljate do mene/i, /koliko košta dostava/i, /kod stadiona/i, /—/, /zakaž/i, /OrderAction/
  ];
  for (const p of [...PUBLIC, '404.html']) {
    const html = read(p);
    for (const re of FORBIDDEN) assert.ok(!re.test(html), `${p}: ${re} → ${(html.match(re) || [])[0]}`);
    assert.equal((html.match(/<form[\s>]/g) || []).length, p === 'posao/index.html' ? 1 : 0, `${p}: forms`);
    assert.match(html, /<h2>Lokacija<\/h2>/, `${p}: footer Lokacija`);
    assert.match(html, /ispod stadiona/, `${p}: ispod stadiona`);
  }
  const jobs = read('posao/index.html');
  assert.ok(!/\srequired[\s>=]/.test(jobs), 'no required field');
  for (const name of ['name', 'email', 'phone', 'position', 'message', 'cv']) assert.match(jobs, new RegExp(`name="${name}"`), name);
  assert.match(jobs, /CV<span class="optional">opciono/);
  assert.ok(!/063 877 33 63|Telefon za posao/.test(jobs), 'no job phone');
  assert.match(read('index.html'), /<h1[^>]*><span class="accent">Pravi Grčki Giros<\/span><\/h1>/);
  assert.ok(!/\.(webp|jpe?g)"/.test(read('meni/index.html')), 'no food photos on the menu');
});
