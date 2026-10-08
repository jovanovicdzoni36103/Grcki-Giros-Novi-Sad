// Renders the social share image (1200×630) with the shop's logo: node tools/make-images.mjs
// Favicons and app icons (favicon*.png, apple-touch-icon.png, icon-512.png, logo*.png) are cut from the client's logo artwork.
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const img = (f) => path.join(root, 'src/assets/img', f);
const font = readFileSync(path.join(root, 'src/assets/fonts/archivo-core.woff2')).toString('base64');
const fontSr = readFileSync(path.join(root, 'src/assets/fonts/archivo-sr.woff2')).toString('base64');
const sprite = readFileSync(img('art.svg'), 'utf8');
const logo = readFileSync(img('logo.png')).toString('base64');

const og = `<!doctype html><html><head><style>
@font-face{font-family:A;src:url(data:font/woff2;base64,${font});font-weight:400 900;font-stretch:62% 100%}
@font-face{font-family:A;src:url(data:font/woff2;base64,${fontSr});font-weight:400 900;font-stretch:62% 100%;unicode-range:U+0106-0107,U+010C-010D,U+0110-0111,U+0160-0161,U+017D-017E}
body{margin:0;width:1200px;height:630px;background:#FAF7F0;font-family:A;overflow:hidden;position:relative}
.arch{position:absolute;right:70px;top:60px;width:430px;height:570px;border-radius:999px 999px 20px 20px;background:#1B4F8C}
.sun{position:absolute;right:205px;top:150px;width:160px;height:160px;border-radius:50%;background:#F5A623}
.art{position:absolute;right:40px;bottom:-10px;width:500px}
h1{position:absolute;left:70px;top:58px;margin:0;font-weight:900;font-stretch:62%;text-transform:uppercase;font-size:104px;line-height:.86;color:#16202E;width:600px}
h1 span{color:#1B4F8C}
p{position:absolute;left:72px;bottom:70px;margin:0;font-size:30px;font-weight:700;font-stretch:80%;color:#16202E}
.logo{position:absolute;left:72px;bottom:178px;height:96px}
.pill{position:absolute;left:72px;bottom:120px;background:#F5A623;padding:10px 22px;border-radius:999px;font-weight:900;font-stretch:80%;text-transform:uppercase;letter-spacing:.06em;font-size:22px}
</style></head><body>${sprite}<div class="arch"></div><div class="sun"></div>
<svg class="art" viewBox="0 0 200 220"><use href="#wrap"/></svg>
<img class="logo" src="data:image/png;base64,${logo}" alt="">
<h1><span>Pravi Grčki Giros</span></h1>
<div class="pill">Ispod stadiona Karađorđe</div><p>Grčki Giros · Novi Sad · od 2021.</p></body></html>`;

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(og);
await page.waitForTimeout(300);
await page.screenshot({ path: img('og.png') });
await browser.close();
console.log('images: og.png');
