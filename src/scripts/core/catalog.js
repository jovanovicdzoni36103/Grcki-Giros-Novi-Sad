// Menu + configuration. Renders instantly from the last known data (localStorage or the static snapshot),
// then refreshes from Apps Script so prices, availability and hours always come from Google Sheets.
import Pricing from '../shared/pricing.cjs';
import Scheduling from '../shared/scheduling.cjs';
import { apiGet } from './api.js';
import { local } from './storage.js';
import { emit } from './events.js';
import { env } from './dom.js';

const CACHE_KEY = 'gg:bootstrap:v1';
const CACHE_MAX_AGE = 12 * 60 * 60 * 1000;

const state = { data: null, index: null, cfg: null, source: 'none', offset: 0, live: false };
let loading = null;

function apply(data, source) {
  state.data = data;
  state.index = Pricing.buildIndex(data.catalog);
  state.cfg = Scheduling.buildConfig(data.business, data.hours, data.specialHours);
  state.source = source;
  state.live = source === 'live';
  emit('catalog', state);
}

export const catalog = () => state;

/** Wall-clock "now" corrected by the server's clock (a wrong phone clock never changes time slots). */
export const now = () => Date.now() + state.offset;

export function business() {
  return (state.data && state.data.business) || {};
}

export function settingNumber(key, fallback = 0) {
  const n = Number(business()[key]);
  return Number.isFinite(n) && business()[key] !== '' ? n : fallback;
}

export async function refreshLive() {
  // A cold Apps Script start alone can take 5–10 s; the page already shows cached data meanwhile.
  const res = await apiGet('bootstrap', {}, { timeoutMs: 20000 });
  if (!res.ok || !res.data || !res.data.catalog) {
    emit('catalog:error', res.error || { code: 'BAD_RESPONSE' });
    return false;
  }
  state.offset = res.data.serverNow ? res.data.serverNow - Date.now() : 0;
  const { serverNow, ...persist } = res.data;
  local.set(CACHE_KEY, { savedAt: Date.now(), data: persist });
  apply(res.data, 'live');
  return true;
}

export function loadCatalog() {
  if (loading) return loading;
  loading = (async () => {
    const cached = local.get(CACHE_KEY);
    if (cached && cached.data && Date.now() - cached.savedAt < CACHE_MAX_AGE) {
      apply(cached.data, 'cache');
    } else {
      try {
        const snap = await fetch(env().assets.snapshot, { cache: 'force-cache' }).then((r) => r.json());
        apply(snap, 'snapshot');
      } catch {
        /* the live request below is the last resort */
      }
    }
    const live = refreshLive();
    if (!state.data) await live;
    return state;
  })();
  return loading;
}

export function productById(id) {
  return state.index ? state.index.products[id] : null;
}

export function categories() {
  const cats = (state.data && state.data.catalog.categories) || [];
  return cats.slice().sort((a, b) => a.sort - b.sort);
}
