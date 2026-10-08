// /kontakt/: live hours and the map on demand (no Google request until the guest asks).
import Scheduling from '../shared/scheduling.cjs';
import { $$, on, esc } from '../core/dom.js';
import { subscribe } from '../core/events.js';
import { catalog, business } from '../core/catalog.js';
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

  on(document, 'click', '[data-load-map]', (e, btn) => {
    const box = btn.closest('[data-map]');
    const q = encodeURIComponent(business().map_query || box.dataset.query || '');
    box.innerHTML = `<iframe title="Mapa: ${esc(business().address_street || '')}" src="https://maps.google.com/maps?q=${q}&z=16&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>`;
  });
}

init();
