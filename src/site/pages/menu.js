// Meni — prerendered from the catalog snapshot (visible without JavaScript, indexable), hydrated live.
import { esc, iconSvg, menuSections, categoryNav, tagFilters } from '../../scripts/ui/render.js';
import { menu, breadcrumbs } from '../schema.js';
import Money from '../../scripts/shared/money.cjs';

export const meta = {
  path: '/meni/',
  out: 'meni/index.html',
  script: 'menu',
  title: 'Meni | Grčki Giros Novi Sad — giros, pita, sosevi',
  description: 'Digitalni meni Grčkog Girosa: giros u piti iz Atine, porcije, paketi, prilozi, sosevi i piće. Cene u dinarima, poručivanje online za dostavu ili preuzimanje.',
  bodyClass: 'page-menu',
  headerFixed: true,
  schema: (ctx) => [menu(ctx), breadcrumbs(ctx, [{ name: 'Meni', path: '/meni/' }])]
};

/** Same markup as ui/mode.js modeSwitch(), rendered at build time so the bar does not shift the page when JS arrives. */
function staticModeSwitch(ctx) {
  const a = ctx.assets;
  const b = ctx.business;
  const fee = String(b.delivery_fee_mode) === 'agency' ? 'po cenovniku dostavne službe' : `${Money.formatRSD(Number(b.delivery_fee_default) || 0)}`;
  const opt = (mode, title, ic, meta, checked) => `<div class="segmented__option">
      <input type="radio" name="menu-mode" id="menu-mode-${mode}" value="${mode}"${checked ? ' checked' : ''}>
      <label for="menu-mode-${mode}"><span class="segmented__title">${iconSvg(a, ic)}${title}</span><span class="segmented__meta" data-mode-meta="${mode}">${esc(meta)}</span></label>
    </div>`;
  return `<div class="segmented" role="radiogroup" aria-label="Način preuzimanja">${opt('delivery', 'Dostava', 'scooter', `~${b.delivery_eta_min} min · ${fee}`, true)}${opt('pickup', 'Preuzimanje', 'store', `${b.pickup_eta_min}–${b.pickup_eta_max} min · besplatno`, false)}</div>`;
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
    <p class="lead">Giros u piti iz Atine, porcije, paketi i sve što ide uz njih. Prvo izaberite dostavu ili preuzimanje — vreme i cenu vidite odmah.</p>
  </div>
</section>

<div class="container menu-top">
  <div class="notice notice--closed" data-closed-notice hidden></div>
  <div class="mode-bar" data-mode-bar>
    <div data-mode-switch data-ready="1" data-mode="delivery">${staticModeSwitch(ctx)}</div>
    <div class="mode-bar__info" data-mode-info><span class="mode-bar__fact">${iconSvg(a, 'clock')}<span>Dostava ~${esc(ctx.business.delivery_eta_min)} min · preuzimanje ${esc(ctx.business.pickup_eta_min)}–${esc(ctx.business.pickup_eta_max)} min</span></span></div>
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
