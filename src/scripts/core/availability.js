// Live open/closed state of the shop, recomputed every 30 s and whenever the config changes.
import Scheduling from '../shared/scheduling.cjs';
import { catalog, now } from './catalog.js';
import { emit, subscribe } from './events.js';

let last = null;
let timer = null;

/** Store hours only: the ordering switches (and the last-order cutoff) in SETTINGS no longer close the shop. */
export function computeSchedule() {
  const s = catalog();
  if (!s.cfg) return null;
  const cfg = { ...s.cfg, orderingEnabled: true, pickupEnabled: true, deliveryEnabled: true, asapCutoffMin: 0 };
  return Scheduling.snapshot(Scheduling.partsFromEpoch(now(), 'Europe/Belgrade'), cfg);
}

export const schedule = () => last || computeSchedule();

function tick() {
  last = computeSchedule();
  if (last) emit('availability', last);
}

export function startAvailability() {
  if (timer) return;
  subscribe('catalog', tick);
  tick();
  timer = setInterval(tick, 30000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tick();
  });
}

/** Short human line for the header pill: the shop's own hours (pickup = store window). */
export function statusLine(snap) {
  if (!snap) return { open: false, text: '' };
  const store = snap.pickup;
  if (store.state === 'open') return { open: true, text: `Otvoreno do ${store.window.closeLabel}` };
  if (store.state === 'break') return { open: false, text: `Pauza · otvaramo ${store.next ? store.next.label : 'uskoro'}` };
  return { open: false, text: snap.next ? `Zatvoreno · otvaramo ${snap.next.label}` : 'Zatvoreno' };
}
