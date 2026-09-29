// Meni — prerendered from the catalog snapshot (visible without JavaScript, indexable), hydrated live.
import { esc, iconSvg, menuSections, categoryNav, tagFilters } from '../../scripts/ui/render.js';
import { menu, breadcrumbs } from '../schema.js';
import Money from '../../scripts/shared/money.cjs';

export const meta = {
  path: '/meni/',
  out: 'meni/index.html',
  script: 'menu',
  title: 'Meni | Grčki Giros Novi Sad — giros, pljeskavice, pomfrit',
  description: 'Meni Grčkog Girosa: giros u grčkoj piti (pileći, svinjski, mix), pljeskavice, banjalučki ćevap, pomfrit i piće. Poručite online za dostavu ili preuzimanje.',
  bodyClass: 'page-menu',
  headerFixed: true,
  schema: (ctx) => [menu(ctx), breadcrumbs(ctx, [{ name: 'Meni', path: '/meni/' }])]
};

const zonesOn = (ctx) => String(ctx.business.zones_enabled).toUpperCase() === 'TRUE' && ctx.zones.length > 0;

function feeLabel(ctx) {
  const b = ctx.business;
  if (String(b.delivery_fee_mode) === 'agency') return 'po cenovniku dostavne službe';
  if (zonesOn(ctx)) {
    const fees = ctx.zones.map((z) => z.fee);
    const min = Math.min(...fees);
    return Math.max(...fees) === min ? Money.formatRSD(min) : `od ${Money.formatRSD(min)}`;
  }
  return Money.formatRSD(Number(b.delivery_fee_default) || 0);
}

const range = (min, max) => (Number(min) === Number(max) ? `${min} min` : `${min}–${max} min`);

/** Same markup as ui/mode.js modeSwitch(), rendered at build time so the bar does not shift the page when JS arrives. */
function staticModeSwitch(ctx) {
  const a = ctx.assets;
  const b = ctx.business;
  const opt = (mode, title, ic, meta, checked) => `<div class="segmented__option">
      <input type="radio" name="menu-mode" id="menu-mode-${mode}" value="${mode}"${checked ? ' checked' : ''}>
      <label for="menu-mode-${mode}"><span class="segmented__title">${iconSvg(a, ic)}${title}</span><span class="segmented__meta" data-mode-meta="${mode}">${esc(meta)}</span></label>
    </div>`;
  return `<div class="segmented" role="radiogroup" aria-label="Način preuzimanja">${opt('delivery', 'Dostava', 'scooter', `${range(b.delivery_eta_min, b.delivery_eta_max)} · ${feeLabel(ctx)}`, true)}${opt('pickup', 'Preuzimanje', 'store', `${range(b.pickup_eta_min, b.pickup_eta_max)} · besplatno`, false)}</div>`;
}

/** Same shape as the live bar in pages/menu.js (three facts + the zone picker): hydration swaps text, not layout. */
function staticModeInfo(ctx) {
  const a = ctx.assets;
  const b = ctx.business;
  const zoneOptions = ctx.zones
    .map((z) => `<optgroup label="${esc(z.name)} · dostava ${esc(Money.formatRSD(z.fee))}">${String(z.areas).split(',').map((x) => `<option value="${esc(z.id)}">${esc(x.trim())}</option>`).join('')}</optgroup>`)
    .join('');
  return `<span class="mode-bar__fact">${iconSvg(a, 'clock')}<span>Dostava za <strong>${esc(range(b.delivery_eta_min, b.delivery_eta_max))}</strong> · ili zakažite do ${esc(b.preorder_days || 7)} dana unapred</span></span>
    <span class="mode-bar__fact">${iconSvg(a, 'scooter')}<span>Dostava ${esc(feeLabel(ctx))}</span></span>
    <span class="mode-bar__fact">${iconSvg(a, 'cash')}<span>Gotovina dostavljaču ili na kasi</span></span>
    ${
      zonesOn(ctx)
        ? `<div class="zone-select"><label class="sr-only" for="zone">Naselje za dostavu</label><select class="input" id="zone" name="zone"><option value="">Dostavljamo li do vas? Izaberite naselje</option>${zoneOptions}<option value="none">Mog naselja nema na spisku</option></select><span class="zone-result" data-zone-result></span></div>`
        : ''
    }`;
}

export function render(ctx) {
  const a = ctx.assets;
  return `<main id="main">
<section class="page-hero" style="padding-bottom:1.2rem">
  <div class="container page-hero__grid">
    <div>
      <p class="kicker">Meni · Novi Sad</p>
      <h1 class="h1" style="margin-top:0.8rem" data-split>Meni <span>i poručivanje</span></h1>
    </div>
    <p class="lead">Giros u grčkoj piti, pljeskavice sa roštilja i sve što ide uz njih. Prvo izaberite dostavu ili preuzimanje — vreme i cenu vidite odmah.</p>
  </div>
</section>

<div class="container menu-top">
  <div class="notice notice--closed" data-closed-notice hidden></div>
  <div class="mode-bar" data-mode-bar>
    <div data-mode-switch data-ready="1" data-mode="delivery">${staticModeSwitch(ctx)}</div>
    <div class="mode-bar__info" data-mode-info>${staticModeInfo(ctx)}</div>
  </div>
  <div class="reorder" data-reorder hidden></div>
</div>

<nav class="cat-nav" aria-label="Kategorije menija">
  <div class="container"><div class="chips chips--scroll" data-cat-nav>${categoryNav(ctx.catalog)}</div></div>
</nav>

<div class="container">
  <div class="filters" data-filters-wrap>
    <span class="filters__label">Filter</span>
    <div class="chips chips--scroll" data-filters>${tagFilters(a, ctx.catalog)}</div>
  </div>
  <p class="sr-only" aria-live="polite" data-filter-status></p>
  <div data-menu-list>${menuSections(a, ctx.catalog, {})}</div>
  <p class="filter-empty" data-filter-empty hidden></p>
  <div class="menu-foot">
    <p>Cene su u dinarima, sa PDV-om. Plaćanje gotovinom — dostavljaču ili na kasi.</p>
    <p>Imate alergiju ili posebnu želju? Napišite u napomenu uz jelo ili pozovite <a href="tel:${esc(ctx.business.phone_e164)}">${esc(ctx.business.phone_display)}</a>.</p>
  </div>
</div>
<noscript><div class="container"><p class="notice">Za poručivanje preko sajta uključite JavaScript ili nas pozovite na ${esc(ctx.business.phone_display)}.</p></div></noscript>
</main>`;
}
