// /meni/: the digital menu, prerendered and refreshed live from the sheet (prices, availability).
import { $, $$, on, esc, env } from '../core/dom.js';
import { subscribe } from '../core/events.js';
import { catalog } from '../core/catalog.js';
import { bootCommon } from './common.js';
import { menuSections, categoryNav, tagFilters, TAG_LABELS } from '../ui/render.js';
import { initReveal } from '../ui/motion.js';
import { track } from '../core/analytics.js';

let activeFilter = null;
let renderedVersion = '';

function renderMenu() {
  const s = catalog();
  if (!s.data) return;
  const version = String(s.data.version);
  if (version === renderedVersion) return;
  renderedVersion = version;
  const assets = env().assets;
  const list = $('[data-menu-list]');
  const nav = $('[data-cat-nav]');
  const filters = $('[data-filters]');
  if (list) list.innerHTML = menuSections(assets, s.data.catalog);
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

async function init() {
  await bootCommon();
  renderMenu();
  initReveal($('[data-menu-list]'));
  subscribe('catalog', renderMenu);
  on(document, 'click', '[data-filter]', (e, el) => {
    activeFilter = activeFilter === el.dataset.filter ? null : el.dataset.filter;
    applyFilter();
    track('filter_menu', { filter: activeFilter || 'none' });
  });
  on(document, 'click', '[data-clear-filter]', () => {
    activeFilter = null;
    applyFilter();
  });
  track('view_menu', {});
}

init();
