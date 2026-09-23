// Generates the Apps Script files that must stay identical to the website's code:
//   src/scripts/shared/*.cjs  → backend/apps-script/Shared_<Name>.gs
//   data/seed.json            → backend/apps-script/Seed.gs
// Run automatically by `npm run build` and before tests.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sharedDir = path.join(root, 'src/scripts/shared');
const gasDir = path.join(root, 'backend/apps-script');
const banner = (src) => `// GENERATED from ${src} by tools/gas-sync.mjs — do not edit here.\n`;

export function syncGas({ quiet = false } = {}) {
  const written = [];
  for (const file of readdirSync(sharedDir).filter((f) => f.endsWith('.cjs'))) {
    const name = file.replace(/\.cjs$/, '');
    const target = `Shared_${name.charAt(0).toUpperCase()}${name.slice(1)}.gs`;
    const code = readFileSync(path.join(sharedDir, file), 'utf8');
    writeFileSync(path.join(gasDir, target), banner(`src/scripts/shared/${file}`) + code);
    written.push(target);
  }
  const seed = JSON.parse(readFileSync(path.join(root, 'data/seed.json'), 'utf8'));
  delete seed._comment;
  writeFileSync(path.join(gasDir, 'Seed.gs'), banner('data/seed.json') + 'var SEED = ' + JSON.stringify(seed, null, 1) + ';\n');
  written.push('Seed.gs');
  if (!quiet) console.log(`gas-sync: ${written.join(', ')}`);
  return written;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) syncGas();
