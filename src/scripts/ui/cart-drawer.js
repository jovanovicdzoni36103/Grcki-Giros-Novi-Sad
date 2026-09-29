// Cart drawer: lines, quantities, edit/remove with undo, mode switch, totals, bundle hint and upsell.
import Money from '../shared/money.cjs';
import Pricing from '../shared/pricing.cjs';
import { esc, icon, env } from '../core/dom.js';
import { subscribe } from '../core/events.js';
import * as cart from '../core/cart.js';
import { schedule } from '../core/availability.js';
import { catalog, productById, business } from '../core/catalog.js';
import { artSvg, artBg } from './render.js';
import * as overlay from './overlay.js';
import { toast } from './toast.js';
import { openProduct, quickAdd } from './product-sheet.js';
import { modeSwitch, refreshModeMeta, defaultMode, deliveryFeeLabel, closedReason, zoneSelect, zones } from './mode.js';
import { track } from '../core/analytics.js';

let root;

function ensureRoot() {
  if (root) return root;
  root = document.createElement('div');
  root.className = 'overlay drawer';
  root.hidden = true;
  root.id = 'korpa';
  root.setAttribute('data-cart-drawer', '');
  root.innerHTML = `<div class="overlay__scrim" data-drawer-close></div>
  <aside class="overlay__panel" role="dialog" aria-modal="true" aria-labelledby="cart-title" tabindex="-1">
    <div class="grabber" aria-hidden="true"></div>
    <header class="overlay__head"><h2 class="h3" id="cart-title">Korpa</h2><button type="button" class="icon-btn" data-drawer-close aria-label="Zatvori korpu">${icon('close')}</button></header>
    <div class="overlay__body" data-drawer-body></div>
    <footer class="overlay__foot" data-drawer-foot></footer>
  </aside>`;
  document.body.appendChild(root);
  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  return root;
}

function lineHtml(l) {
  const assets = env().assets;
  const p = l.product;
  if (!p) {
    return `<li class="cart-line" data-line="${esc(l.key)}"><div class="cart-line__art"></div><div><p class="cart-line__name">Proizvod više nije u ponudi</p><div class="cart-line__actions"><button type="button" class="text-btn" data-remove="${esc(l.key)}">Ukloni</button></div></div></li>`;
  }
  const problem = l.errors && l.errors.length ? `<span class="cart-line__bez">${esc(l.errors[0].message)}</span>` : '';
  const editable = Pricing.hasOptions(p);
  return `<li class="cart-line" data-line="${esc(l.key)}">
    <div class="cart-line__art art-frame" style="--art-bg:${artBg(p)}">${artSvg(assets, p)}</div>
    <div class="cart-line__main">
      <div class="cart-line__top"><h3 class="cart-line__name">${esc(p.name)}</h3><span class="cart-line__price">${Money.formatRSD(l.lineTotal)}</span></div>
      <p class="cart-line__desc">${esc(l.summary)}${l.removedSummary ? `<span class="cart-line__bez">${esc(l.removedSummary)}</span>` : ''}${l.note ? `<span class="cart-line__note">„${esc(l.note)}“</span>` : ''}${problem}</p>
      <div class="cart-line__actions">
        <div class="qty" role="group" aria-label="Količina za ${esc(p.name)}">
          <button type="button" data-line-qty="-1" data-key="${esc(l.key)}" aria-label="${l.qty === 1 ? 'Ukloni' : 'Manje'}">${icon(l.qty === 1 ? 'trash' : 'minus')}</button>
          <output>${l.qty}</output>
          ${
            l.qty >= cart.maxQty()
              ? `<button type="button" disabled aria-label="Najviše ${cart.maxQty()} po stavci" title="Najviše ${cart.maxQty()} po stavci — za veću porudžbinu pozovite nas">${icon('plus')}</button>`
              : `<button type="button" data-line-qty="1" data-key="${esc(l.key)}" aria-label="Više">${icon('plus')}</button>`
          }
        </div>
        ${editable ? `<button type="button" class="text-btn" data-edit="${esc(l.key)}">Izmeni</button>` : ''}
        <button type="button" class="text-btn" data-remove="${esc(l.key)}">Ukloni</button>
      </div>
    </div>
  </li>`;
}

function render() {
  if (!root || root.hidden) return;
  const view = cart.view();
  const snap = schedule();
  const mode = defaultMode(snap, cart.mode());
  const body = root.querySelector('[data-drawer-body]');
  const foot = root.querySelector('[data-drawer-foot]');
  const assets = env().assets;
  const title = root.querySelector('#cart-title');
  title.textContent = view.itemCount ? `Korpa · ${view.itemCount}` : 'Korpa';

  if (view.empty) {
    body.innerHTML = `<div class="cart-empty"><svg class="art" viewBox="0 0 200 220" aria-hidden="true"><use href="${assets.art}#bag"/></svg><h3>Korpa je prazna</h3><p class="muted">Giros neće sam da se poruči.</p><a class="btn btn--gold" href="/meni/" data-drawer-close><span class="btn__label">Pogledaj meni</span>${icon('arrow', 'btn__icon')}</a></div>`;
    foot.innerHTML = '';
    foot.hidden = true;
    return;
  }
  foot.hidden = false;
  const closedNotice =
    snap && !snap[mode].canOrder
      ? `<div class="notice notice--closed" style="margin:0 var(--gutter) 1rem">${icon('clock')}<span><strong>Trenutno ne primamo porudžbine.</strong> ${
          snap.paused ? esc(business().pause_message || '') : esc(closedReason(snap[mode], mode)).replace(/^./, (c) => c.toUpperCase()) + '.'
        }</span></div>`
      : '';
  const zoneRow =
    mode === 'delivery' && view.zonesOn && zones().length
      ? `<div class="drawer-zone" data-drawer-zone><label class="field__label" for="drawer-zone">Dostava u</label>${zoneSelect('drawer-zone', 'drawer-zone', view.zone)}${
          view.zone === 'none'
            ? `<p class="zone-result is-no">${icon('alert')} Na tu adresu trenutno ne dostavljamo. Izaberite preuzimanje ili pozovite ${esc(business().phone_display || '')}.</p>`
            : view.zoneObj
              ? `<p class="zone-result is-ok">${icon('check')} Dostava ${esc(deliveryFeeLabel(view.zoneObj))}${view.zoneObj.minOrder ? ` · minimalna porudžbina ${esc(Money.formatRSD(view.zoneObj.minOrder))}` : ''}</p>`
              : ''
        }</div>`
      : '';
  const recs = view.recs
    .map((r) => productById(r.productId))
    .filter(Boolean)
    .map((p) => `<button type="button" class="chip chip--price" data-rec="${esc(p.id)}">${icon('plus')} ${esc(p.name)} <small>${Money.formatNumber(p.price)}</small></button>`)
    .join('');
  body.innerHTML = `<div style="padding:1rem var(--gutter) 0.75rem" data-mode-root>${modeSwitch('cart-mode', mode, snap)}</div>${closedNotice}${zoneRow}
    <ul class="cart-lines" role="list">${view.lines.map(lineHtml).join('')}</ul>
    ${recs ? `<div class="recs"><p class="recs__title">Najčešće se naručuje uz</p><div class="chips">${recs}</div></div>` : ''}`;

  const hint = view.hints[0];
  const blocking = view.errors.find((e) => e.code === 'ITEM_UNAVAILABLE' || e.shortfall);
  const canOrder = !snap || snap[mode].canOrder;
  const zoneBlocked = mode === 'delivery' && view.zone === 'none';
  const deliveryRow =
    mode === 'delivery'
      ? `<div class="totals__row"><span>Dostava</span><span>${
          view.deliveryExternal ? esc(deliveryFeeLabel()) : view.needsZone ? 'izaberite naselje' : view.deliveryFree ? 'besplatna' : Money.formatRSD(view.deliveryFee)
        }</span></div>`
      : `<div class="totals__row"><span>Preuzimanje u lokalu</span><span>${Money.formatRSD(0)}</span></div>`;
  const totalText = view.needsZone ? `${Money.formatRSD(view.subtotal)} + dostava` : Money.formatRSD(view.total);
  foot.innerHTML = `${hint ? `<div class="hint-card">${icon('spark')}<span>Povoljnije kao akcija: <strong>${esc(hint.name)}</strong> — ušteda ${Money.formatRSD(hint.saving)}.</span><button type="button" class="text-btn" data-hint="${esc(hint.productId)}">Pogledaj</button></div>` : ''}
    ${blocking ? `<div class="notice notice--error" style="margin-bottom:0.8rem">${icon('alert')}<span>${esc(blocking.message)}</span></div>` : ''}
    <div class="totals">
      <div class="totals__row"><span>Međuzbir</span><span>${Money.formatRSD(view.subtotal)}</span></div>
      ${deliveryRow}
      <div class="totals__row totals__row--total"><span>Ukupno</span><span data-cart-total>${totalText}</span></div>
    </div>
    <a class="btn btn--gold btn--lg btn--block" style="margin-top:1rem;justify-content:space-between" href="/porudzbina/" data-checkout ${canOrder && !blocking && !zoneBlocked ? '' : 'aria-disabled="true"'}>
      <span class="btn__label">${canOrder ? 'Nastavi na porudžbinu' : 'Poručivanje trenutno nije moguće'}</span><span class="num">${view.needsZone ? '' : Money.formatRSD(view.total)}</span>
    </a>
    <p class="small muted" style="margin-top:0.6rem;text-align:center">Plaćanje gotovinom ${mode === 'delivery' ? 'dostavljaču' : 'na kasi'}.</p>`;
}

function onChange(e) {
  if (e.target.name === 'cart-mode') {
    cart.setMode(e.target.value);
  }
  if (e.target.name === 'drawer-zone') {
    cart.setZone(e.target.value, e.target.selectedOptions[0]?.dataset.area);
  }
}

function onClick(e) {
  const t = e.target;
  if (t.closest('[data-drawer-close]')) {
    overlay.close(root);
    return;
  }
  const qty = t.closest('[data-line-qty]');
  if (qty) {
    const key = qty.dataset.key;
    const raw = cart.rawLine(key);
    if (!raw) return;
    const next = raw.qty + Number(qty.dataset.lineQty);
    if (next <= 0) removeWithUndo(key);
    else cart.setQty(key, next);
    return;
  }
  const rem = t.closest('[data-remove]');
  if (rem) {
    removeWithUndo(rem.dataset.remove);
    return;
  }
  const edit = t.closest('[data-edit]');
  if (edit) {
    const raw = cart.rawLine(edit.dataset.edit);
    if (raw) openProduct(raw.productId, { editKey: edit.dataset.edit });
    return;
  }
  const rec = t.closest('[data-rec]');
  if (rec) {
    quickAdd(rec.dataset.rec, rec);
    return;
  }
  const hint = t.closest('[data-hint]');
  if (hint) {
    openProduct(hint.dataset.hint);
    return;
  }
  const checkout = t.closest('[data-checkout]');
  if (checkout && checkout.getAttribute('aria-disabled') === 'true') {
    e.preventDefault();
    return;
  }
  if (checkout) track('begin_checkout', { value: cart.view().total, currency: 'RSD' });
}

function removeWithUndo(key) {
  const li = root.querySelector(`[data-line="${CSS.escape(key)}"]`);
  const doRemove = () => {
    const removed = cart.removeLine(key);
    if (!removed) return;
    const p = productById(removed.line.productId);
    toast({ text: `Uklonjeno iz korpe: ${p ? p.name : 'stavka'}.`, icon: 'trash', action: { label: 'Vrati', onClick: () => cart.restoreLine(removed) } });
  };
  if (li && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    li.classList.add('is-removing');
    setTimeout(doRemove, 240);
  } else doRemove();
}

export function openCart() {
  ensureRoot();
  const snap = schedule();
  // Remembered only on the server's clock: cached data runs on the device clock, which may be off (or pinned in tests).
  if (!cart.mode() && catalog().live) cart.setMode(defaultMode(snap, null));
  root.hidden = false;
  render();
  overlay.open(root, { focus: '[role="dialog"]' });
}

export function initCartDrawer() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cart-open]');
    if (btn) {
      e.preventDefault();
      openCart();
    }
  });
  subscribe('cart', () => render());
  subscribe('availability', (snap) => {
    if (root && !root.hidden) refreshModeMeta(root.querySelector('[data-mode-root]'), snap);
  });
  if (location.hash === '#korpa') {
    history.replaceState(null, '', location.pathname + location.search);
    setTimeout(openCart, 50);
  }
  catalog();
}
