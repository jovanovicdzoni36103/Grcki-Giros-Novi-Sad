// Početna: hero, promo, kako do girosa, izdvojeno, priča, lokacija, posao, finalni CTA. Sajt ne prima porudžbine.
import { esc, iconSvg, artSvg, artBg, featuredCard, hoursRows, rsd, mapsUrl } from '../../scripts/ui/render.js';
import { restaurant } from '../schema.js';

export const meta = {
  path: '/',
  out: 'index.html',
  script: 'home',
  title: 'Grčki Giros Novi Sad | Pravi grčki giros, Dimitrija Tucovića 3',
  description: 'Grčki Giros u Novom Sadu od 2021: giros sa originalnim grčkim začinima, roštilj i prilozi. Meni sa cenama i lokacija: Dimitrija Tucovića 3, ispod stadiona Karađorđe.',
  bodyClass: 'page-home',
  schema: (ctx) => [restaurant(ctx)]
};

const GREEK_WORD = 'M40 222V18h132M222 18l82 104 82-104M304 122v100M454 222V18h92a56 56 0 0 1 0 112h-92M726 18c50 0 88 46 88 102s-38 102-88 102-88-46-88-102 38-102 88-102ZM990 18H864l72 102-72 102h126';

/** The seal: logo in the middle, the brand line around it. Only the ring turns with the scroll. */
export function stamp(id) {
  return `<div class="stamp" aria-hidden="true">
    <svg class="stamp__ring" viewBox="0 0 200 200" data-spin="0.06"><defs><path id="${id}" d="M100 100m-78 0a78 78 0 1 1 156 0a78 78 0 1 1-156 0"/></defs>
      <circle cx="100" cy="100" r="98" fill="#fff" stroke="#16202E" stroke-width="3"/>
      <text font-family="Archivo, Arial Narrow, sans-serif" font-weight="800" font-size="17" letter-spacing="2.4" fill="#16202E" style="font-stretch:88%;text-transform:uppercase"><textPath href="#${id}" textLength="486" lengthAdjust="spacing">Grčki Giros, Friends &amp; Food • </textPath></text>
    </svg>
    <span class="stamp__core"><img src="/assets/img/logo-112.png" alt="" width="96" height="112"></span>
  </div>`;
}

function bits() {
  const tomato = '<svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="26" fill="#E0452B" stroke="#16202E" stroke-width="4"/><circle cx="30" cy="30" r="15" fill="#F7A48E"/><g fill="#FBE3C8"><ellipse cx="24" cy="26" rx="3" ry="4.5" transform="rotate(-30 24 26)"/><ellipse cx="36" cy="26" rx="3" ry="4.5" transform="rotate(30 36 26)"/><ellipse cx="30" cy="37" rx="3" ry="4.5"/></g></svg>';
  const onion = '<svg viewBox="0 0 60 60"><ellipse cx="30" cy="30" rx="24" ry="20" fill="none" stroke="#16202E" stroke-width="12"/><ellipse cx="30" cy="30" rx="24" ry="20" fill="none" stroke="#8C4A94" stroke-width="6"/></svg>';
  const fry = '<svg viewBox="0 0 30 80"><rect x="6" y="4" width="18" height="72" rx="4" fill="#F7C84A" stroke="#16202E" stroke-width="4"/></svg>';
  const leaf = '<svg viewBox="0 0 60 60"><path d="M8 52C8 24 26 8 52 8c0 26-16 44-44 44Z" fill="#74B04A" stroke="#16202E" stroke-width="4" stroke-linejoin="round"/><path d="M10 50 40 20" stroke="#16202E" stroke-width="3" stroke-linecap="round"/></svg>';
  const chili = '<svg viewBox="0 0 70 40"><path d="M6 22c10-14 34-18 52-8l8-6c2 6-2 10-6 12-8 14-40 18-54 2Z" fill="#D1432B" stroke="#16202E" stroke-width="4" stroke-linejoin="round"/></svg>';
  const b = (svg, style) => `<span class="bit" style="${style}">${svg}</span>`;
  return [
    b(tomato, '--s:17%;left:0;top:30%;--z:110px;--d:.1s'),
    b(onion, '--s:15%;right:2%;top:46%;--z:140px;--d:.5s'),
    b(fry, '--s:7%;left:14%;top:6%;--z:80px;--d:.3s;transform:translateZ(80px) rotate(-24deg)'),
    b(leaf, '--s:11%;right:12%;bottom:14%;--z:160px;--d:.7s'),
    b(chili, '--s:15%;left:4%;bottom:10%;--z:130px;--d:.9s')
  ].join('');
}

export function render(ctx) {
  const a = ctx.assets;
  const b = ctx.business;
  const products = ctx.catalog.products;
  const promo = products.find((p) => p.tags.includes('promo') && p.available !== false);
  const featured = products.filter((p) => p.categoryId === 'giros').sort((x, y) => x.sort - y.sort).slice(0, 4);
  const jobActive = String(b.job_active).toUpperCase() === 'TRUE';

  return `<main id="main">
<section class="hero" aria-labelledby="hero-title">
  <svg class="hero__word" viewBox="0 0 1000 240" aria-hidden="true" data-parallax="0.12"><path d="${GREEK_WORD}" fill="none" stroke="currentColor" stroke-width="30" stroke-linejoin="miter"/></svg>
  <div class="container hero__grid">
    <div class="hero__copy">
      <span class="status-pill hero__status" data-hero-status><span class="status-pill__dot"></span><span data-status-text>${esc(ctx.statusText)}</span></span>
      <p class="kicker">Novi Sad · od 2021.</p>
      <h1 class="display hero__title" id="hero-title" data-split><span class="accent">Pravi Grčki Giros</span></h1>
      <p class="lead">U želji da probate pravi grčki giros: sočno, savršeno začinjeno meso pečeno na tradicionalnom vertikalnom ražnju, umotano u toplu, mekanu grčku pitu sa hrskavim pomfritom, svežim paradajzom, crvenim lukom i domaćim osvežavajućim tzatziki sosom, načinili smo prave korake od 2021. godine.</p>
      <div class="hero__ctas">
        <a class="btn btn--gold btn--lg" href="/meni/" data-magnetic><span class="btn__label">Pogledaj meni</span>${iconSvg(a, 'arrow', 'btn__icon')}</a>
        <a class="link" href="/kontakt/">Kako do nas ${iconSvg(a, 'arrow')}</a>
      </div>
      <ul class="hero__facts" role="list">
        <li>${iconSvg(a, 'scooter')}Dostava ${esc(b.delivery_eta_min)}–${esc(b.delivery_eta_max)} min</li>
        <li>${iconSvg(a, 'store')}Preuzimanje ${esc(b.pickup_eta_min)}–${esc(b.pickup_eta_max)} min</li>
        <li>${iconSvg(a, 'cash')}Plaćanje gotovinom</li>
      </ul>
    </div>
    <div class="hero__visual" data-tilt aria-hidden="true">
      <div class="hero__stage" data-tilt-inner>
        <div class="hero__arch"><div class="hero__sun"></div></div>
        <div class="hero__giros"><svg viewBox="0 0 200 220"><use href="${a.art}#wrap"/></svg></div>
        ${bits()}
        ${stamp('stamp-hero')}
      </div>
    </div>
  </div>
</section>

<div class="band-wrap" aria-hidden="true"><div class="band"><div class="marquee" data-marquee><div class="marquee__track">${['Grčki Giros može!', 'Grčki, ali domaćinski!', 'Friends &amp; Food', 'Od 2021.', 'Ispod stadiona Karađorđe']
    .map((t) => `<span class="marquee__item">${t}<svg aria-hidden="true"><use href="${a.icons}#i-spark"/></svg></span>`)
    .join('')}</div></div></div></div>

${
  promo
    ? `<section class="section section--tight" aria-labelledby="promo-title">
  <div class="container promo">
    <article class="ticket ticket--gold promo__ticket" data-reveal>
      <div>
        <p class="promo__label">Akcija · svaki dan</p>
        <h2 class="promo__title" id="promo-title">${esc(promo.name)}</h2>
        <p style="margin-top:0.8rem;max-width:30ch">${esc(promo.description)}</p>
        <a class="btn btn--sm" style="margin-top:1.2rem" href="/meni/#kat-${esc(promo.categoryId)}"><span class="btn__label">Sve akcije</span>${iconSvg(a, 'arrow', 'btn__icon')}</a>
      </div>
      <div class="promo__price">
        <p class="promo__amount"><strong class="num">${esc(rsd(promo.price).replace(/\s?RSD/, ''))}</strong><span>RSD</span></p>
        ${promo.comparePrice > promo.price ? `<s>umesto ${esc(rsd(promo.comparePrice))}</s><span class="promo__save">Ušteda ${esc(rsd(promo.comparePrice - promo.price))}</span>` : ''}
      </div>
    </article>
    <div class="promo__art" data-reveal style="--i:1"><div class="art-frame" style="--art-bg:${artBg(promo)}">${artSvg(a, promo)}</div></div>
  </div>
</section>`
    : ''
}

<section class="section steps" data-steps aria-labelledby="steps-title">
  <div class="steps__sticky">
    <div class="container steps__grid">
      <div class="steps__list">
        <p class="kicker">Kako do girosa</p>
        <h2 class="h2" id="steps-title" data-split style="margin-top:0.8rem">Tri koraka do girosa.</h2>
        <ol role="list">
          <li class="step is-active" data-step data-reveal><span class="step__n">01</span><h3>Izaberite giros</h3><p>Pileće, svinjsko ili mix meso, pa premazi, salate i začini po vašem ukusu, bez doplate.</p></li>
          <li class="step" data-step data-reveal style="--i:1"><span class="step__n">02</span><h3>Svratite ili pozovite</h3><p>Dođite u ${esc(b.address_street)} ili pozovite <a href="tel:${esc(b.phone_e164)}" data-track="home-steps">${esc(b.phone_display)}</a>.</p></li>
          <li class="step" data-step data-reveal style="--i:2"><span class="step__n">03</span><h3>Preuzmite i platite</h3><p>Preuzimanje je gotovo za ${esc(b.pickup_eta_min)} do ${esc(b.pickup_eta_max)} minuta. Plaćate gotovinom.</p></li>
        </ol>
      </div>
      <div class="steps__art" aria-hidden="true">
        <div class="steps__progress"></div>
        <div class="steps__frame">
          <div data-step-art class="is-active"><svg class="art" viewBox="0 0 200 220"><use href="${a.art}#wrap"/></svg></div>
          <div data-step-art><div class="step-scene"><div class="step-scene__modes"><span class="step-scene__mode">${iconSvg(a, 'store')}Lokal</span><span class="step-scene__mode">${iconSvg(a, 'phone')}Telefon</span></div></div></div>
          <div data-step-art><div class="step-scene"><div class="ticket"><p class="ticket__label">Preuzimanje, minuta</p><p class="ticket__number" style="font-size:clamp(4rem, 9vw, 6.5rem)">${esc(b.pickup_eta_min)}–${esc(b.pickup_eta_max)}</p></div></div></div>
        </div>
        <div class="steps__num"><span><em>01</em><em>02</em><em>03</em></span></div>
      </div>
    </div>
  </div>
</section>

<section class="section" aria-labelledby="featured-title">
  <div class="container">
    <div class="section__head section__head--split">
      <div><p class="kicker">Najviše se uzima</p><h2 class="h2" id="featured-title" data-split style="margin-top:0.8rem">Veliki, mali, porcija ili vege.</h2></div>
      <p class="lead">Pileće, svinjsko ili mix meso u grčkoj piti, sa pomfritom unutra. Premaze, salate i začine birate sami, bez doplate.</p>
    </div>
    <div class="features">${featured.map((p, i) => featuredCard(a, p, i)).join('')}</div>
    <p style="margin-top:2rem"><a class="btn btn--ghost" href="/meni/"><span class="btn__label">Ceo meni</span>${iconSvg(a, 'arrow', 'btn__icon')}</a></p>
  </div>
</section>

<section class="section section--blue on-blue" aria-labelledby="story-title">
  <div class="container story">
    <div>
      <p class="kicker" style="color:var(--gold)">Zašto baš Atina</p>
      <h2 class="h2" id="story-title" data-split style="margin-top:0.8rem">Od 2021. radimo jednu stvar.</h2>
      <p style="margin-top:1.4rem">Giros kakav se jede u Atini: originalni grčki začini, grčka pita i premazi po receptima grčkih kuvara. Godinama držimo isti kvalitet i isti ukus, a na meso i povrće posebno pazimo.</p>
      <div class="route" aria-label="Grčki začini i recept, giros u Novom Sadu">
        <span>Grčka<small>začini i recept</small></span><span class="route__line"><span>od 2021.</span></span><span>Novi Sad<small>vaš giros</small></span>
      </div>
      <p style="margin-top:2rem"><a class="btn btn--ghost" href="/o-nama/"><span class="btn__label">Naša priča</span>${iconSvg(a, 'arrow', 'btn__icon')}</a></p>
    </div>
    <div class="story__art" data-reveal>
      <div class="art-frame art-live" style="--art-bg:#F2EBDD"><svg class="art" viewBox="0 0 200 220" role="img" aria-label="Giros na ražnju"><use href="${a.art}#raznj"/></svg></div>
      ${stamp('stamp-story')}
    </div>
  </div>
</section>

<section class="section" aria-labelledby="visit-title">
  <div class="container visit">
    <div>
      <p class="kicker">Lokacija</p>
      <h2 class="visit__address" id="visit-title" style="margin-top:0.8rem">${esc(b.address_street)}<small>${esc(b.address_city)}${b.address_note ? ' · ' + esc(b.address_note) : ''} · preuzimanje i sedenje u lokalu</small></h2>
      <div class="cluster" style="margin-top:2rem">
        <a class="btn btn--blue" href="${esc(mapsUrl(b))}" target="_blank" rel="noopener"><span class="btn__label">Otvori u mapama</span>${iconSvg(a, 'map', 'btn__icon')}</a>
        <a class="link" href="/kontakt/">Kontakt ${iconSvg(a, 'arrow')}</a>
      </div>
    </div>
    <div class="visit__card" data-reveal>
      <a class="phone-big" href="tel:${esc(b.phone_e164)}" data-track="home-visit">${iconSvg(a, 'phone')}${esc(b.phone_display)}</a>
      <dl class="hours-list" data-hours data-hours-delivery>${hoursRows(ctx.weekly, { deliveryColumn: true })}</dl>
      <p class="small muted">Nedeljom ne radimo.${b.hours_note ? ' ' + esc(b.hours_note) : ''}</p>
    </div>
  </div>
</section>

${
  jobActive
    ? `<section class="section section--tight" aria-labelledby="job-title">
  <div class="container"><div class="job-strip" data-reveal>
    <p class="job-strip__tag" id="job-title">Tražimo<br>ekipu</p>
    <p>Tražimo prodavca-kuvara. Dve smene, pravi giros od mesa do pite. Nema čudnih zahteva, ima dobre atmosfere.</p>
    <a class="btn btn--blue" href="/posao/"><span class="btn__label">Pogledaj oglas</span>${iconSvg(a, 'arrow', 'btn__icon')}</a>
  </div></div>
</section>`
    : ''
}

<section class="section" aria-labelledby="final-title">
  <div class="container final">
    <h2 class="final__title" id="final-title" data-split>Gladni?</h2>
    <p class="lead" style="text-align:center">Dođite u ${esc(b.address_street)} i probajte giros pripremljen sa istom pažnjom svaki put.</p>
    <a class="btn btn--gold btn--lg" href="/meni/" data-magnetic><span class="btn__label">Pogledaj meni</span>${iconSvg(a, 'arrow', 'btn__icon')}</a>
    <p class="final__meta">${esc(ctx.hoursLine)} · Nedeljom ne radimo · <a href="tel:${esc(b.phone_e164)}" data-track="home-final">${esc(b.phone_display)}</a></p>
  </div>
</section>
</main>`;
}
