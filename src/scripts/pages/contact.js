// /kontakt/ — live hours, map on demand (no Google request until the guest asks), contact form.
import Validation from '../shared/validation.cjs';
import Scheduling from '../shared/scheduling.cjs';
import { $, $$, on, esc, icon } from '../core/dom.js';
import { subscribe } from '../core/events.js';
import { catalog, business } from '../core/catalog.js';
import { bootCommon } from './common.js';
import { bindForm } from '../ui/forms.js';
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

  const form = $('[data-contact-form]');
  if (form) {
    bindForm(form, {
      action: 'contact.submit',
      collect: (f) => ({ name: f.name.value, phone: f.phone.value, email: f.email.value, topic: f.topic.value, message: f.message.value }),
      validate: (p) => Validation.validateContactForm(p),
      successHtml: (p) =>
        `<div class="form-success" data-success tabindex="-1">${icon('check-circle')}<h3 class="h3">Poruka je stigla.</h3><p>Hvala, ${esc(p.name.split(' ')[0])}. Javljamo se ${p.phone ? 'telefonom' : 'emailom'} čim stignemo. Za porudžbine je najbrže da pozovete <a href="tel:${esc(business().phone_e164 || '')}">${esc(business().phone_display || '')}</a>.</p></div>`
    });
  }
}

init();
