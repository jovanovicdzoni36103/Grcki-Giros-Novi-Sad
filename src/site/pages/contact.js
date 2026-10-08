// Lokacija i kontakt: adresa, mapa na zahtev, radno vreme, telefon, email. Bez forme (jedina forma je prijava za posao).
import { esc, iconSvg, hoursRows, mapsUrl } from '../../scripts/ui/render.js';
import { restaurant, breadcrumbs } from '../schema.js';

export const meta = {
  path: '/kontakt/',
  out: 'kontakt/index.html',
  script: 'contact',
  title: 'Lokacija i kontakt | Grčki Giros, Dimitrija Tucovića 3, Novi Sad',
  description: 'Grčki Giros, Dimitrija Tucovića 3, ispod stadiona Karađorđe, Novi Sad. Radno vreme pon–sub 09–01, nedeljom ne radimo. Telefon 064 227 4334.',
  bodyClass: 'page-contact',
  schema: (ctx) => [restaurant(ctx), breadcrumbs(ctx, [{ name: 'Kontakt', path: '/kontakt/' }])]
};

export function render(ctx) {
  const a = ctx.assets;
  const b = ctx.business;
  return `<main id="main">
<section class="page-hero">
  <div class="container page-hero__grid">
    <div>
      <p class="kicker">Lokacija i kontakt</p>
      <h1 class="h1" style="margin-top:0.8rem" data-split>${esc(b.address_street)} <span>${esc(b.address_city)}</span></h1>
    </div>
    <p class="lead">Preuzimanje, sedenje u lokalu i porudžbine telefonom.</p>
  </div>
</section>

<section class="section section--tight">
  <div class="container visit">
    <div class="map-box" data-map data-query="${esc(b.map_query || '')}">
      <img class="map-box__photo" src="/assets/img/lokal.webp" alt="Izlog lokala ${esc(b.business_name)}, ${esc(b.address_street)}" width="736" height="552" loading="lazy" decoding="async">
      <div class="map-box__fallback">
        <p><strong>${esc(b.business_name)}</strong><br>${esc(b.address_street)}, ${esc(b.postal_code)} ${esc(b.address_city)}${b.address_note ? `<br>${esc(b.address_note)}` : ''}</p>
        <div class="cluster" style="justify-content:center">
          <button type="button" class="btn btn--blue btn--sm" data-load-map><span class="btn__label">Prikaži mapu</span></button>
          <a class="btn btn--ghost btn--sm" href="${esc(mapsUrl(b))}" target="_blank" rel="noopener"><span class="btn__label">Google Maps</span></a>
        </div>
        <p class="small muted">Mapa se učitava tek na vaš zahtev (Google).</p>
      </div>
    </div>
    <div class="visit__card">
      <a class="phone-big" href="tel:${esc(b.phone_e164)}" data-track="contact">${iconSvg(a, 'phone')}${esc(b.phone_display)}</a>
      <dl class="hours-list" data-hours data-hours-delivery>${hoursRows(ctx.weekly, { deliveryColumn: true })}</dl>
      ${b.hours_note ? `<p class="small muted" style="margin-top:0.6rem">${esc(b.hours_note)}</p>` : ''}
      <dl class="facts">
        ${b.email_public ? `<div><dt>Email</dt><dd><a href="mailto:${esc(b.email_public)}">${esc(b.email_public)}</a></dd></div>` : ''}
        ${b.instagram_url ? `<div><dt>Instagram</dt><dd><a href="${esc(b.instagram_url)}" target="_blank" rel="noopener">@${esc(b.instagram_url.replace(/\/$/, '').split('/').pop())}</a></dd></div>` : ''}
        <div><dt>Plaćanje</dt><dd>gotovina</dd></div>
        ${b.second_location ? `<div><dt>Drugi lokal</dt><dd>${esc(b.second_location)}</dd></div>` : ''}
      </dl>
    </div>
  </div>
</section>

</main>`;
}
