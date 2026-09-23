// Pulls the live menu/config from the deployed Apps Script into data/snapshot.json, so the next build
// prerenders current prices and hours (the site still refreshes them live in the browser).
//   npm run sync        (reads apiUrl from site.config.json)
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { apiUrl } = JSON.parse(readFileSync(path.join(root, 'site.config.json'), 'utf8'));
if (!apiUrl) {
  console.error('site.config.json → apiUrl is empty. Paste the Apps Script Web App URL (…/exec) first.');
  process.exit(1);
}
const res = await fetch(`${apiUrl}?action=bootstrap`, { redirect: 'follow' });
const body = await res.json();
if (!body.ok) {
  console.error('Apps Script answered with an error:', body.error);
  process.exit(1);
}
const { serverNow, ...snapshot } = body.data;
writeFileSync(path.join(root, 'data/snapshot.json'), JSON.stringify(snapshot, null, 1));
console.log(`snapshot: ${snapshot.catalog.products.length} products, version ${snapshot.version} → data/snapshot.json`);
