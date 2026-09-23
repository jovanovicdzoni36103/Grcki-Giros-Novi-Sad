// Visual review: full-page screenshots cut into viewport-sized slices.
//   node tools/shots.mjs --path / --path /meni/ --width 390 --width 1440 [--base http://localhost:5190] [--motion]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const all = (flag) => args.flatMap((a, i) => (a === flag ? [args[i + 1]] : []));
const base = all('--base')[0] || 'http://localhost:5190';
const paths = all('--path').length ? all('--path') : ['/'];
const widths = (all('--width').length ? all('--width') : ['390', '1440']).map(Number);
const out = all('--out')[0] || path.join(root, 'tests/e2e/artifacts/shots');
const maxSlices = Number(all('--slices')[0] || 8);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome' });
for (const width of widths) {
  const height = width < 700 ? 844 : width < 1100 ? 1024 : 900;
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    reducedMotion: args.includes('--motion') ? 'no-preference' : 'reduce',
    isMobile: width < 700,
    hasTouch: width < 700
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  for (const p of paths) {
    await page.goto(base + p, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    const slug = (p.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home') + '-' + width;
    // Real viewport screenshots while scrolling: fixed/sticky elements render exactly as a visitor sees them.
    const step = Math.round(height * 0.92);
    const n = Math.min(maxSlices, Math.ceil(total / step));
    for (let i = 0; i < n; i++) {
      await page.evaluate((y) => window.scrollTo(0, y), i * step);
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(out, `${slug}-${i}.png`) });
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    console.log(`${slug}: ${n} slices, height ${total}px, horizontal overflow ${overflow}px${errors.length ? ', ERRORS: ' + errors.join(' | ') : ''}`);
    errors.length = 0;
  }
  await context.close();
}
await browser.close();
