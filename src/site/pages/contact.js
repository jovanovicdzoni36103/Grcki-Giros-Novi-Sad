// Lokacija i kontakt — jedan lokal: adresa, mapa na zahtev, radno vreme, telefon, forma.
import { esc, iconSvg, hoursRows } from '../../scripts/ui/render.js';
import { restaurant, breadcrumbs } from '../schema.js';

export const meta = {
  path: '/kontakt/',
  out: 'kontakt/index.html',
  script: 'contact',
  title: 'Lokacija i kontakt | Grčki Giros, Dimitrija Tucovića 3, Novi Sad',
  description: 'Grčki Giros, Dimitrija Tucovića 3, Novi Sad. Radno vreme pon–sub 09–01, nedeljom ne radimo. Telefon 064 227 4334. Mapa i kontakt forma.',
  bodyClass: 'page-contact',
  schema: (ctx) => [restaurant(ctx), breadcrumbs(ctx, [{ name: 'Kontakt', path: '/kontakt/' }])]
};

function field(name, label, { type = 'text', autocomplete = '', inputmode = '', optional = false, textarea = false, placeholder = '' } = {}) {
  const id = `c-${name}`;
  const control = textarea
    ? `<textarea class="input" id="${id}" name="${name}" rows="5" maxlength="2000" placeholder="${esc(placeholder)}" aria-describedby="${id}-err"></textarea>`
    : `<input class="input" id="${id}" name="${name}" type="${type}" ${autocomplete ? `autocomplete="${autocomplete}"` : ''} ${inputmode ? `inputmode="${inputmode}"` : ''} placeholder="${esc(placeholder)}" aria-describedby="${id}-err">`;
  return `<div class="field" data-field="${name}"><label class="field__label" for="${id}">${label}${optional ? '<span class="optional">opciono</span>' : ''}</label>${control}<p class="field__error" id="${id}-err" role="alert"></p></div>`;
}

export function render(ctx) {
  const a = ctx.assets;
  const b = ctx.business;
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.map_query || b.address_street)}`;
  return `<main id="main">
<section class="page-hero">
  <div class="container page-hero__grid">
    <div>
      <p class="kicker">Lokacija i kontakt</p>
      <h1 class="h1" style="margin-top:0.8rem" data-split>${esc(b.address_street)} <span>${esc(b.address_city)}</span></h1>
    </div>
    <p class="lead">Preuzimanje, sedenje u lokalu i porudžbine telefonom. Za dostavu je najbrže online.</p>
  </div>
</section>

<section class="section section--tight">
  <div class="container visit">
    <div class="map-box" data-map data-query="${esc(b.map_query || '')}">
      <div class="map-box__fallback">
        <span class="map-box__pin">${iconSvg(a, 'store')}</span>
        <p><strong>${esc(b.business_name)}</strong><br>${esc(b.address_street)}, ${esc(b.postal_code)} ${esc(b.address_city)}</p>
        <div class="cluster" style="justify-content:center">
          <button type="button" class="btn btn--blue btn--sm" data-load-map><span class="btn__label">Prikaži mapu</span></button>
          <a class="btn btn--ghost btn--sm" href="${maps}" target="_blank" rel="noopener"><span class="btn__label">Google Maps</span></a>
        </div>
        <p class="small muted">Mapa se učitava tek na vaš zahtev (Google).</p>
      </div>
    </div>
    <div class="visit__card">
      <a class="phone-big" href="tel:${esc(b.phone_e164)}" data-track="contact">${iconSvg(a, 'phone')}${esc(b.phone_display)}</a>
      <dl class="hours-list" data-hours data-hours-delivery>${hoursRows(ctx.weekly, { deliveryColumn: true })}</dl>
      <dl class="facts">
        ${b.email_public ? `<div><dt>Email</dt><dd><a href="mailto:${esc(b.email_public)}">${esc(b.email_public)}</a></dd></div>` : ''}
        ${b.instagram_url ? `<div><dt>Instagram</dt><dd><a href="${esc(b.instagram_url)}" target="_blank" rel="noopener">@${esc(b.instagram_url.replace(/\/$/, '').split('/').pop())}</a></dd></div>` : ''}
        <div><dt>Plaćanje</dt><dd>gotovina</dd></div>
      </dl>
    </div>
  </div>
</section>

<section class="section" aria-labelledby="form-title">
  <div class="container split-2" style="align-items:start">
    <div>
      <p class="kicker">Pišite nam</p>
      <h2 class="h2" id="form-title" style="margin-top:0.8rem" data-split>Pitanje, pohvala, saradnja.</h2>
      <p class="lead" style="margin-top:1rem">Za porudžbine ne koristite formu — poručite online ili pozovite ${esc(b.phone_display)}.</p>
    </div>
    <form class="form-card" data-contact-form novalidate>
      ${field('name', 'Ime i prezime', { autocomplete: 'name' })}
      <div class="field-row" style="grid-template-columns:1fr 1fr">
        ${field('phone', 'Telefon', { type: 'tel', autocomplete: 'tel', inputmode: 'tel', optional: true })}
        ${field('email', 'Email', { type: 'email', autocomplete: 'email', inputmode: 'email', optional: true })}
      </div>
      <div class="field" data-field="topic"><label class="field__label" for="c-topic">Tema<span class="optional">opciono</span></label>
        <select class="input" id="c-topic" name="topic"><option value="">Izaberite</option><option>Pitanje</option><option>Pohvala</option><option>Primedba</option><option>Saradnja</option><option>Ostalo</option></select></div>
      ${field('message', 'Poruka', { textarea: true })}
      <div class="hp" aria-hidden="true"><label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
      <p class="notice" data-form-status hidden></p>
      <button type="submit" class="btn btn--gold btn--lg"><span class="btn__label">Pošalji poruku</span>${iconSvg(a, 'arrow', 'btn__icon')}</button>
      <p class="small muted">Odgovaramo telefonom ili emailom. <a href="/privatnost/">Privatnost</a>.</p>
    </form>
  </div>
</section>
</main>`;
}
