// Builds the website's static data snapshot. Prefers data/snapshot.json (pulled from the live Apps Script
// by `npm run sync`), otherwise derives it from data/seed.json exactly like the backend would.
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

export function publicSettingKeys(root) {
  const src = readFileSync(path.join(root, 'backend/apps-script/Settings.gs'), 'utf8');
  const m = src.match(/var PUBLIC_SETTING_KEYS = \[([\s\S]*?)\];/);
  if (!m) throw new Error('PUBLIC_SETTING_KEYS not found in Settings.gs');
  return [...m[1].matchAll(/'([a-z0-9_]+)'/g)].map((x) => x[1]);
}

export function snapshotFromSeed(seed, root) {
  const all = Object.fromEntries(seed.settings.map((s) => [s.key, String(s.value)]));
  const keys = publicSettingKeys(root);
  const business = Object.fromEntries(keys.filter((k) => k in all).map((k) => [k, all[k]]));
  const zonesOn = String(all.zones_enabled).toUpperCase() === 'TRUE';
  const catalog = {
    categories: seed.catalog.categories.filter((c) => c.active !== false),
    groups: seed.catalog.groups,
    options: seed.catalog.options,
    products: seed.catalog.products.map(({ demo, ...p }) => ({ ...p, active: true }))
  };
  const version = 'seed-' + createHash('md5').update(JSON.stringify({ business, catalog, h: seed.hours })).digest('hex').slice(0, 12);
  return {
    version,
    business,
    hours: seed.hours.map((h) => ({
      dow: h.dow,
      day: h.day,
      open: h.open,
      close: h.close,
      delivery_open: h.delivery_open,
      delivery_close: h.delivery_close,
      break_start: h.break_start || '',
      break_end: h.break_end || '',
      closed: !!h.closed
    })),
    specialHours: seed.specialHours.filter((s) => s.active),
    zones: zonesOn
      ? seed.zones
          .filter((z) => z.active !== false)
          .map((z) => ({ id: z.id, name: z.name, areas: z.areas.split(',').map((s) => s.trim()), fee: z.fee, minOrder: z.min_order === '' || z.min_order === undefined ? Number(all.min_order_delivery) || 0 : z.min_order }))
      : [],
    catalog,
    recs: {}
  };
}

export function loadSnapshot(root) {
  const live = path.join(root, 'data/snapshot.json');
  if (existsSync(live)) return { source: 'data/snapshot.json', data: JSON.parse(readFileSync(live, 'utf8')) };
  const seed = JSON.parse(readFileSync(path.join(root, 'data/seed.json'), 'utf8'));
  return { source: 'data/seed.json', data: snapshotFromSeed(seed, root) };
}
