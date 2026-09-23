// Delivery / pickup switch shared by the menu bar, the cart and checkout.
import Money from '../shared/money.cjs';
import { esc, icon } from '../core/dom.js';
import { business, settingNumber } from '../core/catalog.js';

export function deliveryFeeLabel() {
  const b = business();
  if (String(b.delivery_fee_mode) === 'agency') return 'po cenovniku dostavne službe';
  const fee = settingNumber('delivery_fee_default', 0);
  return fee ? Money.formatRSD(fee) : 'besplatna';
}

/** One-line description of a mode's current availability. */
export function modeMeta(av, mode) {
  if (!av) return mode === 'delivery' ? '~60 min' : '15–30 min';
  if (av.state === 'disabled') return 'trenutno nije dostupna';
  if (av.state === 'paused') return 'pauzirano';
  if (!av.canOrder) return av.next ? `od ${av.next.label.replace(/^(danas|sutra|ujutru) u /, '$1 ')}` : 'zatvoreno';
  if (mode === 'delivery') return `~${av.asap.etaMin} min · ${deliveryFeeLabel()}`;
  return `${av.asap.etaMin}–${av.asap.etaMax} min · besplatno`;
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

/** Keeps the meta lines fresh without re-rendering (and losing focus on) the radios. */
export function refreshModeMeta(root, snap) {
  if (!root || !snap) return;
  root.querySelectorAll('[data-mode-meta]').forEach((el) => {
    const mode = el.dataset.modeMeta;
    el.textContent = modeMeta(snap[mode], mode);
  });
}

/** Picks a sensible mode when the guest has not chosen one: whatever can be ordered now, delivery first. */
export function defaultMode(snap, current) {
  if (current) return current;
  if (!snap) return 'delivery';
  if (snap.delivery.canOrder) return 'delivery';
  if (snap.pickup.canOrder) return 'pickup';
  return 'delivery';
}
