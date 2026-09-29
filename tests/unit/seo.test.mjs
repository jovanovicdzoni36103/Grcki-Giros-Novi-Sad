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

test('robots and sitemap: private pages excluded', { skip }, () => {
  const robots = read('robots.txt');
  assert.match(robots, /Disallow: \/panel\//);
  assert.match(robots, /Disallow: \/porudzbina\//);
  const sitemap = read('sitemap.xml');
  assert.ok(!sitemap.includes('/panel/') && !sitemap.includes('/porudzbina/') && !sitemap.includes('404'));
  assert.equal((sitemap.match(/<url>/g) || []).length, PUBLIC.length);
  assert.match(read('panel/index.html'), /<meta name="robots" content="noindex, nofollow">/);
});
