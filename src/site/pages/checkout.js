// Porudžbina — checkout, confirmation and order status (noindex).
import { esc, iconSvg } from '../../scripts/ui/render.js';

export const meta = {
  path: '/porudzbina/',
  out: 'porudzbina/index.html',
  script: 'checkout',
  title: 'Porudžbina | Grčki Giros',
  description: 'Završite porudžbinu: dostava ili preuzimanje, vreme, adresa i plaćanje gotovinom.',
  bodyClass: 'page-checkout',
  headerFixed: true,
  noOrderBar: true,
  noindex: true,
  schema: () => []
};

export function render(ctx) {
  const a = ctx.assets;
  return `<main id="main" class="checkout page-top">
  <div class="container checkout__grid">
    <aside class="checkout__aside" data-checkout-summary aria-label="Pregled korpe"></aside>
    <div class="checkout__main">
      <div class="checkout__head">
        <a class="link" href="/meni/">${iconSvg(a, 'arrow-left')} Nazad na meni</a>
        <h1 class="h1">Porudžbina</h1>
      </div>
      <div data-checkout-app aria-live="polite">
        <p class="muted">Učitavanje korpe…</p>
      </div>
      <noscript><p class="notice">Za poručivanje preko sajta uključite JavaScript ili nas pozovite na <a href="tel:${esc(ctx.business.phone_e164)}">${esc(ctx.business.phone_display)}</a>.</p></noscript>
    </div>
  </div>
</main>`;
}
