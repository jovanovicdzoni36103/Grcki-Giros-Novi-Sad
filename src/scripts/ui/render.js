// HTML templates shared by the build (prerendered pages, no-JS/SEO) and the browser (live updates).
// Pure functions: data in, HTML string out.
import Money from '../shared/money.cjs';
import { artFor } from './art-variants.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
export const rsd = (n) => Money.formatRSD(n);

export const TAG_LABELS = {
  popular: 'Popularno',
  recommended: 'Preporuka',
  new: 'Novo',
  spicy: 'Ljuto',
  vegetarian: 'Vegetarijansko',
  promo: 'Akcija',
  family: 'Porodično',
  value: 'Najpovoljnije'
};

/** Tag filters that make sense to a hungry guest, in this order. */
export const FILTER_TAGS = ['popular', 'recommended', 'spicy', 'vegetarian', 'value', 'family', 'new'];

const TAG_ICONS = { spicy: 'flame', vegetarian: 'leaf', popular: 'star', new: 'spark', recommended: 'check' };

/** The shop on Google Maps: the place page from SETTINGS map_url, otherwise a search for the address. */
export function mapsUrl(b) {
  if (/^https:\/\/(www\.)?google\.[a-z.]+\/maps\/|^https:\/\/maps\.app\.goo\.gl\//.test(b.map_url || '')) return b.map_url;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.map_query || [b.address_street, b.address_city].filter(Boolean).join(', '))}`;
}

export function iconSvg(assets, name, cls = 'icon') {
  return `<svg class="${cls}" aria-hidden="true" focusable="false"><use href="${assets.icons}#i-${name}"/></svg>`;
}

export function artSvg(assets, product, cls = 'art') {
  const v = artFor(product);
  if (product.image) {
    return `<img class="${cls}" src="${esc(product.image)}" alt="${esc(product.name)}" loading="lazy" decoding="async" width="400" height="432">`;
  }
  return `<svg class="${cls}" viewBox="0 0 200 220" role="img" aria-label="${esc(product.name)}"${v.style ? ` style="${v.style}"` : ''}><use href="${assets.art}#${v.symbol}"/></svg>`;
}

export function artBg(product) {
  return product.image ? '#F2EBDD' : artFor(product).bg;
}

export function tagList(assets, tags, limit = 2) {
  return (tags || [])
    .filter((t) => TAG_LABELS[t])
    .slice(0, limit)
    .map((t) => `<span class="tag tag--${t}">${TAG_ICONS[t] ? iconSvg(assets, TAG_ICONS[t]) : ''}${TAG_LABELS[t]}</span>`)
    .join('');
}

export function priceHtml(product) {
  const compare = product.comparePrice && product.comparePrice > product.price ? `<s>${rsd(product.comparePrice)}</s>` : '';
  return `<span class="product__price num">${rsd(product.price)}${compare}</span>`;
}

/**
 * One menu row. `ctx.canOrder` switches the add button's label for closed hours.
 */
export function productRow(assets, product, ctx = {}) {
  const unavailable = product.available === false || (ctx.mode === 'delivery' && product.delivery === false);
  const addLabel = unavailable ? `${product.name} trenutno nije dostupan` : `Dodaj ${product.name} u korpu`;
  const tags = (product.tags || []).join(' ');
  return `<article class="product${unavailable ? ' is-unavailable' : ''}" data-product="${esc(product.id)}" data-tags="${esc(tags)}" data-category="${esc(product.categoryId)}">
  <button type="button" class="product__hit" data-open-product="${esc(product.id)}" aria-label="${esc(product.name)}, ${esc(rsd(product.price))}. Prikaži detalje"></button>
  <div class="product__body">
    ${tagList(assets, product.tags) ? `<div class="product__tags">${tagList(assets, product.tags)}</div>` : ''}
    <h3 class="product__name">${esc(product.name)}</h3>
    ${product.description ? `<p class="product__desc">${esc(product.description)}</p>` : ''}
    <div class="product__meta">${priceHtml(product)}${product.includes ? `<span class="product__includes">${esc(product.includes)}</span>` : ''}${unavailable ? '<span class="soldout">Trenutno nema</span>' : ''}</div>
  </div>
  <div class="product__media-wrap">
    <div class="product__media art-frame" style="--art-bg:${artBg(product)}">${artSvg(assets, product)}</div>
    <button type="button" class="product__add" data-add="${esc(product.id)}" aria-label="${esc(addLabel)}"${unavailable ? ' disabled' : ''}>${iconSvg(assets, 'plus')}</button>
  </div>
</article>`;
}

export function menuSections(assets, catalog, ctx = {}) {
  const cats = (catalog.categories || []).slice().sort((a, b) => a.sort - b.sort);
  return cats
    .map((cat, i) => {
      const products = (catalog.products || []).filter((p) => p.categoryId === cat.id).sort((a, b) => a.sort - b.sort);
      if (!products.length) return '';
      return `<section class="menu-section" id="kat-${esc(cat.id)}" data-category-section="${esc(cat.id)}" aria-labelledby="kat-${esc(cat.id)}-title">
  <header class="menu-section__head">
    <span class="menu-section__index">${String(i + 1).padStart(2, '0')}</span>
    <h2 class="menu-section__title" id="kat-${esc(cat.id)}-title">${esc(cat.name)}</h2>
    ${cat.description ? `<p class="menu-section__desc">${esc(cat.description)}</p>` : ''}
  </header>
  <div class="menu-grid">${products.map((p) => productRow(assets, p, ctx)).join('')}</div>
</section>`;
    })
    .join('');
}

export function categoryNav(catalog) {
  const cats = (catalog.categories || []).slice().sort((a, b) => a.sort - b.sort);
  return cats
    .map((cat) => {
      const n = (catalog.products || []).filter((p) => p.categoryId === cat.id).length;
      if (!n) return '';
      return `<a class="chip" href="#kat-${esc(cat.id)}" data-cat-link="${esc(cat.id)}">${esc(cat.name)} <small>${n}</small></a>`;
    })
    .join('');
}

export function tagFilters(assets, catalog) {
  const present = new Set((catalog.products || []).flatMap((p) => p.tags || []));
  return FILTER_TAGS.filter((t) => present.has(t))
    .map((t) => `<button type="button" class="chip" data-filter="${t}" aria-pressed="false">${TAG_ICONS[t] ? iconSvg(assets, TAG_ICONS[t]) : ''}${TAG_LABELS[t]}</button>`)
    .join('');
}

/** Home "Šta se najviše uzima" cards. */
export function featuredCard(assets, product, index) {
  return `<article class="feature-card" data-product="${esc(product.id)}" style="--art-bg:${artBg(product)};--i:${index}" data-reveal>
  <button type="button" class="feature-card__hit" data-open-product="${esc(product.id)}" aria-label="${esc(product.name)}, ${esc(rsd(product.price))}. Prikaži detalje"></button>
  <span class="feature-card__index">${String(index + 1).padStart(2, '0')}</span>
  <div class="feature-card__art art-frame" style="--art-bg:${artBg(product)}">${artSvg(assets, product)}</div>
  <div class="feature-card__body">
    <h3 class="feature-card__name">${esc(product.name)}</h3>
    <p class="feature-card__desc">${esc(product.description)}</p>
    <div class="feature-card__foot"><span class="feature-card__price num">${rsd(product.price)}</span><span class="feature-card__cta">Naruči ${iconSvg(assets, 'arrow')}</span></div>
  </div>
</article>`;
}

export function hoursRows(summary, { deliveryColumn = false } = {}) {
  return summary
    .map(
      (r) =>
        `<div${r.closed ? ' class="is-closed"' : ''}><dt>${esc(r.days)}</dt><dd>${r.closed ? 'ne radimo' : esc(r.store)}${deliveryColumn && !r.closed && r.delivery ? ` <small>dostava ${esc(r.delivery)}</small>` : ''}${!r.closed && r.brk ? ` <small>pauza ${esc(r.brk)}</small>` : ''}</dd></div>`
    )
    .join('');
}
