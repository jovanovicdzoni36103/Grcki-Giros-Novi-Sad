// Renders every illustration variant to a PNG for visual review: node tools/art-preview.mjs [out.png]
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ART_VARIANTS } from '../src/scripts/ui/art-variants.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sprite = readFileSync(path.join(root, 'src/assets/img/art.svg'), 'utf8');
const font = readFileSync(path.join(root, 'src/assets/fonts/archivo-core.woff2')).toString('base64');
const out = process.argv[2] || path.join(root, 'tests/e2e/artifacts/art-preview.png');

const cells = Object.entries(ART_VARIANTS)
  .map(
    ([key, v]) => `<figure style="--art-bg:${v.bg}"><div class="frame"><svg viewBox="0 0 200 220" style="${v.style || ''}"><use href="#${v.symbol}"/></svg></div><figcaption>${key}</figcaption></figure>`
  )
  .join('');

const html = `<!doctype html><html><head><style>
@font-face{font-family:Archivo;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:400 900;font-stretch:62% 100%}
body{margin:0;padding:24px;background:#FAF7F0;font-family:Archivo,sans-serif;display:grid;grid-template-columns:repeat(6,1fr);gap:18px}
figure{margin:0}.frame{background:var(--art-bg);border-radius:999px 999px 12px 12px;aspect-ratio:1/1.08;overflow:hidden}
svg{width:100%;height:100%}figcaption{font-size:12px;font-weight:700;margin-top:6px;text-align:center}
</style></head><body>${sprite}${cells}</body></html>`;

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1320, height: 900 }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.waitForTimeout(300);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log('art preview →', out);
