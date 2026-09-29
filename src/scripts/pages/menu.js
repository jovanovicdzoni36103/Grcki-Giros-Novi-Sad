// /meni/ — the digital menu is where ordering starts.
import Money from '../shared/money.cjs';
import { $, $$, on, esc, icon, env } from '../core/dom.js';
import { subscribe } from '../core/events.js';
import { catalog, business, productById } from '../core/catalog.js';
import { schedule } from '../core/availability.js';
import * as cart from '../core/cart.js';
import { bootCommon } from './common.js';
import { menuSections, categoryNav, tagFilters, TAG_LABELS } from '../ui/render.js';
import { modeSwitch, refreshModeMeta, defaultMode, deliveryFeeLabel, etaText, closedReason, zoneSelect, zonesOn, zones, zoneById } from '../ui/mode.js';
import { openCart } from '../ui/cart-drawer.js';
import { initReveal } from '../ui/motion.js';
import { track } from '../core/analytics.js';

let activeFilter = null;
let renderedVersion = '';

function renderMenu() {
  const s = catalog();
  if (!s.data) return;
  const version = s.data.version + ':' + (cart.mode() || '');
  if (version === renderedVersion) return;
  renderedVersion = version;
  const assets = env().assets;
  const list = $('[data-menu-list]');
  const nav = $('[data-cat-nav]');
  const filters = $('[data-filters]');
  if (list) list.innerHTML = menuSections(assets, s.data.catalog, { mode: cart.mode() });
  if (nav) nav.innerHTML = categoryNav(s.data.catalog);
  if (filters) {
    filters.innerHTML = tagFilters(assets, s.data.catalog);
    filters.closest('[data-filters-wrap]').hidden = !filters.children.length;
  }
  applyFilter();
  spy();
}

function applyFilter() {
  $$('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === activeFilter)));
  let visible = 0;
  $$('[data-category-section]').forEach((section) => {
    let n = 0;
    section.querySelectorAll('[data-product]').forEach((p) => {
      const show = !activeFilter || (p.dataset.tags || '').split(' ').includes(activeFilter);
      p.hidden = !show;
      if (show) n++;
    });
    section.classList.toggle('is-empty', n === 0);
    visible += n;
  });
  const empty = $('[data-filter-empty]');
  if (empty) {
    empty.hidden = visible > 0;
    empty.innerHTML = `Nema proizvoda sa oznakom „${esc(TAG_LABELS[activeFilter] || '')}“. <button type="button" class="link" data-clear-filter>Prikaži sve</button>`;
  }
  const status = $('[data-filter-status]');
  if (status) status.textContent = activeFilter ? `Prikazano: ${visible} (${TAG_LABELS[activeFilter]})` : '';
}

let spyObserver;
function spy() {
  if (spyObserver) spyObserver.disconnect();
  const links = new Map($$('[data-cat-link]').map((a) => [a.dataset.catLink, a]));
  const setActive = (id) => {
    links.forEach((a, key) => a.classList.toggle('is-active', key === id));
    const a = links.get(id);
    if (a) {
      const row = a.parentElement;
      const target = a.offsetLeft - row.clientWidth / 2 + a.clientWidth / 2;
      row.scrollTo({ left: target, behavior: 'smooth' });
    }
  };
  spyObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.dataset.categorySection);
    },
    { rootMargin: '-30% 0px -60% 0px' }
  );
  $$('[data-category-section]').forEach((s) => spyObserver.observe(s));
}

function renderModeBar() {
  const bar = $('[data-mode-bar]');
  if (!bar) return;
  const snap = schedule();
  const mode = defaultMode(snap, cart.mode());
  const switchRoot = bar.querySelector('[data-mode-switch]');
  if (!switchRoot.dataset.ready || switchRoot.dataset.mode !== mode) {
    switchRoot.innerHTML = modeSwitch('menu-mode', mode, snap);
    switchRoot.dataset.ready = '1';
    switchRoot.dataset.mode = mode;
  } else refreshModeMeta(switchRoot, snap);
  const info = bar.querySelector('[data-mode-info]');
  const b = business();
  if (!snap) return;
  const av = snap[mode];
  const facts = [];
  if (av.canOrder) {
    facts.push(
      `<span class="mode-bar__fact">${icon('clock')}<span>${mode === 'delivery' ? `Dostava za <strong>${esc(etaText(av))}</strong>` : `Spremno za <strong>${esc(etaText(av))}</strong>`} · ili zakažite do ${esc(b.preorder_days || 7)} dana unapred</span></span>`
    );
    facts.push(`<span class="mode-bar__fact">${icon(mode === 'delivery' ? 'scooter' : 'pin')}<span>${mode === 'delivery' ? `Dostava ${esc(deliveryFeeLabel(zoneById(cart.zone())))}` : esc(b.address_street || '')}</span></span>`);
    facts.push(`<span class="mode-bar__fact">${icon('cash')}<span>Gotovina · poručivanje do ${esc(av.lastOrder)}</span></span>`);
  } else {
    facts.push(`<span class="mode-bar__fact">${icon('clock')}<span>${snap.paused ? esc(b.pause_message || 'Poručivanje je pauzirano.') : `<strong>Trenutno ne primamo porudžbine</strong> · ${esc(closedReason(av, mode))}`}</span></span>`);
    const other = snap[mode === 'delivery' ? 'pickup' : 'delivery'];
    if (other.canOrder) facts.push(`<button type="button" class="link" data-switch-mode="${mode === 'delivery' ? 'pickup' : 'delivery'}">${mode === 'delivery' ? 'Preuzimanje radi' : 'Dostava radi'} ${icon('arrow')}</button>`);
  }
  let zoneHtml = '';
  if (mode === 'delivery' && zonesOn() && zones().length) {
    const current = cart.zone();
    const z = zoneById(current);
    zoneHtml = `<div class="zone-select"><label class="sr-only" for="zone">Naselje za dostavu</label>${zoneSelect('zone', 'zone', current, { placeholder: 'Dostavljamo li do vas? Izaberite naselje' })}
      <span class="zone-result ${z ? 'is-ok' : current === 'none' ? 'is-no' : ''}" data-zone-result>${
        z
          ? `${icon('check')} Dostavljamo · ${esc(deliveryFeeLabel(z))}${z.minOrder ? ` · min. ${esc(Money.formatRSD(z.minOrder))}` : ''}`
          : current === 'none'
            ? `${icon('alert')} Dostava na tu lokaciju trenutno nije dostupna. Izaberite preuzimanje ili pozovite ${esc(b.phone_display || '')}.`
            : ''
      }</span></div>`;
  }
  info.innerHTML = facts.join('') + zoneHtml;
  const notice = $('[data-closed-notice]');
  if (notice) {
    const closed = !snap.open;
    notice.hidden = !closed;
    if (closed) {
      const why = snap.paused ? esc(b.pause_message || '') : snap.onBreak ? `Pauza je u toku, poručivanje ponovo ${esc((snap.pickup.next || snap.delivery.next || {}).label || 'uskoro')}.` : snap.next ? `Poručivanje ponovo ${esc(snap.next.label)}.` : '';
      notice.innerHTML = `${icon('clock')}<span><strong>Trenutno ne primamo porudžbine.</strong> ${why} Meni možete da pregledate.</span>`;
    }
  }
}

function renderReorder() {
  const box = $('[data-reorder]');
  if (!box) return;
  const last = cart.lastOrder();
  const fresh = last && Date.now() - last.at < 90 * 24 * 3600 * 1000 && Array.isArray(last.lines) && last.lines.length;
  if (!fresh || cart.itemCount() > 0 || !catalog().index) {
    box.hidden = true;
    return;
  }
  // One entry per product ("2× Klasik", not "1× Klasik, 1× Klasik" for two differently built pieces).
  const counts = new Map();
  last.lines.forEach((l) => {
    const p = productById(l.productId);
    if (p) counts.set(p.name, (counts.get(p.name) || 0) + (Number(l.qty) || 0));
  });
  if (!counts.size) {
    box.hidden = true;
    return;
  }
  const names = [...counts].map(([name, qty]) => `${qty}× ${name}`).join(', ');
  box.hidden = false;
  box.innerHTML = `${icon('repeat')}<div class="reorder__text"><strong>Isto kao prošli put?</strong><span>${esc(names)}</span></div><button type="button" class="btn btn--sm btn--blue" data-reorder-go><span class="btn__label">Ponovi</span></button>`;
}

async function init() {
  await bootCommon();
  renderMenu();
  renderModeBar();
  renderReorder();
  initReveal($('[data-menu-list]'));
  subscribe('catalog', () => {
    renderMenu();
    renderModeBar();
  });
  subscribe('availability', renderModeBar);
  subscribe('cart', () => {
    renderReorder();
    renderMenu();
  });
  on(document, 'change', '[name="menu-mode"]', (e, el) => {
    cart.setMode(el.value);
    renderModeBar();
  });
  on(document, 'click', '[data-switch-mode]', (e, el) => {
    cart.setMode(el.dataset.switchMode);
    renderModeBar();
  });
  on(document, 'change', '#zone', (e, el) => {
    cart.setZone(el.value);
    renderModeBar();
  });
  on(document, 'click', '[data-filter]', (e, el) => {
    activeFilter = activeFilter === el.dataset.filter ? null : el.dataset.filter;
    applyFilter();
    track('filter_menu', { filter: activeFilter || 'none' });
  });
  on(document, 'click', '[data-clear-filter]', () => {
    activeFilter = null;
    applyFilter();
  });
  on(document, 'click', '[data-reorder-go]', () => {
    const last = cart.lastOrder();
    if (!last) return;
    cart.replaceAll(last.lines.filter((l) => productById(l.productId)));
    openCart();
  });
  track('view_menu', {});
}

init();
