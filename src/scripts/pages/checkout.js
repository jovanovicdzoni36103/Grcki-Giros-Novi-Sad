// /porudzbina/ — checkout, confirmation and live order status.
// The guest must never wonder: did it go through, where does it go, how much, when, how much cash.
import Money from '../shared/money.cjs';
import Validation from '../shared/validation.cjs';
import { $, $$, on, esc, icon, uuid, env, prefersReducedMotion } from '../core/dom.js';
import { subscribe } from '../core/events.js';
import { local, session } from '../core/storage.js';
import { apiPost, apiGet } from '../core/api.js';
import { catalog, business, settingNumber, refreshLive, productById } from '../core/catalog.js';
import { schedule } from '../core/availability.js';
import * as cart from '../core/cart.js';
import { bootCommon } from './common.js';
import { modeSwitch, refreshModeMeta, defaultMode, deliveryFeeLabel } from '../ui/mode.js';
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
  when: 'asap',
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

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

function renderForm() {
  const saved = local.get(CUSTOMER_KEY) || {};
  const snap = schedule();
  const mode = currentMode();
  const b = business();
  const zonesOn = String(b.zones_enabled).toUpperCase() === 'TRUE';
  const zones = (catalog().data && catalog().data.zones) || [];
  form.startedAt = performance.now();
  form.whenKey = form.payKey = form.asideKey = '';
  app().innerHTML = `
  <form class="checkout-form" data-checkout-form novalidate>
    <div class="notice notice--closed" data-closed hidden></div>

    <section class="co-step" aria-labelledby="s1">
      <h2 class="co-step__title" id="s1"><span class="co-step__n">1</span>Kako želite da preuzmete?</h2>
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
        ${fieldHtml({ name: 'email', label: 'Email', type: 'email', autocomplete: 'email', inputmode: 'email', optional: true, value: saved.email || '', hint: 'Za potvrdu i praćenje statusa porudžbine.', maxlength: 120 })}
      </div>
    </section>

    <section class="co-step" aria-labelledby="s4" data-delivery-only>
      <h2 class="co-step__title" id="s4"><span class="co-step__n">4</span>Adresa za dostavu</h2>
      <div class="stack">
        <div class="field-row">
          ${fieldHtml({ name: 'address.street', label: 'Ulica', autocomplete: 'address-line1', value: saved.street || '', maxlength: 80 })}
          ${fieldHtml({ name: 'address.number', label: 'Broj', autocomplete: 'off', value: saved.number || '', placeholder: '12a', maxlength: 12 })}
        </div>
        ${fieldHtml({ name: 'address.apt', label: 'Stan, sprat, ulaz, interfon', autocomplete: 'address-line2', optional: true, value: saved.apt || '', placeholder: 'npr. ulaz B, 3. sprat, stan 12', maxlength: 60 })}
        ${
          zonesOn && zones.length
            ? `<div class="field" data-field="address.zone"><label class="field__label" for="f-zone">Naselje</label><select class="input" id="f-zone" name="address.zone"><option value="">Izaberite naselje</option>${zones
                .map((z) => `<optgroup label="${esc(z.name)} · ${esc(Money.formatRSD(z.fee))}">${z.areas.map((a) => `<option value="${esc(z.id)}" ${saved.zone === z.id ? '' : ''}>${esc(a)}</option>`).join('')}</optgroup>`)
                .join('')}</select><p class="field__error" role="alert"></p></div>`
            : `<p class="field__hint">${icon('pin')} Dostavljamo po Novom Sadu preko partnerske dostavne službe.</p>`
        }
        ${fieldHtml({ name: 'address.note', label: 'Napomena za dostavljača', optional: true, textarea: true, maxlength: 200, value: saved.addrNote || '', placeholder: 'npr. interfon ne radi, pozovite' })}
      </div>
    </section>

    <section class="co-step" aria-labelledby="s5">
      <h2 class="co-step__title" id="s5"><span class="co-step__n" data-step-pay>5</span>Plaćanje</h2>
      <div data-pay></div>
    </section>

    <section class="co-step" aria-labelledby="s6">
      <h2 class="co-step__title" id="s6"><span class="co-step__n" data-step-note>6</span>Napomena za kuhinju <span class="optional">opciono</span></h2>
      ${fieldHtml({ name: 'note', label: 'Napomena', textarea: true, maxlength: 300, placeholder: 'npr. sve bez luka, dodatne salvete' })}
    </section>

    <div class="co-review" data-review aria-live="polite"></div>

    <label class="check"><input type="checkbox" name="remember" ${saved.name || !Object.keys(saved).length ? 'checked' : ''}><span>Zapamti moje podatke na ovom uređaju za sledeću porudžbinu.</span></label>
    <div class="hp" aria-hidden="true"><label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>

    <div class="notice notice--error" data-submit-error hidden></div>

    <div class="co-submit">
      <button type="submit" class="btn btn--gold btn--lg btn--block" data-submit><span class="btn__label">Naruči</span><span class="num" data-submit-total></span></button>
      <p class="small muted co-legal">Klikom na „Naruči“ šaljete porudžbinu lokalu. Podatke koristimo samo za ovu porudžbinu — <a href="/privatnost/">privatnost</a>.</p>
    </div>
  </form>`;
  const labelNote = app().querySelector('[data-field="note"] .field__label');
  if (labelNote) labelNote.classList.add('sr-only');
  update();
}

function renderWhen(mode, snap) {
  const box = app().querySelector('[data-when]');
  const av = snap ? snap[mode] : null;
  if (!av || !av.canOrder) {
    box.innerHTML = `<p class="muted">${av && av.next ? `Poručivanje je moguće ${esc(av.next.label)}.` : 'Trenutno nije moguće poručiti.'}</p>`;
    return;
  }
  const values = ['asap', ...av.slots.map((s) => s.value)];
  if (!values.includes(form.when)) {
    if (form.when !== 'asap') toast({ text: `Termin ${form.when} više nije dostupan. Izabrano je „Što pre“.`, icon: 'clock' });
    form.when = 'asap';
  }
  const asapMeta = mode === 'delivery' ? `oko ${av.asap.readyLabel}` : `za ${av.asap.etaMin}–${av.asap.etaMax} min`;
  const chip = (value, title, meta) =>
    `<label><input class="chip-input" type="radio" name="when" value="${value}" ${form.when === value ? 'checked' : ''}><span class="chip when-chip"><strong>${title}</strong>${meta ? `<small>${esc(meta)}</small>` : ''}</span></label>`;
  box.innerHTML = `<div class="chips when-chips">${chip('asap', 'Što pre', asapMeta)}${av.slots.map((s) => chip(s.value, s.label, mode === 'delivery' ? 'dostava' : 'preuzimanje')).join('')}</div>
    <p class="field__hint" style="margin-top:0.6rem">${
      av.slots.length ? `Zakazivanje do ${settingNumber('preorder_max_ahead_min', 120) / 60} h unapred, danas.` : 'Za danas više nema termina za zakazivanje — ostaje „Što pre“.'
    }</p>`;
}

function renderPay(mode, total) {
  const box = app().querySelector('[data-pay]');
  if (mode === 'pickup') {
    box.innerHTML = `<div class="pay-card">${icon('cash')}<div><strong>Gotovinom na kasi</strong><span>Plaćate ${esc(Money.formatRSD(total))} kada preuzmete porudžbinu.</span></div></div>`;
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

function renderReview(mode, view, snap) {
  const box = app().querySelector('[data-review]');
  if (!box) return;
  const av = snap ? snap[mode] : null;
  const b = business();
  const whenText = form.when === 'asap' ? (av && av.canOrder ? (mode === 'delivery' ? `što pre, oko ${av.asap.readyLabel}` : `što pre, spremno za ${av.asap.etaMin}–${av.asap.etaMax} min`) : 'što pre') : `u ${form.when}`;
  let where;
  if (mode === 'delivery') {
    const street = [val('address.street'), val('address.number')].filter(Boolean).join(' ');
    const apt = val('address.apt');
    where = street ? `Dostava na <strong>${esc(street)}${apt ? ', ' + esc(apt) : ''}</strong>` : 'Dostava na <strong>vašu adresu</strong>';
  } else {
    where = `Preuzimanje u lokalu <strong>${esc(b.address_street || '')}</strong>`;
  }
  let pay = `plaćate <strong>${esc(Money.formatRSD(view.total))}</strong> gotovinom${mode === 'pickup' ? ' na kasi' : ''}`;
  if (mode === 'delivery') {
    const amount = cashAmount(view.total);
    if (Number.isFinite(amount) && amount >= view.total) pay += amount === view.total ? ', tačan iznos' : ` · pripremite <strong>${esc(Money.formatRSD(amount))}</strong>, kusur <strong>${esc(Money.formatRSD(amount - view.total))}</strong>`;
  }
  box.innerHTML = `<p class="co-review__label">Proverite</p><p>${where} · <strong>${esc(whenText)}</strong> · ${pay}.</p>`;
}

function renderAside(view, mode) {
  const box = aside();
  if (!box) return;
  const assets = env().assets;
  if (!view.lines.length) {
    box.innerHTML = '';
    return;
  }
  box.innerHTML = `<div class="co-summary">
    <details class="co-summary__details" ${window.matchMedia('(min-width: 1024px)').matches ? 'open' : ''}>
      <summary><span>${view.itemCount} ${view.itemCount === 1 ? 'artikal' : 'artikla'}</span><strong class="num">${esc(Money.formatRSD(view.total))}</strong>${icon('chevron')}</summary>
      <ul class="co-items" role="list">${view.lines
        .map(
          (l) => `<li><span class="co-items__art art-frame" style="--art-bg:${l.product ? artBg(l.product) : '#F2EBDD'}">${l.product ? artSvg(assets, l.product) : ''}</span><span class="co-items__text"><strong>${l.qty}× ${esc(l.product ? l.product.name : '?')}</strong><small>${esc(l.summary)}${l.removedSummary ? ' · ' + esc(l.removedSummary) : ''}</small></span><span class="num">${esc(Money.formatNumber(l.lineTotal))}</span></li>`
        )
        .join('')}</ul>
      <button type="button" class="text-btn" data-edit-cart>${icon('edit')} Izmeni korpu</button>
    </details>
    <div class="totals">
      <div class="totals__row"><span>Međuzbir</span><span>${esc(Money.formatRSD(view.subtotal))}</span></div>
      ${mode === 'delivery' ? `<div class="totals__row"><span>Dostava</span><span>${view.deliveryExternal ? esc(deliveryFeeLabel()) : esc(Money.formatRSD(view.deliveryFee))}</span></div>` : `<div class="totals__row"><span>Preuzimanje</span><span>${esc(Money.formatRSD(0))}</span></div>`}
      <div class="totals__row totals__row--total"><span>Ukupno</span><span>${esc(Money.formatRSD(view.total))}</span></div>
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
  // Only rebuild a block when its inputs actually changed: a 30 s clock tick must never steal focus.
  const av = snap ? snap[mode] : null;
  const whenKey = [mode, av && av.canOrder, av && av.asap.readyLabel, av && av.slots.map((s) => s.value).join(',')].join('|');
  if (whenKey !== form.whenKey) {
    form.whenKey = whenKey;
    renderWhen(mode, snap);
  }
  const payKey = mode + '|' + view.total;
  if (payKey !== form.payKey) {
    form.payKey = payKey;
    renderPay(mode, view.total);
  }
  renderReview(mode, view, snap);
  const asideKey = mode + '|' + view.total + '|' + view.lines.map((l) => l.key + ':' + l.qty).join(',');
  if (asideKey !== form.asideKey) {
    form.asideKey = asideKey;
    renderAside(view, mode);
  }
  const closed = app().querySelector('[data-closed]');
  const can = !av || av.canOrder;
  const blocking = view.errors.find((e) => e.code === 'ITEM_UNAVAILABLE' || e.shortfall);
  closed.hidden = can && !blocking;
  if (!can) {
    const other = snap[mode === 'delivery' ? 'pickup' : 'delivery'];
    closed.innerHTML = `${icon('clock')}<span><strong>${snap.paused ? 'Poručivanje je pauzirano.' : mode === 'delivery' ? 'Dostava trenutno ne radi.' : 'Trenutno ne radimo.'}</strong> ${
      snap.paused ? esc(business().pause_message || '') : av.next ? `Poručivanje ${esc(av.next.label)}.` : ''
    } ${other.canOrder ? `${mode === 'delivery' ? 'Preuzimanje u lokalu je moguće.' : 'Dostava je moguća.'}` : ''}</span>`;
  } else if (blocking) {
    closed.innerHTML = `${icon('alert')}<span>${esc(blocking.message)} <button type="button" class="link" data-edit-cart>Izmeni korpu</button></span>`;
  }
  const submit = app().querySelector('[data-submit]');
  submit.disabled = !can || !!blocking || form.submitting;
  app().querySelector('[data-submit-total]').textContent = Money.formatRSD(view.total);
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
    when: form.when,
    businessDate: schedule() ? schedule()[mode].businessDate : '',
    customer: { name: val('name'), phone: val('phone'), email: val('email') },
    address: mode === 'delivery' ? { street: val('address.street'), number: val('address.number'), apt: val('address.apt'), zone: val('address.zone') || cart.zone(), note: val('address.note') } : {},
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
  if (payload.mode === 'delivery') {
    if (form.cashChoice === null) errors.cash = 'Izaberite sa koliko novca plaćate.';
    else {
      const c = Validation.validateCash(payload.cash, view.total, settingNumber('cash_max_over_total', 20000));
      if (!c.ok) errors.cash = c.message.replace(/(\d+) RSD/, (m, n) => Money.formatRSD(Number(n)));
    }
    const zonesOn = String(business().zones_enabled).toUpperCase() === 'TRUE';
    if (zonesOn && !payload.address.zone) errors['address.zone'] = 'Izaberite naselje za dostavu.';
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

function fingerprint(payload) {
  const { clientTotal, ...rest } = payload;
  return JSON.stringify(rest) + '|' + clientTotal;
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
    if (errors.mode) toast({ text: errors.mode, tone: 'error', icon: 'alert' });
    focusFirstError();
    return;
  }
  // Same content → same requestId, so a retry after a timeout can never create a second order.
  const fp = fingerprint(payload);
  let pending = session.get(PENDING_KEY);
  if (!pending || pending.fp !== fp) {
    pending = { fp, requestId: uuid() };
    session.set(PENDING_KEY, pending);
  }
  payload.requestId = pending.requestId;
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
  await onError(res.error);
}

function setBusy(busy, label) {
  form.submitting = busy;
  const btn = app().querySelector('[data-submit]');
  if (!btn) return;
  btn.classList.toggle('is-busy', busy);
  btn.setAttribute('aria-busy', String(busy));
  const l = btn.querySelector('.btn__label');
  if (l) l.textContent = busy ? label || 'Šaljemo porudžbinu…' : 'Naruči';
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
    case 'PRICE_CHANGED':
    case 'ITEM_UNAVAILABLE':
      await refreshLive();
      update();
      show(`<strong>${esc(error.message)}</strong>`);
      break;
    case 'SLOT_UNAVAILABLE':
      form.when = 'asap';
      update();
      app().querySelector('[data-when-error]').textContent = error.message;
      break;
    case 'CLOSED':
      await refreshLive();
      update();
      show(`<strong>${esc(error.message)}</strong>`);
      break;
    default:
      show(
        `<strong>${esc(error.message || 'Porudžbina trenutno nije mogla da bude poslata.')}</strong><div class="cluster" style="margin-top:0.7rem"><button type="button" class="btn btn--sm btn--blue" data-retry><span class="btn__label">Pokušaj ponovo</span></button><a class="btn btn--sm btn--ghost" href="tel:${esc(tel)}" data-track="checkout-error"><span class="btn__label">Pozovi ${esc(phone)}</span></a></div><p class="small" style="margin-top:0.5rem">Ponovni pokušaj je bezbedan: ista porudžbina neće stići dva puta.</p>`
      );
  }
  track('order_error', { code: error.code });
}

function onPlaced(response, payload, view) {
  form.submitted = true;
  session.remove(PENDING_KEY);
  const remember = app().querySelector('[name="remember"]');
  if (remember && remember.checked) {
    local.set(CUSTOMER_KEY, {
      name: payload.customer.name,
      phone: payload.customer.phone,
      email: payload.customer.email,
      street: payload.address.street || (local.get(CUSTOMER_KEY) || {}).street || '',
      number: payload.address.number || (local.get(CUSTOMER_KEY) || {}).number || '',
      apt: payload.address.apt || (local.get(CUSTOMER_KEY) || {}).apt || '',
      addrNote: payload.address.note || '',
      zone: payload.address.zone || ''
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
// Confirmation + status
// ---------------------------------------------------------------------------

const STATUS_TEXT = {
  NEW: 'Primljena — čeka potvrdu lokala',
  ACCEPTED: 'Potvrđena — uskoro ide u pripremu',
  PREPARING: 'U pripremi',
  READY: { delivery: 'Spremna — čeka dostavljača', pickup: 'Spremna — možete da dođete' },
  OUT_FOR_DELIVERY: 'Na putu do vas',
  COMPLETED: 'Završena. Prijatno!',
  CANCELLED: 'Otkazana. Ako je greška, pozovite nas.',
  FAILED: 'Nije isporučena. Pozovite nas.'
};

function statusSteps(mode) {
  return mode === 'delivery'
    ? [
        ['NEW', 'Primljena'],
        ['ACCEPTED', 'Potvrđena'],
        ['PREPARING', 'U pripremi'],
        ['OUT_FOR_DELIVERY', 'Na putu']
      ]
    : [
        ['NEW', 'Primljena'],
        ['ACCEPTED', 'Potvrđena'],
        ['PREPARING', 'U pripremi'],
        ['READY', 'Spremna']
      ];
}

const ORDER = ['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED'];

function trackerHtml(status, mode) {
  const steps = statusSteps(mode);
  const idx = ORDER.indexOf(status);
  const cancelled = status === 'CANCELLED' || status === 'FAILED';
  const text = STATUS_TEXT[status];
  const message = typeof text === 'object' ? text[mode] : text || '';
  return `<div class="tracker${cancelled ? ' is-cancelled' : ''}" style="--steps:${steps.length}">
    <div class="tracker__title"><h2>Status porudžbine</h2><span class="small muted" data-status-time></span></div>
    <div class="tracker__steps">${steps
      .map(([code, label]) => {
        const i = ORDER.indexOf(code);
        const done = !cancelled && (idx > i || status === 'COMPLETED' || (idx === i && i === 0));
        const currentStep = !cancelled && idx === i && status !== 'COMPLETED' && i !== 0;
        return `<span class="tracker__step${done ? ' is-done' : ''}${currentStep ? ' is-current' : ''}">${label}</span>`;
      })
      .join('')}</div>
    <p class="tracker__message" data-status-message>${esc(message)}</p>
  </div>`;
}

let pollTimer = null;
function pollStatus(orderId, token, mode) {
  clearTimeout(pollTimer);
  if (!orderId || !token) return;
  const started = Date.now();
  const tick = async () => {
    if (document.hidden) {
      pollTimer = setTimeout(tick, 15000);
      return;
    }
    const res = await apiGet('order.status', { id: orderId, t: token });
    const box = $('[data-tracker]');
    if (res.ok && box) {
      box.innerHTML = trackerHtml(res.data.status, res.data.mode || mode);
      const t = box.querySelector('[data-status-time]');
      if (t) t.textContent = `osveženo ${new Date().toLocaleTimeString('sr-Latn-RS', { hour: '2-digit', minute: '2-digit' })}`;
      if (['COMPLETED', 'CANCELLED', 'FAILED'].includes(res.data.status)) return;
    }
    if (Date.now() - started < 3 * 3600 * 1000) pollTimer = setTimeout(tick, 20000);
  };
  tick();
}

function renderConfirmation(r, { restored }) {
  const b = business();
  aside().innerHTML = '';
  const isDelivery = r.mode === 'delivery';
  const whenText = r.when === 'asap' ? (isDelivery ? `Što pre — oko ${r.promisedTime}` : `Što pre — spremno za ${r.etaMin}–${r.etaMax} min (oko ${r.promisedTime})`) : `Zakazano za ${r.whenLabel}`;
  const cashText = isDelivery
    ? r.change
      ? `Pripremite <strong>${esc(Money.formatRSD(r.cash))}</strong> — dostavljač vraća kusur <strong>${esc(Money.formatRSD(r.change))}</strong>.`
      : 'Plaćate tačan iznos, kusur nije potreban.'
    : 'Plaćate gotovinom na kasi.';
  app().innerHTML = `<div class="confirm">
    ${restored ? '<p class="small muted">Vaša poslednja porudžbina</p>' : ''}
    <article class="ticket confirm__ticket" aria-labelledby="confirm-title">
      <div class="confirm__top">
        <p class="confirm__ok" id="confirm-title">${icon('check-circle')} Porudžbina primljena</p>
        <p class="ticket__number" aria-label="Broj porudžbine ${r.publicNumber}"><span>#</span>${r.publicNumber}</p>
        <p class="confirm__save">Sačuvajte broj porudžbine. Ako nas zovete, recite samo broj.</p>
      </div>
      <hr class="ticket__tear">
      <dl class="confirm__details">
        <div><dt>Lokal</dt><dd>${esc(r.location.name)}<small>${esc(r.location.address)}</small></dd></div>
        <div><dt>Način</dt><dd>${isDelivery ? 'Dostava' : 'Preuzimanje u lokalu'}${isDelivery && r.address ? `<small>${esc(r.address.line)}${r.address.apt ? ', ' + esc(r.address.apt) : ''}</small>` : ''}</dd></div>
        <div><dt>Vreme</dt><dd>${esc(whenText)}</dd></div>
        <div><dt>Ukupno</dt><dd class="num">${esc(Money.formatRSD(r.total))}${r.deliveryFee ? `<small>hrana ${esc(Money.formatRSD(r.subtotal))} + dostava ${esc(Money.formatRSD(r.deliveryFee))}</small>` : ''}</dd></div>
        <div><dt>Plaćanje</dt><dd>Gotovina</dd></div>
        <div class="confirm__cash"><dt>Kusur</dt><dd>${cashText}</dd></div>
      </dl>
    </article>
    <div data-tracker>${trackerHtml(r.status || 'NEW', r.mode)}</div>
    <div class="confirm__actions">
      <button type="button" class="btn btn--sm btn--ghost" data-copy="${r.publicNumber}">${icon('copy', 'btn__icon')}<span class="btn__label">Kopiraj broj</span></button>
      <button type="button" class="btn btn--sm btn--ghost" data-share>${icon('share', 'btn__icon')}<span class="btn__label">Sačuvaj</span></button>
      <button type="button" class="btn btn--sm btn--ghost" data-print>${icon('print', 'btn__icon')}<span class="btn__label">Štampaj</span></button>
    </div>
    <details class="confirm__items"><summary>Šta ste poručili (${r.items.reduce((n, i) => n + i.qty, 0)})</summary><ul role="list">${r.items
      .map((i) => `<li><strong>${i.qty}× ${esc(i.name)}</strong> <span class="num">${esc(Money.formatNumber(i.lineTotal))}</span>${i.summary ? `<small>${esc(i.summary)}</small>` : ''}${i.removedSummary ? `<small class="bez">${esc(i.removedSummary)}</small>` : ''}</li>`)
      .join('')}</ul></details>
    <p class="notice">${icon('phone')}<span>Izmena ili otkazivanje: pozovite <a href="tel:${esc(r.location.phoneE164)}" data-track="confirmation"><strong>${esc(r.location.phone)}</strong></a> i recite broj <strong>#${r.publicNumber}</strong>.</span></p>
    <div class="cluster"><a class="btn btn--gold" href="/meni/"><span class="btn__label">Nazad na meni</span></a><a class="link" href="/">Početna</a></div>
  </div>`;
  pollStatus(r.orderId, r.statusToken, r.mode);
  document.title = `Porudžbina #${r.publicNumber} primljena | ${b.business_name || 'Grčki Giros'}`;
}

async function renderStatusFromLink(id, t) {
  aside().innerHTML = '';
  app().innerHTML = `<div class="confirm"><article class="ticket confirm__ticket"><div class="confirm__top"><p class="confirm__ok">${icon('check-circle')} Porudžbina</p><p class="ticket__number" data-status-number>…</p><p class="confirm__save">Status se osvežava sam.</p></div></article><div data-tracker></div>
  <p class="notice">${icon('phone')}<span>Pitanja: <a href="tel:${esc(business().phone_e164 || '')}"><strong>${esc(business().phone_display || '')}</strong></a></span></p></div>`;
  const res = await apiGet('order.status', { id, t });
  if (!res.ok) {
    app().innerHTML = `<div class="notice notice--error">${icon('alert')}<span>Porudžbina nije pronađena. Proverite link iz emaila ili nas pozovite na ${esc(business().phone_display || '')}.</span></div>`;
    return;
  }
  $('[data-status-number]').innerHTML = `<span>#</span>${res.data.publicNumber}`;
  $('[data-tracker]').innerHTML = trackerHtml(res.data.status, res.data.mode);
  pollStatus(id, t, res.data.mode);
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
  on(root, 'change', '[name="mode"]', (e, el) => {
    cart.setMode(el.value);
    form.when = 'asap';
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
  on(root, 'change', '[name="address.zone"]', (e, el) => cart.setZone(el.value));
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
    const text = `Grčki Giros — porudžbina #${r.publicNumber}, ${Money.formatRSD(r.total)}, ${r.mode === 'delivery' ? 'dostava' : 'preuzimanje'} ${r.whenLabel === 'ŠTO PRE' ? 'što pre (oko ' + r.promisedTime + ')' : r.whenLabel}.`;
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
  }
  subscribe('cart', () => {
    if (form.submitted) return;
    if (cart.itemCount() === 0) renderEmpty();
    else if (!app().querySelector('[data-checkout-form]')) renderForm();
    else update();
  });
  subscribe('availability', () => update());
  subscribe('catalog', () => update());
}

init();
