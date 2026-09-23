// Cart store. Lines keep only ids, quantities and choices; prices are always recomputed from the
// current catalog, so a price change in Sheets can never leave a stale total in the browser.
import Pricing from '../shared/pricing.cjs';
import { local } from './storage.js';
import { emit, subscribe } from './events.js';
import { catalog, business, settingNumber } from './catalog.js';

const KEY = 'gg:cart:v1';
const LAST_ORDER_KEY = 'gg:last-order:v1';

let cart = normalize(local.get(KEY));

function normalize(raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  return {
    lines: Array.isArray(c.lines) ? c.lines.filter((l) => l && l.productId && l.qty > 0) : [],
    mode: c.mode === 'delivery' || c.mode === 'pickup' ? c.mode : null,
    zone: typeof c.zone === 'string' ? c.zone : '',
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

export function setZone(id) {
  cart.zone = id || '';
  save();
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

export function replaceLine(key, line) {
  const idx = cart.lines.findIndex((l) => Pricing.lineKey(l) === key);
  if (idx === -1) return addLine(line);
  cart.lines.splice(idx, 1);
  save();
  return addLine(line);
}

export function rawLine(key) {
  return cart.lines.find((l) => Pricing.lineKey(l) === key) || null;
}

export function clearCart() {
  cart.lines = [];
  save();
}

export function replaceAll(lines) {
  cart.lines = lines.map((l) => ({ productId: l.productId, qty: l.qty, options: (l.options || []).slice().sort(), note: l.note || '' }));
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
  const zoneObj = zones.find((z) => z.id === cart.zone);
  const zonesOn = String(b.zones_enabled).toUpperCase() === 'TRUE';
  const minOrder = m === 'delivery' ? Math.max(settingNumber('min_order_delivery', 0), zoneObj ? zoneObj.minOrder : 0) : settingNumber('min_order_pickup', 0);
  const priced = Pricing.computeCart(s.index, cart.lines, {
    mode: m,
    feeMode: b.delivery_fee_mode || 'fixed',
    defaultFee: settingNumber('delivery_fee_default', 0),
    zoneFee: zonesOn && zoneObj ? zoneObj.fee : undefined,
    freeThreshold: settingNumber('free_delivery_threshold', 0),
    minOrder,
    maxLines: settingNumber('max_lines_per_order', 30),
    maxQty: settingNumber('max_qty_per_line', 20)
  });
  const lines = priced.lines.map((p, i) => ({ ...p, key: Pricing.lineKey(cart.lines[i]), raw: cart.lines[i] }));
  const ids = cart.lines.map((l) => l.productId);
  return {
    ...priced,
    lines,
    mode: m,
    zone: cart.zone,
    zoneObj,
    zonesOn,
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
