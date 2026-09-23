// Content pages (o nama, dostava, privatnost, 404): shared chrome + live opening hours where shown.
import Scheduling from '../shared/scheduling.cjs';
import { $$ } from '../core/dom.js';
import { subscribe } from '../core/events.js';
import { catalog } from '../core/catalog.js';
import { bootCommon } from './common.js';
import { hoursRows } from '../ui/render.js';

function liveHours() {
  const s = catalog();
  if (!s.cfg) return;
  const rows = Scheduling.weeklySummary(s.cfg);
  $$('[data-hours]').forEach((dl) => (dl.innerHTML = hoursRows(rows, { deliveryColumn: dl.hasAttribute('data-hours-delivery') })));
}

async function init() {
  await bootCommon();
  liveHours();
  subscribe('catalog', liveHours);
}

init();
