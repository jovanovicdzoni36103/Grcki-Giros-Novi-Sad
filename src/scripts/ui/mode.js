// Delivery / pickup switch shared by the menu bar, the cart and checkout.
import Money from '../shared/money.cjs';
import { esc, icon } from '../core/dom.js';
import { business, settingNumber, catalog } from '../core/catalog.js';
import { zoneArea } from '../core/cart.js';

export function zonesOn() {
  return String(business().zones_enabled).toUpperCase() === 'TRUE';
}

export function zones() {
  return (catalog().data && catalog().data.zones) || [];
}

/** "250 RSD", "od 250 RSD" (zones differ) or the agency wording. `zone` narrows it to one zone. */
export function deliveryFeeLabel(zone) {
  const b = business();
  if (String(b.delivery_fee_mode) === 'agency') return 'po cenovniku dostavne službe';
  if (zone) return zone.fee ? Money.formatRSD(zone.fee) : 'besplatna';
  if (zonesOn() && zones().length) {
    const fees = zones().map((z) => z.fee);
    const min = Math.min(...fees);
    return Math.max(...fees) === min ? Money.formatRSD(min) : `od ${Money.formatRSD(min)}`;
  }
  const fee = settingNumber('delivery_fee_default', 0);
  return fee ? Money.formatRSD(fee) : 'besplatna';
}

export function etaText(av) {
  return av.asap.etaMin === av.asap.etaMax ? `${av.asap.etaMin} min` : `${av.asap.etaMin}–${av.asap.etaMax} min`;
}

/** Why a mode cannot be ordered right now, in one short clause. */
export function closedReason(av, mode) {
  if (!av) return '';
  if (av.state === 'paused') return 'poručivanje je pauzirano';
  if (av.state === 'disabled') return mode === 'delivery' ? 'dostava je trenutno isključena' : 'preuzimanje je trenutno isključeno';
  if (av.state === 'break') return `pauza, ponovo ${av.next ? av.next.label : 'uskoro'}`;
  return av.next ? `ponovo ${av.next.label}` : 'zatvoreno';
}

/** One-line description of a mode's current availability. */
export function modeMeta(av, mode) {
  if (!av) return mode === 'delivery' ? '45–60 min' : '15–30 min';
  if (av.state === 'disabled') return 'trenutno isključeno';
  if (av.state === 'paused') return 'pauzirano';
  if (av.state === 'break') return av.next ? `pauza do ${av.next.label.replace(/^(danas|sutra|ujutru) u /, '')}` : 'pauza';
  if (!av.canOrder) return av.next ? `od ${av.next.label.replace(/^(danas|sutra|ujutru) u /, '$1 ')}` : 'zatvoreno';
  if (mode === 'delivery') return `${etaText(av)} · ${deliveryFeeLabel()}`;
  return `${etaText(av)} · besplatno`;
}

export function modeSwitch(name, current, snap) {
  const opt = (mode, title, ic) => {
    const av = snap ? snap[mode] : null;
    const unavailable = av && (av.state === 'disabled' || av.state === 'paused');
    return `<div class="segmented__option">
      <input type="radio" name="${esc(name)}" id="${esc(name)}-${mode}" value="${mode}" ${current === mode ? 'checked' : ''} ${unavailable ? 'disabled' : ''}>
      <label for="${esc(name)}-${mode}"><span class="segmented__title">${icon(ic)}${title}</span><span class="segmented__meta" data-mode-meta="${mode}">${esc(modeMeta(av, mode))}</span></label>
    </div>`;
  };
  return `<div class="segmented" role="radiogroup" aria-label="Način preuzimanja">${opt('delivery', 'Dostava', 'scooter')}${opt('pickup', 'Preuzimanje', 'store')}</div>`;
}

/**
 * Keeps the meta lines fresh without re-rendering (and losing focus on) the radios.
 * With `mode` it also moves the checked radio: the mode can change without a click.
 */
export function refreshModeMeta(root, snap, mode) {
  if (!root || !snap) return;
  root.querySelectorAll('[data-mode-meta]').forEach((el) => {
    const m = el.dataset.modeMeta;
    el.textContent = modeMeta(snap[m], m);
  });
  root.querySelectorAll('input[type="radio"]').forEach((input) => {
    const av = snap[input.value];
    input.disabled = !!av && (av.state === 'disabled' || av.state === 'paused');
    if (mode) input.checked = input.value === mode;
  });
}

/** Picks a sensible mode when the guest has not chosen one: whatever can be ordered now, delivery first. */
export function defaultMode(snap, current) {
  if (current && snap && snap[current] && snap[current].state === 'disabled') {
    const other = current === 'delivery' ? 'pickup' : 'delivery';
    if (snap[other].state !== 'disabled') return other;
  }
  if (current) return current;
  if (!snap) return 'delivery';
  if (snap.delivery.canOrder) return 'delivery';
  if (snap.pickup.canOrder) return 'pickup';
  return 'delivery';
}

/** The zone <select>: neighbourhoods grouped by zone, plus "not on the list". */
export function zoneSelect(id, name, current, { placeholder = 'Izaberite naselje' } = {}) {
  const list = zones();
  const area = zoneArea();
  const picked = (z, a, i) => current === z.id && (z.areas.includes(area) ? a === area : i === 0);
  return `<select class="input" id="${esc(id)}" name="${esc(name)}" data-zone-select>
    <option value="">${esc(placeholder)}</option>
    ${list
      .map(
        (z) =>
          `<optgroup label="${esc(z.name)} · dostava ${esc(Money.formatRSD(z.fee))}${z.minOrder ? ` · min. ${esc(Money.formatRSD(z.minOrder))}` : ''}">${z.areas
            .map((a, i) => `<option value="${esc(z.id)}" data-area="${esc(a)}" ${picked(z, a, i) ? 'selected' : ''}>${esc(a)}</option>`)
            .join('')}</optgroup>`
      )
      .join('')}
    <option value="none" ${current === 'none' ? 'selected' : ''}>Mog naselja nema na spisku</option>
  </select>`;
}

export function zoneById(id) {
  return zones().find((z) => z.id === id) || null;
}
