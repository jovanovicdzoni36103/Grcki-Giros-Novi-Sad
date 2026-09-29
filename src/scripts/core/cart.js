// Cart store. Lines keep only ids, quantities and choices; prices are always recomputed from the
// current catalog, so a price change in Sheets can never leave a stale total in the browser.
import Pricing from '../shared/pricing.cjs';
import { local } from './storage.js';
import { emit, subscribe } from './events.js';
import { catalog, business, settingNumber } from './catalog.js';

const KEY = 'gg:cart:v1';
const LAST_ORDER_KEY = 'gg:last-order:v1';

let cart = normalize(local.get(KEY));

/** A stored line exactly as the cart writes it; anything edited by hand in storage is repaired or dropped. */
function normalizeLine(l) {
  if (!l || typeof l !== 'object' || typeof l.productId !== 'string' || !l.productId) return null;
  const qty = Math.floor(Number(l.qty));
  if (!(qty >= 1)) return null;
  return {
    productId: l.productId.slice(0, 60),
    qty: Math.min(qty, 20),
    options: Array.isArray(l.options) ? l.options.filter((o) => typeof o === 'string').slice(0, 40).sort() : [],
    note: typeof l.note === 'string' ? l.note.trim().slice(0, 140) : ''
  };
}

function normalize(raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  return {
    lines: Array.isArray(c.lines) ? c.lines.map(normalizeLine).filter(Boolean).slice(0, 30) : [],
    mode: c.mode === 'delivery' || c.mode === 'pickup' ? c.mode : null,
    zone: typeof c.zone === 'string' ? c.zone : '',
    zoneArea: typeof c.zoneArea === 'string' ? c.zoneArea : '',
    updatedAt: c.updatedAt || 0
  };
}

function save() {
  cart.updatedAt = Date.now();
  local.set(KEY, cart);
  emit('cart', view());
}

export function mode() {
  return cart.mode;
}

export function setMode(mode) {
  if (mode !== 'delivery' && mode !== 'pickup') return;
  if (cart.mode === mode) return;
  cart.mode = mode;
  save();
}

export function zone() {
  return cart.zone;
}

/** Neighbourhood the guest picked: several share one zone id, so the select needs it to show the right one. */
export function zoneArea() {
  return cart.zoneArea;
}

export function setZone(id, area) {
  cart.zone = id || '';
  cart.zoneArea = area || '';
  save();
}

/** Most pieces of one cart line (the server enforces the same number). */
export function maxQty() {
  return settingNumber('max_qty_per_line', 20);
}

export function addLine(line) {
  const clean = {
    productId: line.productId,
    qty: Math.max(1, Math.min(settingNumber('max_qty_per_line', 20), Math.floor(line.qty || 1))),
    options: (line.options || []).slice().sort(),
    note: String(line.note || '').trim().slice(0, 140)
  };
  const key = Pricing.lineKey(clean);
  const existing = cart.lines.find((l) => Pricing.lineKey(l) === key);
  if (existing) existing.qty = Math.min(settingNumber('max_qty_per_line', 20), existing.qty + clean.qty);
  else cart.lines.push(clean);
  save();
  return key;
}

export function setQty(key, qty) {
  const line = cart.lines.find((l) => Pricing.lineKey(l) === key);
  if (!line) return;
  if (qty <= 0) {
    removeLine(key);
    return;
  }
  line.qty = Math.min(settingNumber('max_qty_per_line', 20), qty);
  save();
}

export function removeLine(key) {
  const idx = cart.lines.findIndex((l) => Pricing.lineKey(l) === key);
  if (idx === -1) return null;
  const [removed] = cart.lines.splice(idx, 1);
  save();
  return { line: removed, index: idx };
}

export function restoreLine(removed) {
  if (!removed) return;
  cart.lines.splice(Math.min(removed.index, cart.lines.length), 0, removed.line);
  save();
}

/**
 * Adds a product configured piece by piece (Cheeseburger ×2: extra cheese on one, bacon on the other).
 * Identical pieces merge into one line; `replaceKey` swaps out the line that was being edited.
 */
export function addPieces(productId, pieces, replaceKey) {
  const lines = Pricing.groupPieces(productId, pieces);
  if (replaceKey) {
    const idx = cart.lines.findIndex((l) => Pricing.lineKey(l) === replaceKey);
    if (idx !== -1) cart.lines.splice(idx, 1);
  }
  const max = settingNumber('max_qty_per_line', 20);
  lines.forEach((line) => {
    const key = Pricing.lineKey(line);
    const existing = cart.lines.find((l) => Pricing.lineKey(l) === key);
    if (existing) existing.qty = Math.min(max, existing.qty + line.qty);
    else cart.lines.push({ ...line, qty: Math.min(max, line.qty), note: line.note.slice(0, 140) });
  });
  save();
  return lines.map(Pricing.lineKey);
}

export function rawLine(key) {
  return cart.lines.find((l) => Pricing.lineKey(l) === key) || null;
}

export function clearCart() {
  cart.lines = [];
  save();
}

export function replaceAll(lines) {
  cart.lines = (Array.isArray(lines) ? lines : []).map(normalizeLine).filter(Boolean).slice(0, 30);
  save();
}

export function itemCount() {
  return cart.lines.reduce((n, l) => n + l.qty, 0);
}

/** Priced view of the cart for the current mode. */
export function view(modeOverride) {
  const s = catalog();
  const m = modeOverride || cart.mode || 'delivery';
  const b = business();
  if (!s.index) return { lines: [], subtotal: 0, deliveryFee: 0, total: 0, itemCount: itemCount(), mode: m, ready: false, errors: [] };
  const zones = (s.data && s.data.zones) || [];
  const zonesOn = String(b.zones_enabled).toUpperCase() === 'TRUE';
  const zoneObj = zonesOn ? zones.find((z) => z.id === cart.zone) || null : null;
  // Zone minimum comes resolved from the server (zone value, else min_order_delivery).
  const minOrder = m === 'delivery' ? (zoneObj ? zoneObj.minOrder : settingNumber('min_order_delivery', 0)) : settingNumber('min_order_pickup', 0);
  const priced = Pricing.computeCart(s.index, cart.lines, {
    mode: m,
    feeMode: b.delivery_fee_mode || 'fixed',
    defaultFee: settingNumber('delivery_fee_default', 0),
    zoneFee: zoneObj ? zoneObj.fee : undefined,
    freeThreshold: settingNumber('free_delivery_threshold', 0),
    minOrder,
    maxLines: settingNumber('max_lines_per_order', 30),
    maxQty: settingNumber('max_qty_per_line', 20)
  });
  // With zones on, the fee is only known once the guest picks a zone: never show a guessed total.
  const needsZone = m === 'delivery' && zonesOn && !zoneObj && priced.deliveryExternal !== true;
  if (needsZone) {
    priced.deliveryFee = null;
    priced.total = priced.subtotal;
  }
  const lines = priced.lines.map((p, i) => ({ ...p, key: Pricing.lineKey(cart.lines[i]), raw: cart.lines[i] }));
  const ids = cart.lines.map((l) => l.productId);
  return {
    ...priced,
    lines,
    mode: m,
    zone: cart.zone,
    zoneObj,
    zonesOn,
    needsZone,
    minOrder,
    ready: true,
    hints: Pricing.bundleHints(s.index, priced.lines.filter((l) => l.product)),
    recs: Pricing.recommendations(s.index, ids, (s.data && s.data.recs) || {}, 3),
    empty: cart.lines.length === 0
  };
}

export function rememberLastOrder(response, lines) {
  local.set(LAST_ORDER_KEY, { at: Date.now(), response, lines });
}

export function lastOrder() {
  return local.get(LAST_ORDER_KEY);
}

subscribe('catalog', () => emit('cart', view()));

window.addEventListener('storage', (e) => {
  if (e.key === KEY) {
    cart = normalize(local.get(KEY));
    emit('cart', view());
  }
});

// "Nazad" after ordering can restore this page from the browser's memory (back/forward cache) with the cart
// it had before: re-read the stored cart, or the already ordered lines could be written back and sent again.
window.addEventListener('pageshow', (e) => {
  if (!e.persisted) return;
  cart = normalize(local.get(KEY));
  emit('cart', view());
});
