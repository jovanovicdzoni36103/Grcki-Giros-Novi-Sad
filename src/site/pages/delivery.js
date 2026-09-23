// Dostava i preuzimanje + česta pitanja (FAQPage). Values come from the SETTINGS snapshot.
import { esc, iconSvg, hoursRows } from '../../scripts/ui/render.js';
import { faq, breadcrumbs } from '../schema.js';
import Money from '../../scripts/shared/money.cjs';

function faqItems(ctx) {
  const b = ctx.business;
  const fee = String(b.delivery_fee_mode) === 'agency' ? 'po cenovniku dostavne službe' : `${Money.formatRSD(Number(b.delivery_fee_default) || 0)}`.replace(' ', ' ');
  const ahead = Math.round(Number(b.preorder_max_ahead_min || 120) / 60);
  return [
    ['Koliko traje dostava?', `Oko ${b.delivery_eta_min} minuta od porudžbine. U špicu može duže, zato pišemo „oko“, a ne tačan minut. Tačnu procenu vidite pre nego što poručite.`],
    ['Za koliko je spremno preuzimanje?', `Za ${b.pickup_eta_min} minuta, u špicu do ${b.pickup_eta_max}. Procenjeno vreme piše na potvrdi porudžbine.`],
    ['Da li mogu da platim karticom?', 'Za sada ne. Plaćate gotovinom — dostavljaču ili na kasi. Pri poručivanju upišete sa koliko novca plaćate, da dostavljač ponese tačan kusur.'],
    ['Koliko košta dostava?', `Dostava je ${fee}. Tačan iznos vidite u korpi, pre potvrde. Za preuzimanje u lokalu nema troška.`],
    ['Mogu li da poručim za kasnije?', `Možete, do ${ahead} sata unapred, za isti dan. Slobodne termine birate u koraku „Kada?“.`],
    ['Da li dostavljate do mene?', `Dostavljamo po Novom Sadu preko partnerske dostavne službe. Ako niste sigurni za svoju adresu, pozovite ${b.phone_display} pre poručivanja.`],
    ['Kako da izmenim ili otkažem porudžbinu?', `Pozovite ${b.phone_display} i recite broj porudžbine. Što ranije javite, to je lakše.`],
    ['Mogu li giros bez luka ili bez pomfrita?', 'Naravno. Pri izboru jela isključite šta ne želite — u kuhinji to piše crvenim slovima. Za sve ostalo postoji napomena.'],
    ['Da li postoji minimalna porudžbina?', Number(b.min_order_delivery) > 0 ? `Za dostavu je minimum ${b.min_order_delivery} dinara.` : 'Ne postoji. Poručite i jedan giros.'],
    ['Kada radite?', `${ctx.hoursLine}. Dostava ${ctx.deliveryLine}. Nedeljom ne radimo.`],
    ['Mogu li da jedem u lokalu?', `Možete. Lokal u ulici ${b.address_street} ima mesta za sedenje.`],
    ['Da li pita zaista stiže iz Atine?', 'Da. To je razlog zašto postojimo.']
  ];
}

export const meta = {
  path: '/dostava/',
  out: 'dostava/index.html',
  script: 'basic',
  title: 'Dostava girosa u Novom Sadu — vreme i uslovi | Grčki Giros',
  description: 'Dostava girosa po Novom Sadu za oko 60 minuta, preuzimanje za 15. Plaćanje gotovinom, poručivanje unapred do 2 sata. Česta pitanja o dostavi i porudžbinama.',
  bodyClass: 'page-delivery',
  schema: (ctx) => [faq(faqItems(ctx)), breadcrumbs(ctx, [{ name: 'Dostava', path: '/dostava/' }])]
};

export function render(ctx) {
  const a = ctx.assets;
  const b = ctx.business;
  const zonesOn = String(b.zones_enabled).toUpperCase() === 'TRUE';
  const feeText = String(b.delivery_fee_mode) === 'agency' ? 'po cenovniku dostavne službe' : Money.formatRSD(Number(b.delivery_fee_default) || 0);
  return `<main id="main">
<section class="page-hero">
  <div class="container page-hero__grid">
    <div>
      <p class="kicker">Dostava i preuzimanje</p>
      <h1 class="h1" style="margin-top:0.8rem" data-split>Dostava girosa <span>u Novom Sadu.</span></h1>
    </div>
    <p class="lead">Birate na početku: dostava na adresu ili preuzimanje u lokalu. Vreme i cenu znate pre nego što izaberete jelo.</p>
  </div>
</section>

<section class="section section--tight">
  <div class="container split-2">
    <article class="info-card info-card--blue on-blue" data-reveal>
      <h2>${iconSvg(a, 'scooter')}Dostava</h2>
      <dl class="facts">
        <div><dt>Vreme</dt><dd>oko ${esc(b.delivery_eta_min)} minuta</dd></div>
        <div><dt>Radno vreme</dt><dd>${esc(ctx.deliveryLine)}</dd></div>
        <div><dt>Cena</dt><dd>${esc(feeText)}</dd></div>
        <div><dt>Plaćanje</dt><dd>gotovinom dostavljaču — unapred upišete sa koliko plaćate, pa kurir ponese kusur</dd></div>
        <div><dt>Ko dostavlja</dt><dd>partnerska dostavna služba</dd></div>
        ${zonesOn && ctx.zones.length ? `<div><dt>Zone</dt><dd>${ctx.zones.map((z) => `${esc(z.name)} — ${esc(Money.formatRSD(z.fee))}`).join('<br>')}</dd></div>` : ''}
      </dl>
      <a class="btn btn--gold" href="/meni/"><span class="btn__label">Poruči dostavu</span>${iconSvg(a, 'arrow', 'btn__icon')}</a>
    </article>
    <article class="info-card" data-reveal style="--i:1">
      <h2>${iconSvg(a, 'store')}Preuzimanje</h2>
      <dl class="facts">
        <div><dt>Vreme</dt><dd>${esc(b.pickup_eta_min)}–${esc(b.pickup_eta_max)} minuta</dd></div>
        <div><dt>Adresa</dt><dd>${esc(b.address_street)}, ${esc(b.address_city)}</dd></div>
        <div><dt>Radno vreme</dt><dd>${esc(ctx.hoursLine)}</dd></div>
        <div><dt>Cena</dt><dd>bez troška</dd></div>
        <div><dt>Plaćanje</dt><dd>gotovinom na kasi</dd></div>
      </dl>
      <a class="btn btn--blue" href="/meni/"><span class="btn__label">Poruči za preuzimanje</span>${iconSvg(a, 'arrow', 'btn__icon')}</a>
    </article>
  </div>
</section>

<section class="section section--cream section--tight">
  <div class="container split-2" style="align-items:center">
    <div>
      <p class="kicker">Poručivanje unapred</p>
      <h2 class="h2" style="margin-top:0.8rem">Do dva sata unapred.</h2>
    </div>
    <p class="lead">Za isti dan, u okviru radnog vremena. Prvi slobodan termin je sat vremena od poručivanja, a sistem nikad ne nudi termin koji ne može da se ispuni. Nedeljom ne radimo.</p>
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
