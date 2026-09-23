// Live open/closed state and time slots, recomputed every 30 s and whenever the config changes.
import Scheduling from '../shared/scheduling.cjs';
import { catalog, now } from './catalog.js';
import { emit, subscribe } from './events.js';

let last = null;
let timer = null;

export function computeSchedule() {
  const s = catalog();
  if (!s.cfg) return null;
  return Scheduling.snapshot(Scheduling.partsFromEpoch(now(), 'Europe/Belgrade'), s.cfg);
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

/** Short human line for the header pill and bars. */
export function statusLine(snap) {
  if (!snap) return { open: false, text: '' };
  if (snap.paused) return { open: false, text: 'Poručivanje je pauzirano' };
  if (snap.open) {
    // Compare business minutes, not strings: 00:45 (after midnight) is later than 23:45.
    const latest = [snap.pickup, snap.delivery].filter((a) => a.canOrder && a.window).sort((a, b) => b.window.close - a.window.close)[0];
    return { open: true, text: `Otvoreno · poručivanje do ${latest.lastOrder}` };
  }
  return { open: false, text: snap.next ? `Zatvoreno · otvaramo ${snap.next.label}` : 'Zatvoreno' };
}
