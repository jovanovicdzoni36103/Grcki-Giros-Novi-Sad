// Meni: prerendered from the catalog snapshot (visible without JavaScript, indexable), hydrated live.
import { esc, menuSections, categoryNav, tagFilters } from '../../scripts/ui/render.js';
import { menu, breadcrumbs } from '../schema.js';

export const meta = {
  path: '/meni/',
  out: 'meni/index.html',
  script: 'menu',
  title: 'Meni i cene | Grčki Giros Novi Sad: giros, pljeskavice, pomfrit',
  description: 'Meni Grčkog Girosa sa cenama: giros u grčkoj piti (pileći, svinjski, mix), vege giros, pljeskavice, banjalučki ćevap, kobasica sa sirom, pomfrit i piće.',
  bodyClass: 'page-menu',
  headerFixed: true,
  schema: (ctx) => [menu(ctx), breadcrumbs(ctx, [{ name: 'Meni', path: '/meni/' }])]
};

export function render(ctx) {
  const a = ctx.assets;
  return `<main id="main">
<section class="page-hero" style="padding-bottom:1.2rem">
  <div class="container page-hero__grid">
    <div>
      <p class="kicker">Meni · Novi Sad</p>
      <h1 class="h1" style="margin-top:0.8rem" data-split>Meni <span>i cene</span></h1>
    </div>
    <p class="lead">Giros u grčkoj piti, pljeskavice sa roštilja i sve što ide uz njih. Premaze, salate i začine birate po ukusu, bez doplate.</p>
  </div>
</section>

<nav class="cat-nav" aria-label="Kategorije menija">
  <div class="container"><div class="chips chips--scroll" data-cat-nav>${categoryNav(ctx.catalog)}</div></div>
</nav>

<div class="container">
  <div class="filters" data-filters-wrap>
    <span class="filters__label">Filter</span>
    <div class="chips chips--scroll" data-filters>${tagFilters(a, ctx.catalog)}</div>
  </div>
  <p class="sr-only" aria-live="polite" data-filter-status></p>
  <div data-menu-list>${menuSections(a, ctx.catalog)}</div>
  <p class="filter-empty" data-filter-empty hidden></p>
  <div class="menu-foot">
    <p>Cene su u dinarima, sa PDV-om. Plaćanje gotovinom, na kasi ili dostavljaču.</p>
    <p>Imate alergiju ili posebnu želju? Recite nam kada poručujete ili pozovite <a href="tel:${esc(ctx.business.phone_e164)}">${esc(ctx.business.phone_display)}</a>.</p>
  </div>
</div>
</main>`;
}
