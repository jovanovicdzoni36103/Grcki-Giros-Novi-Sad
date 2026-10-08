// Dostava i preuzimanje + česta pitanja (FAQPage). The site takes no orders: phone or the shop. Values come from SETTINGS.
import { esc, iconSvg, hoursRows, mapsUrl } from '../../scripts/ui/render.js';
import { faq, breadcrumbs } from '../schema.js';

function faqItems(ctx) {
  const b = ctx.business;
  return [
    ['Koliko traje dostava?', `Između ${b.delivery_eta_min} i ${b.delivery_eta_max} minuta. U špicu može duže, zato pišemo raspon, a ne tačan minut.`],
    ['Za koliko je spremno preuzimanje?', `Za ${b.pickup_eta_min} do ${b.pickup_eta_max} minuta.`],
    ['Kako da poručim?', `Dođite u lokal u ulici ${b.address_street} ili pozovite ${b.phone_display}.`],
    ['Mogu li da poručim veću količinu?', `Možete. Za veće porudžbine pozovite ${b.phone_display} i dogovorićemo sve telefonom.`],
    ['Da li mogu da platim karticom?', 'Za sada ne. Plaćanje je gotovinom, na kasi ili dostavljaču.'],
    ['Kako da izmenim ili otkažem porudžbinu?', `Pozovite ${b.phone_display}. Što ranije javite, to je lakše.`],
    ['Mogu li giros bez luka ili bez pomfrita?', 'Naravno. Recite šta ne želite kada poručujete i giros slažemo bez toga.'],
    ['Kada radite?', `${ctx.hoursLine}. Dostava ${ctx.deliveryLine}. Nedeljom ne radimo.`],
    ['Mogu li da jedem u lokalu?', `Možete. Lokal u ulici ${b.address_street}${b.address_note ? `, ${b.address_note},` : ''} ima mesta za sedenje.`]
  ];
}

export const meta = {
  path: '/dostava/',
  out: 'dostava/index.html',
  script: 'basic',
  title: 'Dostava i preuzimanje | Grčki Giros Novi Sad',
  description: 'Preuzimanje u lokalu za 5 do 30 minuta, dostava za 45 do 60 minuta, plaćanje gotovinom. Porudžbine telefonom ili u lokalu, Dimitrija Tucovića 3. Česta pitanja.',
  bodyClass: 'page-delivery',
  schema: (ctx) => [faq(faqItems(ctx)), breadcrumbs(ctx, [{ name: 'Dostava', path: '/dostava/' }])]
};

export function render(ctx) {
  const a = ctx.assets;
  const b = ctx.business;
  return `<main id="main">
<section class="page-hero">
  <div class="container page-hero__grid">
    <div>
      <p class="kicker">Dostava i preuzimanje</p>
      <h1 class="h1" style="margin-top:0.8rem" data-split>Giros u lokalu <span>ili na adresu.</span></h1>
    </div>
    <p class="lead">Svratite u ${esc(b.address_street)} ili pozovite ${esc(b.phone_display)}. Plaćanje je gotovinom.</p>
  </div>
</section>

<section class="section section--tight">
  <div class="container split-2">
    <article class="info-card info-card--blue on-blue" data-reveal>
      <h2>${iconSvg(a, 'scooter')}Dostava</h2>
      <dl class="facts">
        <div><dt>Vreme</dt><dd>${esc(b.delivery_eta_min)}–${esc(b.delivery_eta_max)} minuta</dd></div>
        <div><dt>Radno vreme</dt><dd>${esc(ctx.deliveryLine)}</dd></div>
        <div><dt>Poručivanje</dt><dd>telefonom</dd></div>
        <div><dt>Plaćanje</dt><dd>gotovinom dostavljaču</dd></div>
        <div><dt>Ko dostavlja</dt><dd>partnerska dostavna služba</dd></div>
      </dl>
      <a class="btn btn--gold" href="tel:${esc(b.phone_e164)}" data-track="delivery"><span class="btn__label">Pozovite ${esc(b.phone_display)}</span>${iconSvg(a, 'phone', 'btn__icon')}</a>
    </article>
    <article class="info-card" data-reveal style="--i:1">
      <h2>${iconSvg(a, 'store')}Preuzimanje</h2>
      <dl class="facts">
        <div><dt>Vreme</dt><dd>${esc(b.pickup_eta_min)}–${esc(b.pickup_eta_max)} minuta</dd></div>
        <div><dt>Adresa</dt><dd>${esc(b.address_street)}, ${esc(b.address_city)}${b.address_note ? `<br><span class="small">${esc(b.address_note)}</span>` : ''}</dd></div>
        <div><dt>Radno vreme</dt><dd>${esc(ctx.hoursLine)}</dd></div>
        <div><dt>Plaćanje</dt><dd>gotovinom na kasi</dd></div>
      </dl>
      <a class="btn btn--blue" href="${esc(mapsUrl(b))}" target="_blank" rel="noopener"><span class="btn__label">Otvori u mapama</span>${iconSvg(a, 'map', 'btn__icon')}</a>
    </article>
  </div>
</section>

<section class="section section--cream section--tight">
  <div class="container split-2" style="align-items:center">
    <div>
      <p class="kicker">Veće porudžbine</p>
      <h2 class="h2" style="margin-top:0.8rem">Pozovite nas.</h2>
    </div>
    <p class="lead">Za veću porudžbinu pozovite <a href="tel:${esc(b.phone_e164)}" data-track="delivery-large">${esc(b.phone_display)}</a> i dogovorićemo sve telefonom.</p>
  </div>
</section>

<section class="section" aria-labelledby="faq-title">
  <div class="container">
    <div class="section__head section__head--split">
      <h2 class="h2" id="faq-title" data-split>Česta pitanja</h2>
      <p class="lead">Nema odgovora? Pozovite <a href="tel:${esc(b.phone_e164)}">${esc(b.phone_display)}</a>.</p>
    </div>
    <div class="faq">${faqItems(ctx)
      .map(([q, ans]) => `<details><summary>${esc(q)}${iconSvg(a, 'plus')}</summary><p>${esc(ans)}</p></details>`)
      .join('')}</div>
  </div>
</section>

<section class="section section--tight">
  <div class="container"><div class="visit__card" style="max-width:560px">
    <p class="kicker">Radno vreme</p>
    <dl class="hours-list" data-hours data-hours-delivery>${hoursRows(ctx.weekly, { deliveryColumn: true })}</dl>
  </div></div>
</section>
</main>`;
}
