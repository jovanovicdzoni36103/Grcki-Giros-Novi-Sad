// Step-by-step trace of flow 1 against a running dev server (node tests/e2e/debug-flow1.mjs [port]).
import { chromium } from 'playwright-core';

const port = process.argv[2] || 5190;
const BASE = `http://localhost:${port}`;
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: process.argv.includes('--motion') ? 'no-preference' : 'reduce' });
const page = await ctx.newPage();
page.on('console', (m) => console.log('  [console]', m.type(), m.text()));
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
const step = async (label, fn) => {
  try {
    await fn();
    console.log('ok  ', label);
  } catch (e) {
    console.log('FAIL', label, '->', e.message.split('\n')[0]);
    await page.screenshot({ path: 'tests/e2e/artifacts/debug-fail.png' });
    await browser.close();
    process.exit(1);
  }
};
await step('home', () => page.goto(`${BASE}/?__now=${encodeURIComponent('2026-09-23T14:23:00+02:00')}`));
await step('hero CTA', () => page.click('.hero [data-order-cta]', { timeout: 5000 }));
await step('url meni', () => page.waitForURL('**/meni/', { timeout: 5000 }));
await step('mode switch rendered', () => page.waitForSelector('[data-mode-switch] input', { state: 'attached', timeout: 5000 }));
await step('open klasik', () => page.click('[data-open-product="klasik"]', { timeout: 5000 }));
await step('sheet open', () => page.waitForSelector('.sheet.is-open [data-sheet-add]', { timeout: 5000 }));
await step('toggle luk', () => page.click('.sheet label:has(input[value="sal-luk"]) .chip', { timeout: 5000 }));
await step('extra meso', () => page.click('.sheet label:has(input[value="dod-meso"]) .chip', { timeout: 5000 }));
await step('qty+', () => page.click('.sheet [data-qty="1"]', { timeout: 5000 }));
console.log('     price:', await page.textContent('.sheet [data-add-price]'));
await step('add', () => page.click('.sheet.is-open [data-sheet-add]', { timeout: 5000 }));
await step('sheet closed', () => page.waitForSelector('.sheet:not(.is-open)', { state: 'attached', timeout: 5000 }));
await step('add coca', () => page.click('[data-add="coca-cola"]', { timeout: 5000 }));
console.log('     count:', await page.textContent('[data-cart-count]'));
await browser.close();
