// Dostava i preuzimanje + česta pitanja (FAQPage). Values come from the SETTINGS snapshot.
import { esc, iconSvg, hoursRows } from '../../scripts/ui/render.js';
import { faq, breadcrumbs } from '../schema.js';
import Money from '../../scripts/shared/money.cjs';

const zonesOn = (ctx) => String(ctx.business.zones_enabled).toUpperCase() === 'TRUE' && ctx.zones.length > 0;

function feeText(ctx) {
  const b = ctx.business;
  if (String(b.delivery_fee_mode) === 'agency') return 'po cenovniku dostavne službe';
  if (zonesOn(ctx)) return ctx.zones.map((z) => `${z.name}: ${Money.formatRSD(z.fee)}`).join(', ').replace(/\u00a0/g, ' ');
  return Money.formatRSD(Number(b.delivery_fee_default) || 0).replace(/\u00a0/g, ' ');
}

function minOrderText(ctx) {
  const mins = zonesOn(ctx) ? [...new Set(ctx.zones.map((z) => Number(z.minOrder) || 0))] : [Number(ctx.business.min_order_delivery) || 0];
  if (mins.length === 1) return mins[0] ? `${mins[0]} dinara` : '';
  return `od ${Math.min(...mins)} do ${Math.max(...mins)} dinara, zavisno od naselja`;
}

function faqItems(ctx) {
  const b = ctx.business;
  const days = Number(b.preorder_days || 7);
  const min = minOrderText(ctx);
  return [
    ['Koliko traje dostava?', `Između ${b.delivery_eta_min} i ${b.delivery_eta_max} minuta. U špicu može duže, zato pišemo raspon, a ne tačan minut. Tačnu procenu vidite pre nego što poručite.`],
    ['Za koliko je spremno preuzimanje?', `Za ${b.pickup_eta_min} do ${b.pickup_eta_max} minuta. Procenjeno vreme piše na potvrdi porudžbine.`],
    ['Kako znam da je porudžbina prihvaćena?', `Lokal potvrđuje svaku porudžbinu u roku od ${b.accept_timeout_min || 5} minuta. Status pratite na stranici porudžbine, a ako ostavite email, javljamo vam i tamo.`],
    ['Da li mogu da platim karticom?', 'Za sada ne. Plaćate gotovinom — dostavljaču ili na kasi. Pri poručivanju upišete sa koliko novca plaćate, da dostavljač ponese tačan kusur.'],
    ['Koliko košta dostava?', `Zavisi od naselja: ${feeText(ctx)}. Tačan iznos vidite u korpi, pre slanja. Za preuzimanje u lokalu nema troška.`],
    ['Mogu li da poručim za kasnije?', `Možete, do ${days} dana unapred, u terminima na svakih pola sata. Termin birate u koraku „Kada?“ — sajt nikad ne nudi termin kada ne radimo.`],
    ['Da li dostavljate do mene?', `Dostavljamo u naselja sa spiska koji vidite u korpi. Ako vašeg naselja nema, izaberite preuzimanje ili pozovite ${b.phone_display}.`],
    ['Kako da izmenim ili otkažem porudžbinu?', `Samo telefonom: pozovite ${b.phone_display} i recite broj porudžbine. Što ranije javite, to je lakše.`],
    ['Mogu li giros bez luka ili bez pomfrita?', 'Naravno. Pri izboru jela isključite šta ne želite — u kuhinji to piše crvenim slovima. Ako poručujete više komada, svaki možete da složite drugačije.'],
    ['Da li postoji minimalna porudžbina?', min ? `Za dostavu je minimum ${min}. Za preuzimanje nema minimuma.` : 'Ne postoji. Poručite i jedan giros.'],
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
  description: 'Dostava girosa po Novom Sadu za 45–60 minuta, preuzimanje za 15–30. Plaćanje gotovinom, zakazivanje do 7 dana unapred. Česta pitanja o dostavi i porudžbinama.',
  bodyClass: 'page-delivery',
  schema: (ctx) => [faq(faqItems(ctx)), breadcrumbs(ctx, [{ name: 'Dostava', path: '/dostava/' }])]
};

export function render(ctx) {
  const a = ctx.assets;
  const b = ctx.business;
  const min = minOrderText(ctx);
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
        <div><dt>Vreme</dt><dd>${esc(b.delivery_eta_min)}–${esc(b.delivery_eta_max)} minuta</dd></div>
        <div><dt>Radno vreme</dt><dd>${esc(ctx.deliveryLine)}</dd></div>
        ${
          zonesOn(ctx)
            ? `<div><dt>Cena po zoni</dt><dd>${ctx.zones.map((z) => `${esc(z.name)} — ${esc(Money.formatRSD(z.fee))}`).join('<br>')}</dd></div>`
            : `<div><dt>Cena</dt><dd>${esc(feeText(ctx))}</dd></div>`
        }
        ${min ? `<div><dt>Minimum</dt><dd>${esc(min)}</dd></div>` : ''}
        <div><dt>Plaćanje</dt><dd>gotovinom dostavljaču — unapred upišete sa koliko plaćate, pa kurir ponese kusur</dd></div>
        <div><dt>Ko dostavlja</dt><dd>partnerska dostavna služba</dd></div>
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
      <h2 class="h2" style="margin-top:0.8rem">Do ${esc(b.preorder_days || 7)} dana unapred.</h2>
    </div>
    <p class="lead">Birate dan i vreme u terminima na svakih pola sata, u okviru radnog vremena. Sajt nikad ne nudi termin u prošlosti, tokom pauze ili kada ne radimo. Lokal potvrđuje svaku porudžbinu u roku od ${esc(b.accept_timeout_min || 5)} minuta.</p>
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
