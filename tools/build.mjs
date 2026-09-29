// Static build: prerendered HTML pages + esbuild bundles + assets → dist/
//   node tools/build.mjs            production (uses site.config.json apiUrl)
//   node tools/build.mjs --dev      local dev server API (/api), dev helpers enabled
import { build } from 'esbuild';
import { mkdirSync, rmSync, readFileSync, writeFileSync, cpSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { syncGas } from './gas-sync.mjs';
import { loadSnapshot } from './lib/snapshot.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const Scheduling = require('../src/scripts/shared/scheduling.cjs');
const dev = process.argv.includes('--dev');
const outArg = process.argv.indexOf('--out');
const dist = path.join(root, outArg > -1 ? process.argv[outArg + 1] : 'dist');
const t0 = Date.now();

syncGas({ quiet: true });

const config = JSON.parse(readFileSync(path.join(root, 'site.config.json'), 'utf8'));
const apiUrl = dev || !config.apiUrl ? '/api' : config.apiUrl;
if (!dev && !config.apiUrl) console.warn('⚠ site.config.json apiUrl is empty: this build talks to /api (local dev server only).');

const { data: snapshot, source } = loadSnapshot(root);

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// --- Bundles -----------------------------------------------------------------
const pageEntries = ['home', 'menu', 'checkout', 'contact', 'jobs', 'admin', 'basic'];
const js = await build({
  entryPoints: Object.fromEntries(pageEntries.map((p) => [p, path.join(root, `src/scripts/pages/${p}.js`)])),
  absWorkingDir: root,
  bundle: true,
  splitting: true,
  format: 'esm',
  target: ['es2020', 'safari14'],
  minify: !dev,
  sourcemap: dev ? 'linked' : false,
  outdir: path.join(dist, 'assets/js'),
  entryNames: '[name]-[hash]',
  chunkNames: 'chunks/[name]-[hash]',
  metafile: true,
  legalComments: 'none',
  logLevel: 'warning'
});

const css = await build({
  entryPoints: { main: path.join(root, 'src/styles/main.css'), admin: path.join(root, 'src/styles/admin.css') },
  absWorkingDir: root,
  bundle: true,
  minify: !dev,
  outdir: path.join(dist, 'assets/css'),
  entryNames: '[name]-[hash]',
  external: ['*.woff2', '*.svg'],
  metafile: true,
  logLevel: 'warning'
});

function outputsByEntry(meta) {
  const map = {};
  for (const [out, info] of Object.entries(meta.outputs)) {
    if (!info.entryPoint) continue;
    const name = path.basename(info.entryPoint).replace(/\.(js|css)$/, '');
    map[name] = '/' + path.relative(dist, path.join(root, out)).split(path.sep).join('/');
  }
  return map;
}
const jsOut = outputsByEntry(js.metafile);
const cssOut = outputsByEntry(css.metafile);

// --- Static assets ----------------------------------------------------------------
cpSync(path.join(root, 'src/assets/fonts'), path.join(dist, 'assets/fonts'), { recursive: true });
cpSync(path.join(root, 'src/assets/img'), path.join(dist, 'assets/img'), { recursive: true });
for (const f of ['favicon.svg', 'favicon.png', 'apple-touch-icon.png']) {
  try {
    cpSync(path.join(root, 'src/assets/img', f), path.join(dist, f));
  } catch {
    /* optional */
  }
}
mkdirSync(path.join(dist, 'assets/data'), { recursive: true });
writeFileSync(path.join(dist, 'assets/data/snapshot.json'), JSON.stringify(snapshot));

const buildId = createHash('md5').update(JSON.stringify([jsOut, cssOut, snapshot.version, Date.now()])).digest('hex').slice(0, 10);
const cfg = Scheduling.buildConfig(snapshot.business, snapshot.hours, snapshot.specialHours);
const weekly = Scheduling.weeklySummary(cfg);
const open = weekly.filter((w) => !w.closed);
const hoursLine = open.map((w) => `${w.days} ${w.store}`).join(', ');
const deliveryLine = open.filter((w) => w.delivery).map((w) => `${w.days.toLowerCase()} ${w.delivery}`).join(', ');
const pickupLine = open.map((w) => `${w.store}`).join(', ');

const ctx = {
  env: dev ? 'dev' : 'production',
  buildId,
  buildDate: new Date().toISOString().slice(0, 10),
  year: new Date().getFullYear(),
  site: { url: String(config.siteUrl || '').replace(/\/$/, ''), apiUrl, gaId: config.gaId || '' },
  business: snapshot.business,
  hours: snapshot.hours,
  zones: snapshot.zones || [],
  catalog: snapshot.catalog,
  weekly,
  hoursLine,
  deliveryLine,
  pickupLine,
  statusText: 'Pravi grčki giros',
  assets: {
    css: cssOut.main,
    icons: `/assets/img/icons.svg?v=${buildId}`,
    art: `/assets/img/art.svg?v=${buildId}`,
    snapshot: `/assets/data/snapshot.json?v=${buildId}`
  }
};

// --- Pages ------------------------------------------------------------------------
const { layout } = await import(pathToFileURL(path.join(root, 'src/site/layout.js')));
const pageModules = [
  await import(pathToFileURL(path.join(root, 'src/site/pages/home.js'))),
  await import(pathToFileURL(path.join(root, 'src/site/pages/menu.js'))),
  await import(pathToFileURL(path.join(root, 'src/site/pages/checkout.js'))),
  await import(pathToFileURL(path.join(root, 'src/site/pages/about.js'))),
  await import(pathToFileURL(path.join(root, 'src/site/pages/delivery.js'))),
  await import(pathToFileURL(path.join(root, 'src/site/pages/contact.js'))),
  await import(pathToFileURL(path.join(root, 'src/site/pages/jobs.js')))
];
const misc = await import(pathToFileURL(path.join(root, 'src/site/pages/misc.js')));
pageModules.push(misc.privacy, misc.notFound, misc.admin, misc.panelRedirect);

const sitemap = [];
for (const mod of pageModules) {
  const m = mod.meta;
  const page = { ...m, script: jsOut[m.script], css: cssOut[m.css || 'main'], schema: m.schema ? m.schema(ctx) : [] };
  const html = layout(ctx, page, mod.render(ctx));
  const out = path.join(dist, m.out);
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, html);
  if (!m.noindex) sitemap.push(m.path);
}

// --- SEO + hosting files -------------------------------------------------------------
const today = ctx.buildDate;
writeFileSync(
  path.join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap
    .map((p) => `  <url><loc>${ctx.site.url}${p}</loc><lastmod>${today}</lastmod><changefreq>${p === '/meni/' ? 'daily' : 'weekly'}</changefreq><priority>${p === '/' ? '1.0' : p === '/meni/' ? '0.9' : '0.6'}</priority></url>`)
    .join('\n')}\n</urlset>\n`
);
writeFileSync(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /panel/\nDisallow: /porudzbina/\n\nSitemap: ${ctx.site.url}/sitemap.xml\n`);
writeFileSync(
  path.join(dist, 'site.webmanifest'),
  JSON.stringify(
    {
      name: 'Grčki Giros',
      short_name: 'Grčki Giros',
      start_url: '/meni/',
      display: 'standalone',
      background_color: '#FAF7F0',
      theme_color: '#1B4F8C',
      lang: 'sr-Latn',
      icons: [
        { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
        { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
      ]
    },
    null,
    1
  )
);
// Cloudflare Pages / Netlify cache headers: hashed bundles forever, the rest revalidates.
writeFileSync(
  path.join(dist, '_headers'),
  `/assets/js/*\n  Cache-Control: public, max-age=31536000, immutable\n/assets/css/*\n  Cache-Control: public, max-age=31536000, immutable\n/assets/fonts/*\n  Cache-Control: public, max-age=31536000, immutable\n/assets/img/*\n  Cache-Control: public, max-age=86400\n/assets/data/*\n  Cache-Control: public, max-age=300\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  X-Frame-Options: SAMEORIGIN\n/admin/*\n  X-Robots-Tag: noindex\n  Cache-Control: no-store\n/panel/*\n  X-Robots-Tag: noindex\n`
);

// --- Budget report ------------------------------------------------------------------
function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const gz = (p) => gzipSync(readFileSync(p)).length;
const jsFiles = walk(path.join(dist, 'assets/js')).filter((f) => f.endsWith('.js'));
const cssFiles = walk(path.join(dist, 'assets/css'));
const kb = (n) => (n / 1024).toFixed(1) + ' KB';
const menuDeps = new Set();
const collect = (file) => {
  const rel = path.relative(root, file).split(path.sep).join('/');
  const info = js.metafile.outputs[rel];
  if (!info || menuDeps.has(rel)) return;
  menuDeps.add(rel);
  info.imports.filter((i) => i.kind === 'import-statement').forEach((i) => collect(path.join(root, i.path)));
};
collect(path.join(dist, jsOut.menu.slice(1)));
const menuJs = [...menuDeps].reduce((n, f) => n + gz(path.join(root, f)), 0);
console.log(`build ${dev ? '(dev)' : '(production)'} in ${Date.now() - t0} ms · data from ${source} · api ${apiUrl}`);
console.log(`  pages: ${pageModules.length} · JS total ${kb(jsFiles.reduce((n, f) => n + gz(f), 0))} gz (menu page ${kb(menuJs)} gz) · CSS ${kb(gz(path.join(dist, cssOut.main)))} gz · fonts ${kb(statSync(path.join(dist, 'assets/fonts/archivo-core.woff2')).size + statSync(path.join(dist, 'assets/fonts/archivo-sr.woff2')).size)}`);
