// /porudzbina/ — checkout, confirmation and live order status (+ feedback once the order is done).
// The guest must never wonder: did it go through, is it confirmed, where does it go, how much, when, how much cash.
import Money from '../shared/money.cjs';
import Validation from '../shared/validation.cjs';
import Scheduling from '../shared/scheduling.cjs';
import { $, $$, on, esc, icon, uuid, env, prefersReducedMotion } from '../core/dom.js';
import { subscribe } from '../core/events.js';
import { local, session } from '../core/storage.js';
import { apiPost, apiGet } from '../core/api.js';
import { catalog, business, settingNumber, refreshLive, now } from '../core/catalog.js';
import { schedule } from '../core/availability.js';
import * as cart from '../core/cart.js';
import { bootCommon } from './common.js';
import { modeSwitch, refreshModeMeta, defaultMode, deliveryFeeLabel, etaText, closedReason, zoneSelect, zonesOn, zoneById } from '../ui/mode.js';
import { openCart } from '../ui/cart-drawer.js';
import { toast } from '../ui/toast.js';
import { track } from '../core/analytics.js';
import { artSvg, artBg } from '../ui/render.js';

const CUSTOMER_KEY = 'gg:customer:v1';
const PLACED_KEY = 'gg:placed:v1';
const PENDING_KEY = 'gg:pending:v1';

const app = () => $('[data-checkout-app]');
const aside = () => $('[data-checkout-summary]');

const form = {
  timing: 'asap', // 'asap' | 'later'
  when: 'asap', // 'asap' | slot value 'YYYY-MM-DD HH:MM'
  day: '',
  dayChosen: false, // the guest picked a day; until then the first day follows the (server-corrected) schedule
  cashChoice: null, // 'exact' | number | 'custom'
  cashCustom: '',
  startedAt: 0,
  submitting: false,
  submitted: false
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function currentMode() {
  return defaultMode(schedule(), cart.mode());
}

function val(name) {
  const el = app().querySelector(`[name="${name}"]`);
  return el ? el.value : '';
}

function cashAmount(total) {
  if (form.cashChoice === 'exact') return total;
  if (typeof form.cashChoice === 'number') return form.cashChoice;
  if (form.cashChoice === 'custom') return Validation.parseAmount(form.cashCustom);
  return NaN;
}

function setFieldError(name, message) {
  const field = app().querySelector(`[data-field="${name}"]`);
  if (!field) return;
  field.classList.toggle('has-error', !!message);
  const err = field.querySelector('.field__error');
  if (err) err.innerHTML = message ? `${icon('alert')}<span>${esc(message)}</span>` : '';
  const input = field.querySelector('input, textarea, select');
  if (input) input.setAttribute('aria-invalid', message ? 'true' : 'false');
}

function clearErrors() {
  $$('[data-field]', app()).forEach((f) => setFieldError(f.dataset.field, ''));
  const banner = $('[data-submit-error]');
  if (banner) banner.hidden = true;
}

function fieldHtml({ name, label, type = 'text', autocomplete, inputmode, placeholder, optional, hint, value = '', maxlength, textarea }) {
  const id = `f-${name.replace(/\./g, '-')}`;
  const control = textarea
    ? `<textarea class="input" id="${id}" name="${name}" rows="2" ${maxlength ? `maxlength="${maxlength}"` : ''} placeholder="${esc(placeholder || '')}" aria-describedby="${id}-err">${esc(value)}</textarea>`
    : `<input class="input" id="${id}" name="${name}" type="${type}" ${autocomplete ? `autocomplete="${autocomplete}"` : ''} ${inputmode ? `inputmode="${inputmode}"` : ''} ${maxlength ? `maxlength="${maxlength}"` : ''} placeholder="${esc(placeholder || '')}" value="${esc(value)}" aria-describedby="${id}-err${hint ? ` ${id}-hint` : ''}">`;
  return `<div class="field" data-field="${name}">
    <label class="field__label" for="${id}">${esc(label)}${optional ? '<span class="optional">opciono</span>' : ''}</label>
    ${control}
    ${hint ? `<p class="field__hint" id="${id}-hint">${esc(hint)}</p>` : ''}
    <p class="field__error" id="${id}-err" role="alert"></p>
  </div>`;
}

function slotLabelFor(value) {
  const s = catalog();
  if (!s.cfg) return value;
  return Scheduling.slotLabel(Scheduling.partsFromEpoch(now(), 'Europe/Belgrade'), s.cfg, value);
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

function renderForm() {
  const saved = local.get(CUSTOMER_KEY) || {};
  const snap = schedule();
  const mode = currentMode();
  form.startedAt = performance.now();
  form.whenKey = form.payKey = form.asideKey = form.zoneKey = '';
  if (!cart.zone() && saved.zone) cart.setZone(saved.zone);
  app().innerHTML = `
  <form class="checkout-form" data-checkout-form novalidate>
    <div class="notice notice--closed" data-closed hidden></div>

    <section class="co-step" aria-labelledby="s1">
      <h2 class="co-step__title" id="s1"><span class="co-step__n">1</span>Dostava ili preuzimanje?</h2>
      <div data-mode-root>${modeSwitch('mode', mode, snap)}</div>
    </section>

    <section class="co-step" aria-labelledby="s2">
      <h2 class="co-step__title" id="s2"><span class="co-step__n">2</span>Kada?</h2>
      <div data-when></div>
      <p class="field__error" data-when-error role="alert"></p>
    </section>

    <section class="co-step" aria-labelledby="s3">
      <h2 class="co-step__title" id="s3"><span class="co-step__n">3</span>Vaši podaci</h2>
      <div class="stack">
        ${fieldHtml({ name: 'name', label: 'Ime i prezime', autocomplete: 'name', value: saved.name || '', maxlength: 60 })}
        ${fieldHtml({ name: 'phone', label: 'Broj mobilnog telefona', type: 'tel', autocomplete: 'tel', inputmode: 'tel', placeholder: '06x xxx xxxx', value: saved.phone || '', hint: 'Zovemo samo ako nešto nije jasno sa porudžbinom.', maxlength: 24 })}
        ${fieldHtml({ name: 'email', label: 'Email', type: 'email', autocomplete: 'email', inputmode: 'email', optional: true, value: saved.email || '', hint: 'Ako ga unesete, javljamo vam kad lokal potvrdi porudžbinu.', maxlength: 120 })}
      </div>
    </section>

    <section class="co-step" aria-labelledby="s4" data-delivery-only>
      <h2 class="co-step__title" id="s4"><span class="co-step__n">4</span>Adresa za dostavu</h2>
      <div class="stack">
        <div data-zone-field></div>
        <div class="field-row">
          ${fieldHtml({ name: 'address.street', label: 'Ulica', autocomplete: 'address-line1', value: saved.street || '', maxlength: 80 })}
          ${fieldHtml({ name: 'address.number', label: 'Broj', autocomplete: 'off', value: saved.number || '', placeholder: '12a', maxlength: 12 })}
        </div>
        <div class="field-row field-row--even">
          ${fieldHtml({ name: 'address.apt', label: 'Stan', autocomplete: 'off', optional: true, value: saved.apt || '', placeholder: 'npr. 12', maxlength: 40 })}
          ${fieldHtml({ name: 'address.floor', label: 'Sprat', autocomplete: 'off', optional: true, value: saved.floor || '', placeholder: 'npr. 3', maxlength: 20 })}
        </div>
        ${fieldHtml({ name: 'address.note', label: 'Napomena za dostavljača', optional: true, textarea: true, maxlength: 200, value: saved.addrNote || '', placeholder: 'npr. ulaz B, interfon ne radi — pozovite' })}
      </div>
    </section>

    <section class="co-step" aria-labelledby="s5">
      <h2 class="co-step__title" id="s5"><span class="co-step__n" data-step-pay>5</span>Plaćanje</h2>
      <div data-pay></div>
    </section>

    <section class="co-step" aria-labelledby="s6">
      <h2 class="co-step__title" id="s6"><span class="co-step__n" data-step-note>6</span>Napomena uz porudžbinu <span class="optional">opciono</span></h2>
      ${fieldHtml({ name: 'note', label: 'Napomena', textarea: true, maxlength: 300, placeholder: 'npr. bez luka, pozovite kada stignete' })}
    </section>

    <div class="co-review" data-review aria-live="polite"></div>

    <label class="check"><input type="checkbox" name="remember" ${saved.name || !Object.keys(saved).length ? 'checked' : ''}><span>Zapamti moje podatke na ovom uređaju za sledeću porudžbinu.</span></label>
    <div class="hp" aria-hidden="true"><label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>

    <div class="notice notice--error" data-submit-error hidden></div>

    <div class="co-submit">
      <button type="submit" class="btn btn--gold btn--lg btn--block" data-submit><span class="btn__label">Pošalji porudžbinu</span><span class="num" data-submit-total></span></button>
      <p class="small muted co-legal">Plaćanje gotovinom. Lokal potvrđuje porudžbinu u roku od ${esc(settingNumber('accept_timeout_min', 5))} minuta. Otkazivanje samo telefonom. Podatke koristimo samo za ovu porudžbinu — <a href="/privatnost/">privatnost</a>.</p>
    </div>
  </form>`;
  const labelNote = app().querySelector('[data-field="note"] .field__label');
  if (labelNote) labelNote.classList.add('sr-only');
  update();
}

function renderZoneField(view) {
  const box = app().querySelector('[data-zone-field]');
  if (!box) return;
  const key = [zonesOn(), view.zone, JSON.stringify((catalog().data && catalog().data.zones) || [])].join('|');
  if (key === form.zoneKey) return;
  form.zoneKey = key;
  if (!zonesOn()) {
    box.innerHTML = `<p class="field__hint">${icon('pin')} Dostavljamo po Novom Sadu preko partnerske dostavne službe.</p>`;
    return;
  }
  const z = zoneById(view.zone);
  const result =
    view.zone === 'none'
      ? `<p class="zone-result is-no">${icon('alert')} Dostava na tu lokaciju trenutno nije dostupna. Izaberite preuzimanje u lokalu ili pozovite <a href="tel:${esc(business().phone_e164 || '')}">${esc(business().phone_display || '')}</a>.</p>`
      : z
        ? `<p class="zone-result is-ok">${icon('check')} ${esc(z.name)} · dostava ${esc(deliveryFeeLabel(z))}${z.minOrder ? ` · minimalna porudžbina ${esc(Money.formatRSD(z.minOrder))}` : ''}</p>`
        : '';
  box.innerHTML = `<div class="field" data-field="address.zone"><label class="field__label" for="f-zone">Naselje</label>${zoneSelect('f-zone', 'address.zone', view.zone)}${result}<p class="field__error" role="alert"></p></div>`;
}

function renderWhen(mode, snap) {
  const box = app().querySelector('[data-when]');
  const av = snap ? snap[mode] : null;
  if (!av || !av.canOrder) {
    box.innerHTML = `<p class="muted">Trenutno ne primamo porudžbine${av ? ` — ${esc(closedReason(av, mode))}` : ''}.</p>`;
    return;
  }
  const values = av.slots.map((s) => s.value);
  if (form.when !== 'asap' && !values.includes(form.when)) {
    toast({ text: `Termin ${slotLabelFor(form.when)} više nije dostupan. Izaberite novi termin.`, icon: 'clock' });
    form.when = form.timing === 'later' && values.length ? '' : 'asap';
    if (!values.length) form.timing = 'asap';
  }
  if (!av.days.length) form.timing = 'asap';
  const days = av.days;
  // Before the server's clock arrives the schedule runs on the phone's clock: never keep a day picked from that.
  if (!form.dayChosen || !days.find((d) => d.date === form.day)) form.day = days.length ? days[0].date : '';
  const asapMeta = mode === 'delivery' ? `stiže za ${etaText(av)}` : `spremno za ${etaText(av)}`;
  const timingChip = (value, title, meta, disabled) =>
    `<label class="when-choice"><input class="chip-input" type="radio" name="timing" value="${value}" ${form.timing === value ? 'checked' : ''} ${disabled ? 'disabled' : ''}><span class="chip when-chip"><strong>${title}</strong><small>${esc(meta)}</small></span></label>`;
  let later = '';
  if (form.timing === 'later' && days.length) {
    const day = days.find((d) => d.date === form.day) || days[0];
    later = `<div class="when-later">
      <p class="field__label" id="day-label">Dan</p>
      <div class="chips when-days" role="radiogroup" aria-labelledby="day-label">${days
        .map((d) => `<label><input class="chip-input" type="radio" name="day" value="${esc(d.date)}" ${d.date === day.date ? 'checked' : ''}><span class="chip"><strong>${esc(d.label)}</strong></span></label>`)
        .join('')}</div>
      <p class="field__label" id="time-label">Vreme · ${esc(mode === 'delivery' ? 'dostava' : 'preuzimanje')} na 30 minuta</p>
      <div class="chips when-times" role="radiogroup" aria-labelledby="time-label">${day.slots
        .map((s) => `<label><input class="chip-input" type="radio" name="when" value="${esc(s.value)}" ${form.when === s.value ? 'checked' : ''}><span class="chip">${esc(s.time)}${s.afterMidnight ? ' <small>posle ponoći</small>' : ''}</span></label>`)
        .join('')}</div>
    </div>`;
  }
  box.innerHTML = `<div class="chips when-chips">${timingChip('asap', 'Što pre', asapMeta, false)}${timingChip('later', 'Zakaži', days.length ? `do ${settingNumber('preorder_days', 7)} dana unapred` : 'nema slobodnih termina', !days.length)}</div>${later}`;
}

function renderPay(mode, view) {
  const box = app().querySelector('[data-pay]');
  const total = view.total;
  if (mode === 'pickup') {
    box.innerHTML = `<div class="pay-card">${icon('cash')}<div><strong>Gotovinom na kasi</strong><span>Plaćate ${esc(Money.formatRSD(total))} kada preuzmete porudžbinu.</span></div></div>`;
    return;
  }
  if (view.needsZone) {
    box.innerHTML = `<div class="pay-card">${icon('cash')}<div><strong>Gotovinom dostavljaču</strong><span>Izaberite naselje da bismo izračunali dostavu i ukupan iznos.</span></div></div><div data-field="cash"><p class="field__error" role="alert"></p></div>`;
    return;
  }
  const suggestions = Money.cashSuggestions(total);
  if (typeof form.cashChoice === 'number' && !suggestions.includes(form.cashChoice)) form.cashChoice = form.cashChoice >= total ? form.cashChoice : null;
  const chip = (value, label) =>
    `<label><input class="chip-input" type="radio" name="cashQuick" value="${value}" ${String(form.cashChoice) === String(value) ? 'checked' : ''}><span class="chip">${label}</span></label>`;
  const customOpen = form.cashChoice === 'custom';
  box.innerHTML = `<div class="pay-card">${icon('cash')}<div><strong>Gotovinom dostavljaču</strong><span>Plaćanje karticom trenutno nije moguće.</span></div></div>
  <div class="field cash-field" data-field="cash">
    <p class="field__label" id="cash-label">Sa koliko novca plaćate?</p>
    <div class="chips" role="radiogroup" aria-labelledby="cash-label">
      ${chip('exact', `Tačan iznos · ${esc(Money.formatNumber(total))}`)}
      ${suggestions.map((s) => chip(s, esc(Money.formatRSD(s)))).join('')}
      ${chip('custom', 'Drugi iznos')}
    </div>
    <div class="cash-custom" ${customOpen ? '' : 'hidden'}>
      <label class="sr-only" for="f-cash">Iznos u dinarima</label>
      <input class="input" id="f-cash" name="cashCustom" inputmode="numeric" autocomplete="off" placeholder="npr. 3.000" value="${esc(form.cashCustom)}" aria-describedby="cash-result">
      <span class="cash-custom__unit">RSD</span>
    </div>
    <p class="cash-result" id="cash-result" data-cash-result aria-live="polite"></p>
    <p class="field__error" role="alert"></p>
  </div>`;
  updateCashResult(total);
}

function updateCashResult(total) {
  const out = app().querySelector('[data-cash-result]');
  if (!out) return;
  const amount = cashAmount(total);
  out.className = 'cash-result';
  if (form.cashChoice === null || (form.cashChoice === 'custom' && !form.cashCustom)) {
    out.textContent = '';
    return;
  }
  const v = Validation.validateCash(amount, total, settingNumber('cash_max_over_total', 20000));
  if (!v.ok) {
    out.classList.add('is-error');
    out.textContent = v.message.replace(/(\d+) RSD/, (m, n) => Money.formatRSD(Number(n)));
    return;
  }
  setFieldError('cash', '');
  out.classList.add('is-ok');
  if (v.change === 0) out.innerHTML = `${icon('check')} Plaćate tačan iznos — kusur nije potreban.`;
  else {
    out.innerHTML = `${icon('check')} Dostavljaču je potrebno pripremiti kusur od <strong>${esc(Money.formatRSD(v.change))}</strong>.`;
    if (v.change > 5000) out.innerHTML += `<br><small>Ako možete, pripremite sitnije — toliki kusur nije uvek pri ruci.</small>`;
  }
}

function whenSentence(mode, av) {
  if (form.timing === 'later') return form.when ? slotLabelFor(form.when) : 'izaberite termin';
  if (!av || !av.canOrder) return 'što pre';
  return mode === 'delivery' ? `što pre, stiže za ${etaText(av)}` : `što pre, spremno za ${etaText(av)}`;
}

function renderReview(mode, view, snap) {
  const box = app().querySelector('[data-review]');
  if (!box) return;
  const av = snap ? snap[mode] : null;
  const b = business();
  let where;
  if (mode === 'delivery') {
    const street = [val('address.street'), val('address.number')].filter(Boolean).join(' ');
    const extra = [val('address.apt') ? `stan ${val('address.apt')}` : '', val('address.floor') ? `${val('address.floor')}. sprat`.replace(/^(\D.*)\. sprat$/, 'sprat $1') : ''].filter(Boolean).join(', ');
    where = street ? `Dostava na <strong>${esc(street)}${extra ? ', ' + esc(extra) : ''}</strong>` : 'Dostava na <strong>vašu adresu</strong>';
  } else {
    where = `Preuzimanje u lokalu <strong>${esc(b.address_street || '')}</strong>`;
  }
  let pay;
  if (view.needsZone) pay = `hrana <strong>${esc(Money.formatRSD(view.subtotal))}</strong> + dostava (izaberite naselje)`;
  else {
    pay = `plaćate <strong>${esc(Money.formatRSD(view.total))}</strong> gotovinom${mode === 'pickup' ? ' na kasi' : ''}`;
    if (mode === 'delivery') {
      const amount = cashAmount(view.total);
      if (Number.isFinite(amount) && amount >= view.total) pay += amount === view.total ? ', tačan iznos' : ` · pripremite <strong>${esc(Money.formatRSD(amount))}</strong>, kusur <strong>${esc(Money.formatRSD(amount - view.total))}</strong>`;
    }
  }
  box.innerHTML = `<p class="co-review__label">Proverite</p><p>${where} · <strong>${esc(whenSentence(mode, av))}</strong> · ${pay}.</p>`;
}

function renderAside(view, mode) {
  const box = aside();
  if (!box) return;
  const assets = env().assets;
  if (!view.lines.length) {
    box.innerHTML = '';
    return;
  }
  const deliveryValue = view.deliveryExternal ? esc(deliveryFeeLabel()) : view.needsZone ? 'izaberite naselje' : view.deliveryFree ? 'besplatna' : esc(Money.formatRSD(view.deliveryFee));
  const totalValue = view.needsZone ? `${esc(Money.formatRSD(view.subtotal))} + dostava` : esc(Money.formatRSD(view.total));
  box.innerHTML = `<div class="co-summary">
    <details class="co-summary__details" ${window.matchMedia('(min-width: 1024px)').matches ? 'open' : ''}>
      <summary><span>${view.itemCount} ${view.itemCount === 1 ? 'artikal' : 'artikla'}</span><strong class="num">${totalValue}</strong>${icon('chevron')}</summary>
      <ul class="co-items" role="list">${view.lines
        .map(
          (l) => `<li><span class="co-items__art art-frame" style="--art-bg:${l.product ? artBg(l.product) : '#F2EBDD'}">${l.product ? artSvg(assets, l.product) : ''}</span><span class="co-items__text"><strong>${l.qty}× ${esc(l.product ? l.product.name : '?')}</strong><small>${esc(l.summary)}${l.removedSummary ? ' · ' + esc(l.removedSummary) : ''}${l.note ? ' · „' + esc(l.note) + '“' : ''}</small></span><span class="num">${esc(Money.formatNumber(l.lineTotal))}</span></li>`
        )
        .join('')}</ul>
      <button type="button" class="text-btn" data-edit-cart>${icon('edit')} Izmeni korpu</button>
    </details>
    <div class="totals">
      <div class="totals__row"><span>Međuzbir</span><span>${esc(Money.formatRSD(view.subtotal))}</span></div>
      ${mode === 'delivery' ? `<div class="totals__row"><span>Dostava</span><span>${deliveryValue}</span></div>` : `<div class="totals__row"><span>Preuzimanje</span><span>${esc(Money.formatRSD(0))}</span></div>`}
      <div class="totals__row totals__row--total"><span>Ukupno</span><span data-total>${totalValue}</span></div>
    </div>
  </div>`;
}

/** Re-renders only what depends on mode/time/cart, never the inputs the guest is typing in. */
function update() {
  if (!app().querySelector('[data-checkout-form]')) return;
  const snap = schedule();
  const mode = currentMode();
  const view = cart.view(mode);
  if (view.empty && !form.submitted) {
    renderEmpty();
    return;
  }
  refreshModeMeta(app().querySelector('[data-mode-root]'), snap);
  app().querySelectorAll('[data-delivery-only]').forEach((el) => (el.hidden = mode !== 'delivery'));
  app().querySelector('[data-step-pay]').textContent = mode === 'delivery' ? '5' : '4';
  app().querySelector('[data-step-note]').textContent = mode === 'delivery' ? '6' : '5';
  if (mode === 'delivery') renderZoneField(view);
  // Only rebuild a block when its inputs actually changed: a 30 s clock tick must never steal focus.
  const av = snap ? snap[mode] : null;
  const whenKey = [mode, av && av.canOrder, av && av.asap.etaMin, av && av.asap.etaMax, form.timing, form.day, form.when, av && av.slots.map((s) => s.value).join(',')].join('|');
  if (whenKey !== form.whenKey) {
    form.whenKey = whenKey;
    const focused = document.activeElement;
    const keep = focused && ['timing', 'day', 'when'].includes(focused.name) ? { name: focused.name, value: focused.value } : null;
    renderWhen(mode, snap);
    if (keep) {
      const again = app().querySelector(`[name="${keep.name}"][value="${CSS.escape(keep.value)}"]`);
      if (again) again.focus({ preventScroll: true });
    }
  }
  const payKey = mode + '|' + view.total + '|' + view.needsZone;
  if (payKey !== form.payKey) {
    form.payKey = payKey;
    renderPay(mode, view);
  }
  renderReview(mode, view, snap);
  const asideKey = mode + '|' + view.total + '|' + view.needsZone + '|' + view.lines.map((l) => l.key + ':' + l.qty).join(',');
  if (asideKey !== form.asideKey) {
    form.asideKey = asideKey;
    renderAside(view, mode);
  }
  const closed = app().querySelector('[data-closed]');
  const can = !av || av.canOrder;
  const blocking = view.errors.find((e) => e.code === 'ITEM_UNAVAILABLE' || e.shortfall);
  const zoneBlocked = mode === 'delivery' && view.zone === 'none';
  closed.hidden = can && !blocking;
  if (!can) {
    const other = snap[mode === 'delivery' ? 'pickup' : 'delivery'];
    closed.innerHTML = `${icon('clock')}<span><strong>Trenutno ne primamo porudžbine.</strong> ${
      snap.paused ? esc(business().pause_message || '') : esc(closedReason(av, mode)).replace(/^./, (c) => c.toUpperCase()) + '.'
    } ${other.canOrder ? `<button type="button" class="link" data-switch-mode="${mode === 'delivery' ? 'pickup' : 'delivery'}">${mode === 'delivery' ? 'Preuzimanje u lokalu je moguće' : 'Dostava je moguća'}</button>` : ''}</span>`;
  } else if (blocking) {
    closed.innerHTML = `${icon('alert')}<span>${esc(blocking.message)} <button type="button" class="link" data-edit-cart>Izmeni korpu</button></span>`;
  }
  const submit = app().querySelector('[data-submit]');
  submit.disabled = !can || !!blocking || zoneBlocked || form.submitting;
  app().querySelector('[data-submit-total]').textContent = view.needsZone ? '' : Money.formatRSD(view.total);
}

function renderEmpty() {
  const last = local.get(PLACED_KEY);
  if (last && Date.now() - last.at < 3 * 3600 * 1000) {
    renderConfirmation(last.response, { restored: true });
    return;
  }
  aside().innerHTML = '';
  app().innerHTML = `<div class="cart-empty" style="padding-inline:0"><svg class="art" viewBox="0 0 200 220" aria-hidden="true"><use href="${env().assets.art}#bag"/></svg><h2 class="h3">Korpa je prazna</h2><p class="muted">Izaberite nešto sa menija — porudžbina traje manje od tri minuta.</p><a class="btn btn--gold" href="/meni/"><span class="btn__label">Pogledaj meni</span>${icon('arrow', 'btn__icon')}</a></div>`;
}

// ---------------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------------

function collect(mode, view) {
  return {
    mode,
    when: form.timing === 'asap' ? 'asap' : form.when,
    customer: { name: val('name'), phone: val('phone'), email: val('email') },
    address:
      mode === 'delivery'
        ? { street: val('address.street'), number: val('address.number'), apt: val('address.apt'), floor: val('address.floor'), zone: val('address.zone') || cart.zone(), note: val('address.note') }
        : {},
    cash: mode === 'delivery' ? cashAmount(view.total) : undefined,
    note: val('note'),
    items: view.lines.map((l) => ({ productId: l.productId, qty: l.qty, options: l.options, note: l.note })),
    clientTotal: view.total
  };
}

function validate(payload, view) {
  const errors = {};
  const res = Validation.validateOrderContact(payload);
  Object.assign(errors, res.errors);
  if (form.timing === 'later' && !form.when) errors.when = 'Izaberite dan i vreme ili „Što pre“.';
  if (payload.mode === 'delivery') {
    if (zonesOn()) {
      if (!payload.address.zone) errors['address.zone'] = 'Izaberite naselje za dostavu.';
      else if (payload.address.zone === 'none' || !zoneById(payload.address.zone)) errors['address.zone'] = 'Dostava na tu lokaciju trenutno nije dostupna. Izaberite preuzimanje u lokalu.';
    }
    if (!errors['address.zone']) {
      if (form.cashChoice === null) errors.cash = 'Izaberite sa koliko novca plaćate.';
      else {
        const c = Validation.validateCash(payload.cash, view.total, settingNumber('cash_max_over_total', 20000));
        if (!c.ok) errors.cash = c.message.replace(/(\d+) RSD/, (m, n) => Money.formatRSD(Number(n)));
      }
    }
  }
  return errors;
}

function focusFirstError() {
  const first = app().querySelector('.field.has-error input, .field.has-error textarea, .field.has-error select, .field.has-error .chip-input');
  const field = first ? first.closest('.field') : null;
  if (field) {
    field.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
    first.focus({ preventScroll: true });
  }
}

/** Short hash of the order content (the stored key never contains the guest's name, phone or address). */
function fingerprint(payload) {
  const { clientTotal, ...rest } = payload;
  const text = JSON.stringify(rest) + '|' + clientTotal;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16) + (h1 >>> 0).toString(16);
}

// A send whose answer never arrived (connection lost, page refreshed or closed mid-send) stays "unresolved"
// for a while. Before anything new is sent, the server is asked whether that attempt already became an order.
const PENDING_TTL = 30 * 60 * 1000;
const UNKNOWN_OUTCOME = ['TIMEOUT', 'NETWORK', 'BAD_RESPONSE', 'SERVER_ERROR'];

function pendingSend() {
  const p = local.get(PENDING_KEY);
  if (!p || !p.requestId || Date.now() - (p.at || 0) > PENDING_TTL) return null;
  return p;
}

/**
 * 'error' when the server can't be reached, the saved order when it arrived, null when it never did.
 * A server that answers with an error is not a reason to block the guest: the new send is still deduplicated.
 */
async function lookupPending(p) {
  const res = await apiPost('order.lookup', { requestId: p.requestId }, { timeoutMs: 15000 });
  if (!res.ok) return ['TIMEOUT', 'NETWORK', 'BAD_RESPONSE'].includes(res.error.code) ? 'error' : null;
  return res.data.found ? res.data.order : null;
}

async function submit(e) {
  e.preventDefault();
  if (form.submitting) return;
  clearErrors();
  const mode = currentMode();
  const view = cart.view(mode);
  const payload = collect(mode, view);
  const errors = validate(payload, view);
  if (Object.keys(errors).length) {
    Object.entries(errors).forEach(([k, m]) => setFieldError(k, m));
    if (errors.when) app().querySelector('[data-when-error]').textContent = errors.when;
    if (errors.mode) toast({ text: errors.mode, tone: 'error', icon: 'alert' });
    focusFirstError();
    return;
  }
  const fp = fingerprint(payload);
  let pending = pendingSend();
  if (pending && pending.sending && pending.fp !== fp) {
    setBusy(true, 'Proveravamo prethodno slanje…');
    const earlier = await lookupPending(pending);
    setBusy(false);
    if (earlier === 'error') {
      await onError({ code: 'NETWORK', message: 'Nema veze sa serverom. Proverite internet i pokušajte ponovo.' });
      return;
    }
    if (earlier) {
      onPlaced(earlier, payload, view, { earlier: true });
      return;
    }
    pending = null;
  }
  // Same content → same requestId, so a retry after a timeout can never create a second order.
  const requestId = pending && pending.fp === fp ? pending.requestId : uuid();
  local.set(PENDING_KEY, { fp, requestId, sending: true, at: Date.now() });
  payload.requestId = requestId;
  payload.meta = { elapsedMs: Math.round(performance.now() - form.startedAt), channel: channel(), hp: val('website') };

  setBusy(true);
  let res = await apiPost('order.create', payload);
  if (!res.ok && ['TIMEOUT', 'NETWORK', 'BAD_RESPONSE'].includes(res.error.code)) {
    setBusy(true, 'Proveravamo porudžbinu…');
    await new Promise((r) => setTimeout(r, 1800));
    res = await apiPost('order.create', payload);
  }
  setBusy(false);
  if (res.ok) {
    onPlaced(res.data, payload, view);
    return;
  }
  // The server answered with a reason: nothing was saved, the next send may carry new content.
  if (!UNKNOWN_OUTCOME.includes(res.error.code)) local.set(PENDING_KEY, { fp, requestId, sending: false, at: Date.now() });
  await onError(res.error);
}

/** Opening checkout after an unanswered send: if that send became an order, show it instead of the form. */
async function resolveEarlierSend() {
  const p = pendingSend();
  if (!p || !p.sending) return;
  const earlier = await lookupPending(p);
  if (!earlier || earlier === 'error' || form.submitted || form.submitting) return;
  const mode = currentMode();
  const view = cart.view(mode);
  onPlaced(earlier, collect(mode, view), view, { earlier: true });
}

function setBusy(busy, label) {
  form.submitting = busy;
  const btn = app().querySelector('[data-submit]');
  if (!btn) return;
  btn.classList.toggle('is-busy', busy);
  btn.setAttribute('aria-busy', String(busy));
  const l = btn.querySelector('.btn__label');
  if (l) l.textContent = busy ? label || 'Šaljemo porudžbinu…' : 'Pošalji porudžbinu';
  if (!busy) update();
}

function channel() {
  const q = new URLSearchParams(location.search);
  const stored = session.get('gg:channel');
  if (stored) return stored;
  const utm = q.get('utm_source');
  let c = utm || '';
  if (!c && document.referrer) {
    try {
      const host = new URL(document.referrer).hostname;
      if (!host.endsWith(location.hostname)) c = /instagram/.test(host) ? 'instagram' : /google/.test(host) ? 'google' : /facebook|fb\./.test(host) ? 'facebook' : host.replace(/^www\./, '');
    } catch {
      /* ignore */
    }
  }
  return c || 'direct';
}

async function onError(error) {
  const banner = app().querySelector('[data-submit-error]');
  const phone = business().phone_display || '';
  const tel = business().phone_e164 || '';
  const show = (html) => {
    banner.hidden = false;
    banner.innerHTML = `${icon('alert')}<div>${html}</div>`;
    banner.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
  };
  switch (error.code) {
    case 'VALIDATION':
      if (error.fields) Object.entries(error.fields).forEach(([k, m]) => setFieldError(k, m));
      else if (error.field) setFieldError(error.field, error.message);
      if (error.field === 'items' || !app().querySelector(`[data-field="${error.field}"]`)) show(`<strong>${esc(error.message)}</strong>`);
      else focusFirstError();
      break;
    case 'MIN_ORDER':
      await refreshLive();
      update();
      show(`<strong>${esc(error.message)}</strong> <button type="button" class="link" data-edit-cart>Dodaj nešto iz korpe</button>`);
      break;
    case 'ZONE_UNAVAILABLE':
      await refreshLive();
      form.zoneKey = '';
      update();
      setFieldError('address.zone', error.message);
      focusFirstError();
      break;
    case 'PRICE_CHANGED':
    case 'ITEM_UNAVAILABLE':
      await refreshLive();
      update();
      show(`<strong>${esc(error.message)}</strong> <span class="small">Proverite korpu i iznos pa pošaljite ponovo.</span>`);
      break;
    case 'SLOT_UNAVAILABLE':
      await refreshLive();
      form.when = form.timing === 'later' ? '' : 'asap';
      form.whenKey = '';
      update();
      app().querySelector('[data-when-error]').textContent = error.message;
      app().querySelector('[data-when]').scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
      break;
    case 'CLOSED':
      await refreshLive();
      update();
      show(`<strong>${esc(error.message)}</strong>`);
      break;
    case 'RATE_LIMITED':
    case 'BUSY':
      show(`<strong>${esc(error.message)}</strong><div class="cluster" style="margin-top:0.7rem"><button type="button" class="btn btn--sm btn--blue" data-retry><span class="btn__label">Pokušaj ponovo</span></button><a class="btn btn--sm btn--ghost" href="tel:${esc(tel)}"><span class="btn__label">Pozovi ${esc(phone)}</span></a></div>`);
      break;
    default:
      show(
        `<strong>${esc(error.message || 'Porudžbina trenutno nije mogla da bude poslata.')}</strong><div class="cluster" style="margin-top:0.7rem"><button type="button" class="btn btn--sm btn--blue" data-retry><span class="btn__label">Pokušaj ponovo</span></button><a class="btn btn--sm btn--ghost" href="tel:${esc(tel)}" data-track="checkout-error"><span class="btn__label">Pozovi ${esc(phone)}</span></a></div><p class="small" style="margin-top:0.5rem">Ponovni pokušaj je bezbedan: ista porudžbina neće stići dva puta.</p>`
      );
  }
  track('order_error', { code: error.code });
}

function onPlaced(response, payload, view, { earlier } = {}) {
  form.submitted = true;
  local.remove(PENDING_KEY);
  if (earlier) toast({ text: `Porudžbina #${response.publicNumber} je već stigla ranije — nije poslata dva puta.`, icon: 'check-circle', timeout: 9000 });
  const remember = app().querySelector('[name="remember"]');
  if (remember && remember.checked) {
    const prev = local.get(CUSTOMER_KEY) || {};
    local.set(CUSTOMER_KEY, {
      name: payload.customer.name,
      phone: payload.customer.phone,
      email: payload.customer.email,
      street: payload.address.street || prev.street || '',
      number: payload.address.number || prev.number || '',
      apt: payload.address.apt || (payload.mode === 'delivery' ? '' : prev.apt || ''),
      floor: payload.address.floor || (payload.mode === 'delivery' ? '' : prev.floor || ''),
      addrNote: payload.address.note || '',
      zone: payload.address.zone || prev.zone || ''
    });
  } else local.remove(CUSTOMER_KEY);
  cart.rememberLastOrder(response, payload.items);
  local.set(PLACED_KEY, { at: Date.now(), response });
  cart.clearCart();
  track('purchase', { transaction_id: response.orderId, value: response.total, currency: 'RSD', shipping: response.deliveryFee, items: view.lines.map((l) => ({ item_id: l.productId, quantity: l.qty, price: l.unitPrice })) });
  renderConfirmation(response, {});
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

// ---------------------------------------------------------------------------
// Confirmation + live status + feedback
// ---------------------------------------------------------------------------

const STEPS = [
  ['NEW', 'Primljena'],
  ['CONFIRMED', 'Potvrđena'],
  ['PREPARING', 'U pripremi'],
  ['READY', 'Spremna'],
  ['COMPLETED', 'Završena']
];
const ORDER = STEPS.map((s) => s[0]);
const FINAL = ['COMPLETED', 'REJECTED'];

function statusMessage(s, mode) {
  const phone = business().phone_display || (s.location && s.location.phone) || '';
  const tel = business().phone_e164 || (s.location && s.location.phoneE164) || '';
  const call = `<a href="tel:${esc(tel)}"><strong>${esc(phone)}</strong></a>`;
  switch (s.status) {
    case 'NEW':
      return s.overdue
        ? { tone: 'warn', html: `Lokal još nije potvrdio porudžbinu. Ne brinite — pozovite nas na ${call} i recite broj <strong>#${s.publicNumber}</strong>.` }
        : { tone: 'wait', html: `Poslato. Čekamo da lokal potvrdi porudžbinu — obično za manje od ${esc(settingNumber('accept_timeout_min', 5))} minuta. Ova stranica se osvežava sama.` };
    case 'CONFIRMED':
      return { tone: 'ok', html: 'Lokal je potvrdio porudžbinu. Uskoro ide u pripremu.' };
    case 'PREPARING':
      return { tone: 'ok', html: 'Porudžbina se priprema.' };
    case 'READY':
      return { tone: 'ok', html: mode === 'delivery' ? 'Spremna je i čeka dostavljača.' : 'Spremna je — možete da dođete. Plaćate na kasi.' };
    case 'COMPLETED':
      return { tone: 'ok', html: 'Porudžbina je završena. Prijatno!' };
    case 'REJECTED':
      return { tone: 'bad', html: `Nažalost, lokal ovu porudžbinu nije prihvatio. Ništa ne plaćate. Za pitanja pozovite ${call}.` };
    default:
      return { tone: 'wait', html: '' };
  }
}

function trackerHtml(s, mode) {
  const rejected = s.status === 'REJECTED';
  const idx = ORDER.indexOf(s.status);
  const msg = statusMessage(s, mode);
  return `<div class="tracker${rejected ? ' is-cancelled' : ''}" style="--steps:${STEPS.length}" data-status="${esc(s.status)}">
    <div class="tracker__title"><h2>Status porudžbine</h2><span class="small muted" data-status-time></span></div>
    ${
      rejected
        ? `<p class="tracker__rejected">${icon('alert')}<strong>Odbijena</strong></p>`
        : `<ol class="tracker__steps">${STEPS.map(([code, label], i) => {
            const done = i < idx || s.status === 'COMPLETED';
            const cur = i === idx && s.status !== 'COMPLETED';
            return `<li class="tracker__step${done ? ' is-done' : ''}${cur ? ' is-current' : ''}" ${cur ? 'aria-current="step"' : ''}><span class="tracker__mark" aria-hidden="true">${done ? '✓' : cur ? '●' : '○'}</span> ${label}</li>`;
          }).join(' ')}</ol>`
    }
    <p class="tracker__message tracker__message--${msg.tone}" data-status-message>${msg.html}</p>
    ${s.whenText && s.when !== 'asap' ? `<p class="small muted">${esc(s.whenText.charAt(0) + s.whenText.slice(1).toLowerCase())}</p>` : ''}
  </div>`;
}

function feedbackHtml() {
  const chip = (group, key, label) => `<label><input class="chip-input" type="checkbox" name="${group}" value="${esc(key)}"><span class="chip">${esc(label)}</span></label>`;
  return `<form class="feedback" data-feedback novalidate>
    <h2 class="h4">Kako je bilo?</h2>
    <fieldset class="stars" data-field="rating"><legend class="sr-only">Ocena od 1 do 5</legend>${[1, 2, 3, 4, 5]
      .map((n) => `<label class="star"><input type="radio" name="rating" value="${n}"><span aria-hidden="true">★</span><span class="sr-only">${n} od 5</span></label>`)
      .join('')}<p class="field__error" role="alert"></p></fieldset>
    <p class="field__label">Šta je bilo dobro?</p>
    <div class="chips">${Object.entries(Validation.FEEDBACK_GOOD).map(([k, l]) => chip('good', k, l)).join('')}</div>
    <p class="field__label">Šta može bolje?</p>
    <div class="chips">${Object.entries(Validation.FEEDBACK_IMPROVE).map(([k, l]) => chip('improve', k, l)).join('')}</div>
    <div class="field" data-field="comment"><label class="field__label" for="fb-comment">Komentar <span class="optional">opciono</span></label><textarea class="input" id="fb-comment" name="comment" rows="3" maxlength="600"></textarea><p class="field__error" role="alert"></p></div>
    <button type="submit" class="btn btn--blue"><span class="btn__label">Pošalji ocenu</span></button>
  </form>`;
}

let statusCtx = null; // { id, t, mode }
let pollTimer = null;

function renderStatus(s) {
  const box = $('[data-tracker]');
  if (!box) return;
  box.innerHTML = trackerHtml(s, s.mode || (statusCtx && statusCtx.mode));
  const t = box.querySelector('[data-status-time]');
  if (t) t.textContent = `osveženo ${new Date().toLocaleTimeString('sr-Latn-RS', { hour: '2-digit', minute: '2-digit' })}`;
  const fb = $('[data-feedback-slot]');
  if (fb) {
    if (s.feedbackAllowed && !fb.querySelector('[data-feedback]') && !fb.dataset.sent) fb.innerHTML = feedbackHtml();
    else if (!s.feedbackAllowed && !fb.dataset.sent) fb.innerHTML = s.status === 'COMPLETED' ? '<p class="notice">Hvala! Vaša ocena je već zabeležena.</p>' : '';
  }
  const conf = $('[data-confirm-ok]');
  if (conf) {
    conf.innerHTML = s.status === 'REJECTED' ? `${icon('alert')} Porudžbina odbijena` : s.status === 'NEW' ? `${icon('clock')} Porudžbina poslata — čeka potvrdu` : `${icon('check-circle')} Porudžbina potvrđena`;
    conf.classList.toggle('is-wait', s.status === 'NEW');
    conf.classList.toggle('is-bad', s.status === 'REJECTED');
  }
}

function pollStatus(orderId, token, mode) {
  clearTimeout(pollTimer);
  if (!orderId || !token) return;
  statusCtx = { id: orderId, t: token, mode };
  const started = Date.now();
  const tick = async () => {
    if (document.hidden) {
      pollTimer = setTimeout(tick, 15000);
      return;
    }
    const res = await apiGet('order.status', { id: orderId, t: token });
    if (res.ok) {
      renderStatus(res.data);
      if (FINAL.includes(res.data.status)) return;
    }
    if (Date.now() - started < 6 * 3600 * 1000) pollTimer = setTimeout(tick, res.ok && res.data.status === 'NEW' ? 10000 : 20000);
  };
  tick();
}

function renderConfirmation(r, { restored }) {
  const b = business();
  aside().innerHTML = '';
  const isDelivery = r.mode === 'delivery';
  const whenText =
    r.when === 'asap' ? (isDelivery ? `Što pre — okvirno oko ${r.promisedTime}` : `Što pre — spremno za ${r.etaMin}–${r.etaMax} min (oko ${r.promisedTime})`) : r.whenText.replace(/^ZAKAZANO /, 'Zakazano: ');
  const cashText = isDelivery
    ? r.change
      ? `Pripremite <strong>${esc(Money.formatRSD(r.cash))}</strong> — dostavljač vraća kusur <strong>${esc(Money.formatRSD(r.change))}</strong>.`
      : 'Plaćate tačan iznos, kusur nije potreban.'
    : 'Plaćate gotovinom na kasi.';
  app().innerHTML = `<div class="confirm">
    ${restored ? '<p class="small muted">Vaša poslednja porudžbina</p>' : ''}
    <article class="ticket confirm__ticket" aria-labelledby="confirm-title">
      <div class="confirm__top">
        <p class="confirm__ok is-wait" id="confirm-title" data-confirm-ok>${icon('clock')} Porudžbina poslata — čeka potvrdu</p>
        <p class="ticket__number" aria-label="Broj porudžbine ${r.publicNumber}"><span>#</span>${r.publicNumber}</p>
        <p class="confirm__save">Sačuvajte broj porudžbine. Ako nas zovete, recite samo broj.</p>
      </div>
      <hr class="ticket__tear">
      <dl class="confirm__details">
        <div><dt>Lokal</dt><dd>${esc(r.location.name)}<small>${esc(r.location.address)}</small></dd></div>
        <div><dt>Način</dt><dd>${isDelivery ? 'Dostava' : 'Preuzimanje u lokalu'}${isDelivery && r.address ? `<small>${esc(r.address.line)}${r.address.aptFloor ? ', ' + esc(r.address.aptFloor) : ''}${r.address.zone ? ' · ' + esc(r.address.zone) : ''}</small>` : ''}</dd></div>
        <div><dt>Vreme</dt><dd>${esc(whenText)}</dd></div>
        <div><dt>Ukupno</dt><dd class="num">${esc(Money.formatRSD(r.total))}${r.deliveryFee ? `<small>hrana ${esc(Money.formatRSD(r.subtotal))} + dostava ${esc(Money.formatRSD(r.deliveryFee))}</small>` : ''}</dd></div>
        <div><dt>Plaćanje</dt><dd>Gotovina</dd></div>
        <div class="confirm__cash"><dt>Kusur</dt><dd>${cashText}</dd></div>
      </dl>
    </article>
    <div data-tracker>${trackerHtml({ status: r.status || 'NEW', publicNumber: r.publicNumber, overdue: false, when: r.when, whenText: r.whenText, location: r.location }, r.mode)}</div>
    <div data-feedback-slot></div>
    <div class="confirm__actions">
      <button type="button" class="btn btn--sm btn--ghost" data-copy="${r.publicNumber}">${icon('copy', 'btn__icon')}<span class="btn__label">Kopiraj broj</span></button>
      <button type="button" class="btn btn--sm btn--ghost" data-share>${icon('share', 'btn__icon')}<span class="btn__label">Sačuvaj</span></button>
      <button type="button" class="btn btn--sm btn--ghost" data-print>${icon('print', 'btn__icon')}<span class="btn__label">Štampaj</span></button>
    </div>
    <details class="confirm__items"><summary>Šta ste poručili (${r.items.reduce((n, i) => n + i.qty, 0)})</summary><ul role="list">${r.items
      .map((i) => `<li><strong>${i.qty}× ${esc(i.name)}</strong> <span class="num">${esc(Money.formatNumber(i.lineTotal))}</span>${i.summary ? `<small>${esc(i.summary)}</small>` : ''}${i.removedSummary ? `<small class="bez">${esc(i.removedSummary)}</small>` : ''}${i.note ? `<small>„${esc(i.note)}“</small>` : ''}</li>`)
      .join('')}</ul></details>
    <p class="notice">${icon('phone')}<span>Otkazivanje ili izmena samo telefonom: <a href="tel:${esc(r.location.phoneE164)}" data-track="confirmation"><strong>${esc(r.location.phone)}</strong></a> — recite broj <strong>#${r.publicNumber}</strong>.</span></p>
    <div class="cluster"><a class="btn btn--gold" href="/meni/"><span class="btn__label">Nazad na meni</span></a><a class="link" href="${esc(statusHref(r.orderId, r.statusToken))}">Link za praćenje statusa</a></div>
  </div>`;
  pollStatus(r.orderId, r.statusToken, r.mode);
  document.title = `Porudžbina #${r.publicNumber} | ${b.business_name || 'Grčki Giros'}`;
}

function statusHref(id, t) {
  return `/porudzbina/?id=${encodeURIComponent(id)}&t=${encodeURIComponent(t)}`;
}

async function renderStatusFromLink(id, t) {
  aside().innerHTML = '';
  app().innerHTML = `<div class="confirm"><article class="ticket confirm__ticket"><div class="confirm__top"><p class="confirm__ok" data-confirm-ok>${icon('clock')} Porudžbina</p><p class="ticket__number" data-status-number>…</p><p class="confirm__save">Status se osvežava sam.</p></div></article><div data-tracker></div><div data-feedback-slot></div>
  <p class="notice">${icon('phone')}<span>Otkazivanje ili izmena samo telefonom: <a href="tel:${esc(business().phone_e164 || '')}"><strong>${esc(business().phone_display || '')}</strong></a></span></p></div>`;
  const res = await apiGet('order.status', { id, t });
  if (!res.ok) {
    app().innerHTML = `<div class="notice notice--error">${icon('alert')}<span>Porudžbina nije pronađena. Proverite link iz emaila ili nas pozovite na ${esc(business().phone_display || '')}.</span></div>`;
    return;
  }
  $('[data-status-number]').innerHTML = `<span>#</span>${res.data.publicNumber}`;
  statusCtx = { id, t, mode: res.data.mode };
  renderStatus(res.data);
  document.title = `Porudžbina #${res.data.publicNumber} | ${business().business_name || 'Grčki Giros'}`;
  if (!FINAL.includes(res.data.status)) pollStatus(id, t, res.data.mode);
}

async function submitFeedback(e) {
  e.preventDefault();
  const f = e.target.closest('[data-feedback]');
  if (!f || !statusCtx || f.dataset.busy) return;
  const rating = Number((f.querySelector('[name="rating"]:checked') || {}).value || 0);
  const payload = {
    id: statusCtx.id,
    t: statusCtx.t,
    rating,
    good: [...f.querySelectorAll('[name="good"]:checked')].map((x) => x.value),
    improve: [...f.querySelectorAll('[name="improve"]:checked')].map((x) => x.value),
    comment: f.querySelector('[name="comment"]').value
  };
  const v = Validation.validateFeedback(payload);
  f.querySelectorAll('[data-field]').forEach((x) => {
    const err = x.querySelector('.field__error');
    if (err) err.textContent = v.errors[x.dataset.field] || '';
  });
  if (!v.ok) return;
  f.dataset.busy = '1';
  const btn = f.querySelector('button[type="submit"] .btn__label');
  btn.textContent = 'Šaljemo…';
  const res = await apiPost('feedback.submit', payload);
  delete f.dataset.busy;
  if (!res.ok) {
    btn.textContent = 'Pošalji ocenu';
    toast({ text: res.error.message || 'Ocena nije poslata. Pokušajte ponovo.', tone: 'error', icon: 'alert' });
    return;
  }
  const slot = $('[data-feedback-slot]');
  slot.dataset.sent = '1';
  slot.innerHTML = `<p class="notice notice--ok" data-feedback-done>${icon('check-circle')}<span><strong>Hvala na oceni!</strong> Pročitaćemo je.</span></p>`;
  track('feedback', { rating });
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

function wire() {
  const root = app();
  on(root, 'submit', '[data-checkout-form]', submit);
  on(root, 'submit', '[data-feedback]', submitFeedback);
  on(root, 'change', '[name="mode"]', (e, el) => {
    cart.setMode(el.value);
    update();
  });
  on(root, 'click', '[data-switch-mode]', (e, el) => {
    cart.setMode(el.dataset.switchMode);
    const radio = root.querySelector(`[name="mode"][value="${el.dataset.switchMode}"]`);
    if (radio) radio.checked = true;
    update();
  });
  on(root, 'change', '[name="timing"]', (e, el) => {
    form.timing = el.value;
    if (form.timing === 'asap') form.when = 'asap';
    else if (form.when === 'asap') form.when = '';
    root.querySelector('[data-when-error]').textContent = '';
    update();
  });
  on(root, 'change', '[name="day"]', (e, el) => {
    form.day = el.value;
    form.dayChosen = true;
    form.when = '';
    update();
  });
  on(root, 'change', '[name="when"]', (e, el) => {
    form.when = el.value;
    root.querySelector('[data-when-error]').textContent = '';
    renderReview(currentMode(), cart.view(currentMode()), schedule());
  });
  on(root, 'change', '[name="cashQuick"]', (e, el) => {
    form.cashChoice = el.value === 'exact' || el.value === 'custom' ? el.value : Number(el.value);
    const custom = root.querySelector('.cash-custom');
    if (custom) custom.hidden = form.cashChoice !== 'custom';
    if (form.cashChoice === 'custom') root.querySelector('[name="cashCustom"]').focus();
    const total = cart.view(currentMode()).total;
    updateCashResult(total);
    renderReview(currentMode(), cart.view(currentMode()), schedule());
    setFieldError('cash', '');
  });
  on(root, 'input', '[name="cashCustom"]', (e, el) => {
    form.cashCustom = el.value;
    const total = cart.view(currentMode()).total;
    updateCashResult(total);
    renderReview(currentMode(), cart.view(currentMode()), schedule());
  });
  on(root, 'input', '[name^="address."]', () => renderReview(currentMode(), cart.view(currentMode()), schedule()));
  on(root, 'change', '[name="address.zone"]', (e, el) => {
    cart.setZone(el.value);
    setFieldError('address.zone', '');
  });
  root.addEventListener(
    'focusout',
    (e) => {
      const el = e.target;
      if (!el.name || form.submitting) return;
      const field = el.closest('[data-field]');
      if (!field || !field.classList.contains('has-error')) return;
      const mode = currentMode();
      const errs = validate(collect(mode, cart.view(mode)), cart.view(mode));
      setFieldError(field.dataset.field, errs[field.dataset.field] || '');
    },
    true
  );
  on(document, 'click', '[data-edit-cart]', (e) => {
    e.preventDefault();
    openCart();
  });
  on(document, 'click', '[data-retry]', () => root.querySelector('[data-checkout-form]').requestSubmit());
  on(document, 'click', '[data-copy]', async (e, el) => {
    const ok = await copyText('#' + el.dataset.copy);
    toast({ text: ok ? `Broj #${el.dataset.copy} je kopiran.` : 'Kopiranje nije uspelo.', icon: ok ? 'copy' : 'alert' });
  });
  on(document, 'click', '[data-print]', () => window.print());
  on(document, 'click', '[data-share]', async () => {
    const placed = local.get(PLACED_KEY);
    if (!placed) return;
    const r = placed.response;
    const text = `Grčki Giros — porudžbina #${r.publicNumber}, ${Money.formatRSD(r.total)}, ${r.mode === 'delivery' ? 'dostava' : 'preuzimanje'} ${r.when === 'asap' ? 'što pre (oko ' + r.promisedTime + ')' : r.whenText.toLowerCase()}. Status: ${location.origin}${statusHref(r.orderId, r.statusToken)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Porudžbina #${r.publicNumber}`, text });
        return;
      } catch {
        /* cancelled */
      }
    }
    const ok = await copyText(text);
    toast({ text: ok ? 'Detalji porudžbine su kopirani.' : 'Nije uspelo.', icon: 'copy' });
  });
}

async function init() {
  await bootCommon();
  wire();
  const q = new URLSearchParams(location.search);
  if (q.get('id') && q.get('t')) {
    renderStatusFromLink(q.get('id'), q.get('t'));
    return;
  }
  if (cart.itemCount() === 0) {
    renderEmpty();
  } else {
    if (!cart.mode()) cart.setMode(defaultMode(schedule(), null));
    renderForm();
    resolveEarlierSend();
  }
  subscribe('cart', () => {
    if (form.submitted) return;
    if (cart.itemCount() === 0) renderEmpty();
    else if (!app().querySelector('[data-checkout-form]')) renderForm();
    else update();
  });
  subscribe('availability', () => update());
  subscribe('catalog', () => {
    form.zoneKey = '';
    update();
  });
}

init();
