// Product detail sheet: the giros "assembly" (PDF: srce sajta) as numbered steps, with live price.
// Every piece can be configured on its own (2× Klasik: extra meat on one, no onion on the other);
// a new piece starts from the product defaults, never silently copies the previous one.
import Pricing from '../shared/pricing.cjs';
import Money from '../shared/money.cjs';
import { esc, icon, env, prefersReducedMotion } from '../core/dom.js';
import { catalog, productById, business } from '../core/catalog.js';
import { schedule } from '../core/availability.js';
import * as cart from '../core/cart.js';
import { artSvg, artBg, tagList, TAG_LABELS } from './render.js';
import * as overlay from './overlay.js';
import { toast } from './toast.js';
import { bumpCart } from './header.js';
import { track } from '../core/analytics.js';

const MAX_PIECES = 20; // same as the default max_qty_per_line

let root;
let current = null; // { product, pieces:[{ selected:Set, note }], active, editKey }

function ensureRoot() {
  if (root) return root;
  root = document.createElement('div');
  root.className = 'overlay sheet';
  root.hidden = true;
  root.setAttribute('data-product-sheet', '');
  root.innerHTML = `<div class="overlay__scrim" data-sheet-close></div>
  <section class="overlay__panel" role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabindex="-1"></section>`;
  document.body.appendChild(root);
  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  root.addEventListener('input', onInput);
  return root;
}

function orderingState() {
  const snap = schedule();
  if (!snap) return { can: true, label: '' };
  if (snap.open) return { can: true, label: '' };
  if (snap.paused) return { can: false, label: 'Poručivanje je pauzirano' };
  if (snap.onBreak) return { can: false, label: 'Pauza — trenutno ne primamo porudžbine' };
  return { can: false, label: snap.next ? `Poručivanje ${snap.next.label}` : 'Trenutno ne primamo porudžbine' };
}

function groupsOf(product) {
  const idx = catalog().index;
  return (product.groups || [])
    .map((gid) => idx.groups[gid])
    .filter(Boolean)
    .sort((a, b) => a.sort - b.sort);
}

function optionsOf(groupId) {
  return (catalog().index.optionsByGroup[groupId] || []).slice().sort((a, b) => a.sort - b.sort);
}

const piece = () => current.pieces[current.active];

function newPiece(from) {
  if (from) return { selected: new Set(from.selected), note: from.note };
  return { selected: new Set(Pricing.defaultOptions(catalog().index, current.product)), note: '' };
}

function groupHtml(group, step) {
  const opts = optionsOf(group.id);
  const sel = piece().selected;
  const n = current.active;
  const required = group.required;
  const badge = group.display === 'info' ? 'Uključeno' : required ? 'Obavezno' : group.type === 'multi' ? (group.max ? `Do ${group.max}` : 'Po želji') : 'Po želji';
  const head = `<legend class="opt-group__head"><span class="opt-group__title"><span class="opt-group__step">${step}</span>${esc(group.name)}</span><span class="opt-group__badge${required && group.display !== 'info' ? ' is-required' : ''}">${badge}</span></legend>${group.hint ? `<p class="opt-group__hint">${esc(group.hint)}</p>` : ''}`;
  let body = '';
  if (group.display === 'info') {
    const chosen = opts.filter((o) => sel.has(o.id)).map((o) => o.name).join(', ') || opts.map((o) => o.name).join(', ');
    body = `<div class="opt-info">${icon('check-circle')}<span>${esc(chosen)}</span></div>`;
  } else if (group.display === 'toggle') {
    body = opts
      .map(
        (o) => `<label class="switch"><span><strong>${esc(o.name)}</strong>${o.price ? ` <small>+${Money.formatRSD(o.price)}</small>` : ''}</span>
          <input type="checkbox" name="g-${esc(group.id)}" value="${esc(o.id)}" ${sel.has(o.id) ? 'checked' : ''} ${o.available === false ? 'disabled' : ''}></label>`
      )
      .join('');
  } else if (group.display === 'cards') {
    body = `<div class="opt-cards">${opts
      .map(
        (o) => `<div class="opt-card"><input type="${group.type === 'single' ? 'radio' : 'checkbox'}" id="o-${n}-${esc(o.id)}" name="g-${esc(group.id)}" value="${esc(o.id)}" ${sel.has(o.id) ? 'checked' : ''} ${o.available === false ? 'disabled' : ''}>
          <label for="o-${n}-${esc(o.id)}">${esc(o.name)}${o.price ? `<small>+${Money.formatRSD(o.price)}</small>` : o.available === false ? '<small>nema</small>' : ''}</label></div>`
      )
      .join('')}</div>`;
  } else {
    body = `<div class="chips">${opts
      .map(
        (o) => `<label><input class="chip-input" type="${group.type === 'single' ? 'radio' : 'checkbox'}" name="g-${esc(group.id)}" value="${esc(o.id)}" ${sel.has(o.id) ? 'checked' : ''} ${o.available === false ? 'disabled' : ''}>
          <span class="chip chip--price">${esc(o.name)}${o.price ? ` <small>+${Money.formatNumber(o.price)}</small>` : ''}${o.available === false ? ' <small>nema</small>' : ''}</span></label>`
      )
      .join('')}</div>`;
  }
  return `<fieldset class="opt-group" data-group="${esc(group.id)}">${head}${body}</fieldset>`;
}

function pricePiece(p) {
  return Pricing.priceLine(catalog().index, { productId: current.product.id, qty: 1, options: [...p.selected], note: p.note }, { mode: cart.mode() || undefined });
}

function totalPrice() {
  return current.pieces.reduce((sum, p) => sum + (pricePiece(p).lineTotal || current.product.price), 0);
}

/** First required choice still missing, on any piece: { index, error }. */
function missingRequired() {
  for (let i = 0; i < current.pieces.length; i++) {
    const err = pricePiece(current.pieces[i]).errors.find((e) => e.groupId);
    if (err) return { index: i, error: err };
  }
  return null;
}

/** Short line under a piece tab: what differs from the defaults. */
function pieceSummary(p) {
  const res = pricePiece(p);
  const defaults = new Set(Pricing.defaultOptions(catalog().index, current.product));
  const parts = [];
  res.selections.forEach((s) => {
    if (s.display === 'info') return;
    s.chosen.forEach((o) => {
      // Free picks count too: on giros the meat and the spreads are what tells two pieces apart.
      if (o.price) parts.push(`+${o.name}`);
      else if (!defaults.has(o.id)) parts.push(o.name);
    });
  });
  if (res.removedSummary) parts.push(res.removedSummary.replace(/^BEZ: /, 'bez '));
  return parts.join(', ') || 'kao na meniju';
}

function piecesHtml() {
  if (current.pieces.length < 2 || !groupsOf(current.product).length) return '';
  return `<div class="pieces">
    <p class="pieces__hint">${icon('spark')}Svaki komad možete da složite drugačije.</p>
    <div class="pieces__tabs" role="tablist" aria-label="Komadi">${current.pieces
      .map((p, i) => {
        const bad = pricePiece(p).errors.some((e) => e.groupId);
        return `<button type="button" role="tab" class="pieces__tab${bad ? ' is-incomplete' : ''}" data-piece="${i}" aria-selected="${i === current.active}"><strong>Komad ${i + 1}</strong><small>${esc(pieceSummary(p))}</small></button>`;
      })
      .join('')}</div>
    <button type="button" class="text-btn pieces__copy" data-copy-piece>${icon('copy')} Isto za sve komade</button>
  </div>`;
}

function formHtml() {
  const groups = groupsOf(current.product);
  const p = piece();
  const noteLabel = current.pieces.length > 1 ? `Napomena za komad ${current.active + 1}` : 'Napomena';
  return `${piecesHtml()}
    ${groups.map((g, i) => groupHtml(g, i + 1)).join('')}
    <fieldset class="opt-group">
      <legend class="opt-group__head"><span class="opt-group__title"><span class="opt-group__step">${groups.length + 1}</span>${noteLabel}</span><span class="opt-group__badge">Po želji</span></legend>
      <textarea class="input" name="note" rows="2" maxlength="140" placeholder="npr. dobro zapečeno, sos sa strane" aria-label="${esc(noteLabel)}">${esc(p.note)}</textarea>
      <p class="field__hint">Trudimo se da ispunimo svaku želju, ali posebne želje nisu zagarantovane.</p>
    </fieldset>`;
}

function renderForm() {
  const form = root.querySelector('[data-sheet-form]');
  if (form) form.innerHTML = formHtml();
  updatePrice();
}

function render(fromEl) {
  const { product } = current;
  const assets = env().assets;
  const state = orderingState();
  const panel = root.querySelector('.overlay__panel');
  const includes = product.includes ? `<p class="sheet__includes">${esc(product.includes)}</p>` : '';
  const compare = product.comparePrice > product.price ? `<s>${Money.formatRSD(product.comparePrice)}</s>` : '';
  const pairs = Pricing.recommendations(catalog().index, [product.id], catalog().data.recs || {}, 3);
  panel.innerHTML = `<button type="button" class="icon-btn sheet__close" data-sheet-close aria-label="Zatvori">${icon('close')}</button>
  <div class="sheet__layout">
    <div class="sheet__media" style="--art-bg:${artBg(product)}">${artSvg(assets, product, 'art sheet__art')}</div>
    <div class="sheet__main">
      <div class="sheet__scroll">
        <div class="sheet__content">
          <div class="product__tags">${tagList(assets, product.tags, 4)}</div>
          <h2 class="sheet__title" id="sheet-title">${esc(product.name)}</h2>
          ${product.description ? `<p class="sheet__desc">${esc(product.description)}</p>` : ''}
          ${includes}
          <p class="sheet__price num">${Money.formatRSD(product.price)} ${compare}</p>
          ${product.available === false ? `<p class="notice notice--error">${icon('alert')}<span>Trenutno nema: ${esc(product.name)}. Ne može da se doda u porudžbinu.</span></p>` : ''}
          <form class="sheet__form" data-sheet-form novalidate>${formHtml()}</form>
          ${
            pairs.length
              ? `<div class="pairs"><p class="pairs__title">Ide uz ovo</p><div class="chips">${pairs
                  .map((r) => {
                    const p = productById(r.productId);
                    return `<button type="button" class="chip chip--price" data-quick-add="${esc(p.id)}">${icon('plus')} ${esc(p.name)} <small>${Money.formatNumber(p.price)}</small></button>`;
                  })
                  .join('')}</div></div>`
              : ''
          }
        </div>
      </div>
      <footer class="sheet__foot">
        <div class="qty qty--lg" role="group" aria-label="Količina">
          <button type="button" data-qty="-1" aria-label="Manje">${icon('minus')}</button>
          <output aria-live="polite" data-qty-value>${current.pieces.length}</output>
          <button type="button" data-qty="1" aria-label="Više">${icon('plus')}</button>
        </div>
        <button type="button" class="btn btn--gold btn--lg" data-sheet-add ${state.can && product.available !== false ? '' : 'disabled'}>
          <span class="btn__label" data-add-label>${state.can ? (current.editKey ? 'Sačuvaj' : 'Dodaj') : esc(state.label)}</span>
          <span class="num" data-add-price></span>
        </button>
      </footer>
    </div>
  </div>`;
  updatePrice();
  if (fromEl && !prefersReducedMotion()) flipFrom(fromEl);
}

function updatePrice() {
  const price = root.querySelector('[data-add-price]');
  if (price) price.textContent = Money.formatRSD(totalPrice());
  const q = root.querySelector('[data-qty-value]');
  if (q) q.textContent = String(current.pieces.length);
  const minus = root.querySelector('[data-qty="-1"]');
  if (minus) minus.disabled = current.pieces.length <= 1;
  const plus = root.querySelector('[data-qty="1"]');
  if (plus) plus.disabled = current.pieces.length >= MAX_PIECES;
  root.querySelectorAll('[data-group]').forEach((fs) => {
    const gid = fs.dataset.group;
    const group = catalog().index.groups[gid];
    const has = optionsOf(gid).some((o) => piece().selected.has(o.id));
    fs.classList.toggle('is-done', group && group.required ? has : true);
  });
  root.querySelectorAll('[data-piece]').forEach((tab) => {
    const p = current.pieces[Number(tab.dataset.piece)];
    if (!p) return;
    tab.querySelector('small').textContent = pieceSummary(p);
    tab.classList.toggle('is-incomplete', pricePiece(p).errors.some((e) => e.groupId));
  });
  const add = root.querySelector('[data-sheet-add]');
  const label = root.querySelector('[data-add-label]');
  const state = orderingState();
  if (add && label && state.can && current.product.available !== false) {
    const miss = missingRequired();
    if (miss) label.textContent = (current.pieces.length > 1 ? `Komad ${miss.index + 1}: ` : '') + miss.error.message.replace(/\.$/, '');
    else label.innerHTML = current.editKey ? 'Sačuvaj<span class="hide-sm"> izmene</span>' : 'Dodaj<span class="hide-sm"> u korpu</span>';
  }
}

function flipFrom(fromEl) {
  const media = root.querySelector('.sheet__media');
  const art = fromEl.querySelector('.art');
  if (!media || !art) return;
  const a = art.getBoundingClientRect();
  const b = media.getBoundingClientRect();
  if (!a.width || !b.width) return;
  const scale = a.width / b.width;
  media.animate(
    [
      { transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${scale})`, transformOrigin: '0 0', borderRadius: '999px 999px 24px 24px' },
      { transform: 'none', transformOrigin: '0 0', borderRadius: '0' }
    ],
    { duration: 520, easing: 'cubic-bezier(0.76, 0, 0.24, 1)' }
  );
}

function onChange(e) {
  const input = e.target;
  if (!current || !input.name || !input.name.startsWith('g-')) return;
  const gid = input.name.slice(2);
  const group = catalog().index.groups[gid];
  const sel = piece().selected;
  if (group.type === 'single') {
    optionsOf(gid).forEach((o) => sel.delete(o.id));
    if (input.checked) sel.add(input.value);
  } else if (input.checked) {
    sel.add(input.value);
  } else {
    sel.delete(input.value);
  }
  updatePrice();
}

function onInput(e) {
  if (current && e.target.name === 'note') piece().note = e.target.value.slice(0, 140);
}

function selectPiece(index, { focus = false } = {}) {
  current.active = Math.max(0, Math.min(current.pieces.length - 1, index));
  renderForm();
  if (focus) {
    const tab = root.querySelector(`[data-piece="${current.active}"]`);
    if (tab) tab.focus();
  }
}

function onClick(e) {
  if (e.target.closest('[data-sheet-close]')) {
    overlay.close(root);
    return;
  }
  const qtyBtn = e.target.closest('[data-qty]');
  if (qtyBtn) {
    const hadTabs = current.pieces.length > 1;
    if (Number(qtyBtn.dataset.qty) > 0 && current.pieces.length < MAX_PIECES) {
      current.pieces.push(newPiece());
      if (groupsOf(current.product).length) current.active = current.pieces.length - 1;
    } else if (Number(qtyBtn.dataset.qty) < 0 && current.pieces.length > 1) {
      current.pieces.pop();
      current.active = Math.min(current.active, current.pieces.length - 1);
    }
    if (groupsOf(current.product).length && (hadTabs || current.pieces.length > 1)) renderForm();
    else updatePrice();
    return;
  }
  const tab = e.target.closest('[data-piece]');
  if (tab) {
    selectPiece(Number(tab.dataset.piece));
    return;
  }
  if (e.target.closest('[data-copy-piece]')) {
    const src = piece();
    current.pieces = current.pieces.map((p, i) => (i === current.active ? p : newPiece(src)));
    renderForm();
    toast({ text: `Svi komadi su složeni kao komad ${current.active + 1}.`, icon: 'copy', timeout: 2400 });
    return;
  }
  const quick = e.target.closest('[data-quick-add]');
  if (quick) {
    quickAdd(quick.dataset.quickAdd, quick);
    quick.disabled = true;
    quick.innerHTML = `${icon('check')} Dodato`;
    return;
  }
  if (e.target.closest('[data-sheet-add]')) commit();
}

function commit() {
  const miss = missingRequired();
  if (miss) {
    if (miss.index !== current.active) selectPiece(miss.index);
    const fs = root.querySelector(`[data-group="${miss.error.groupId}"]`);
    if (fs) {
      fs.classList.remove('is-invalid');
      void fs.offsetWidth;
      fs.classList.add('is-invalid');
      fs.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
      const first = fs.querySelector('input');
      if (first) first.focus({ preventScroll: true });
    }
    return;
  }
  const product = current.product;
  const pieces = current.pieces.map((p) => ({ options: [...p.selected], note: p.note }));
  const wasEdit = current.editKey;
  // Identical pieces merge into an existing line; a line never goes past the per-line maximum.
  const over = Pricing.groupPieces(product.id, pieces).some((l) => {
    const key = Pricing.lineKey(l);
    const had = key === wasEdit ? null : cart.rawLine(key);
    return (had ? had.qty : 0) + l.qty > cart.maxQty();
  });
  const lines = cart.addPieces(product.id, pieces, wasEdit);
  overlay.close(root);
  bumpCart();
  track('add_to_cart', { item_id: product.id, quantity: pieces.length });
  if (over) toast({ text: `Najviše ${cart.maxQty()} komada iste stavke u jednoj porudžbini — korpa je dopunjena do ${cart.maxQty()}. Za veću porudžbinu pozovite nas.`, icon: 'alert', tone: 'error', timeout: 7000 });
  else if (wasEdit) toast({ text: `${product.name}: izmene su sačuvane.`, timeout: 2600 });
  else announceAdded(product, pieces.length, lines.length);
}

function announceAdded(product, count, lineCount) {
  const idx = catalog().index;
  const inCart = cart.view().lines.map((l) => l.productId);
  const recs = Pricing.recommendations(idx, [product.id], catalog().data.recs || {}, 2).filter((r) => !inCart.includes(r.productId));
  const extra = recs.length
    ? `<div class="chips">${recs
        .map((r) => {
          const p = idx.products[r.productId];
          return `<button type="button" class="chip chip--price" data-toast-add="${esc(p.id)}">${icon('plus')} ${esc(p.name)} <small>${Money.formatNumber(p.price)}</small></button>`;
        })
        .join('')}</div>`
    : '';
  const what = count > 1 ? `${count}× ${product.name}${lineCount > 1 ? ' (različito složeni)' : ''}` : product.name;
  const t = toast({ text: `${what} ${count > 1 ? 'su' : 'je'} u korpi.`, extra, timeout: 5200 });
  t.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-toast-add]');
    if (!b) return;
    quickAdd(b.dataset.toastAdd, b);
    b.disabled = true;
    b.innerHTML = `${icon('check')} Dodato`;
  });
}

/** One tap add for option-less products (drinks, sauces, fries). */
export function quickAdd(productId, fromEl) {
  const p = productById(productId);
  if (!p) return;
  const state = orderingState();
  if (!state.can) {
    toast({ text: state.label, icon: 'clock', tone: 'error' });
    return;
  }
  if (p.available === false) {
    toast({ text: `Trenutno nema: ${p.name}.`, icon: 'alert', tone: 'error' });
    return;
  }
  if (Pricing.hasOptions(p)) {
    openProduct(productId, { fromEl });
    return;
  }
  const existing = cart.rawLine(Pricing.lineKey({ productId, options: [], note: '' }));
  if (existing && existing.qty >= cart.maxQty()) {
    toast({ text: `Najviše ${cart.maxQty()} komada po stavci. Za veću porudžbinu pozovite nas: ${business().phone_display || ''}.`, icon: 'alert', tone: 'error', timeout: 6000 });
    return;
  }
  const key = cart.addLine({ productId, qty: 1, options: [] });
  bumpCart();
  flyToCart(fromEl);
  track('add_to_cart', { item_id: productId, quantity: 1 });
  return key;
}

function flyToCart(fromEl) {
  if (!fromEl || prefersReducedMotion()) return;
  const target = [...document.querySelectorAll('[data-cart-open]')].find((b) => b.offsetParent !== null);
  if (!target) return;
  const a = fromEl.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const dot = document.createElement('div');
  dot.className = 'fly-dot';
  document.body.appendChild(dot);
  const x0 = a.left + a.width / 2;
  const y0 = a.top + a.height / 2;
  const x1 = b.left + b.width / 2;
  const y1 = b.top + b.height / 2;
  dot
    .animate(
      [
        { transform: `translate(${x0}px, ${y0}px) scale(1)` },
        { transform: `translate(${(x0 + x1) / 2}px, ${Math.min(y0, y1) - 80}px) scale(1.2)`, offset: 0.45 },
        { transform: `translate(${x1}px, ${y1}px) scale(0.4)`, opacity: 0.4 }
      ],
      { duration: 620, easing: 'cubic-bezier(0.5, 0, 0.3, 1)' }
    )
    .finished.then(() => dot.remove(), () => dot.remove());
}

export function openProduct(productId, { fromEl, editKey } = {}) {
  const product = productById(productId);
  if (!product) return;
  ensureRoot();
  const raw = editKey ? cart.rawLine(editKey) : null;
  current = { product, editKey: raw ? editKey : null, pieces: [], active: 0 };
  if (raw) {
    for (let i = 0; i < raw.qty; i++) current.pieces.push({ selected: new Set(raw.options), note: raw.note || '' });
  } else {
    current.pieces.push(newPiece());
  }
  render(fromEl);
  overlay.open(root, { focus: '[role="dialog"]', onClose: () => (current = null) });
  track('view_item', { item_id: product.id });
}

/** Adds directly when a product has no options, otherwise opens the sheet. */
export function addOrOpen(productId, fromEl) {
  const p = productById(productId);
  if (!p) return;
  if (Pricing.hasOptions(p)) openProduct(productId, { fromEl: fromEl && fromEl.closest('[data-product]') });
  else {
    if (!quickAdd(productId, fromEl)) return;
    const btn = fromEl && fromEl.closest('.product__add');
    if (btn) {
      btn.classList.add('is-added');
      btn.innerHTML = icon('check');
      setTimeout(() => {
        btn.classList.remove('is-added');
        btn.innerHTML = icon('plus');
      }, 1300);
    }
    toast({ text: `${p.name} je u korpi.`, timeout: 2600 });
  }
}

export { TAG_LABELS };
