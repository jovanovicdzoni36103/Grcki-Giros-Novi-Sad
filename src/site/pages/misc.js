// Privatnost, 404.
import { esc, iconSvg } from '../../scripts/ui/render.js';

export const privacy = {
  meta: {
    path: '/privatnost/',
    out: 'privatnost/index.html',
    script: 'basic',
    title: 'Privatnost | Grčki Giros',
    description: 'Kako Grčki Giros koristi podatke iz prijava za posao: šta dobijamo, zašto, gde se čuva i koja su vaša prava.',
    bodyClass: 'page-legal',
    schema: () => []
  },
  render(ctx) {
    const b = ctx.business;
    return `<main id="main">
<section class="page-hero"><div class="container"><p class="kicker">Privatnost</p><h1 class="h1" style="margin-top:0.8rem">Vaši podaci.</h1></div></section>
<section class="section section--tight"><div class="container prose">
  <p>Ovaj sajt vodi ${esc(b.business_name)}, ${esc(b.address_street)}, ${esc(b.address_city)}. Kontakt: <a href="tel:${esc(b.phone_e164)}">${esc(b.phone_display)}</a>${b.email_public ? `, <a href="mailto:${esc(b.email_public)}">${esc(b.email_public)}</a>` : ''}.</p>
  <h2>Šta prikupljamo</h2>
  <p>Jedina forma na sajtu je prijava za posao. Iz nje dobijamo samo ono što sami upišete: ime i prezime, email, telefon, poziciju, poruku i CV, ako ga priložite. Nijedno polje nije obavezno.</p>
  <h2>Zašto</h2>
  <p>Da bismo pročitali prijavu i javili se kandidatu. Podatke ne prodajemo i ne koristimo za reklame.</p>
  <h2>Gde se čuvaju</h2>
  <p>Prijava stiže na email lokala i čuva se u Google tabeli lokala, a CV u Google Drive-u lokala. Pristup ima samo vlasnik. Podaci se čuvaju onoliko koliko je potrebno za izbor kandidata.</p>
  <h2>Na vašem uređaju</h2>
  <p>Pregledač pamti meni i radno vreme, da bi se stranice brže otvarale. Lične podatke sajt na vašem uređaju ne čuva.</p>
  <h2>Vaša prava</h2>
  <p>Možete da tražite uvid, ispravku ili brisanje svojih podataka. Pozovite nas ili pišite na gore navedeni kontakt.</p>
</div></section>
</main>`;
  }
};

export const notFound = {
  meta: {
    path: '/404.html',
    out: '404.html',
    script: 'basic',
    title: 'Stranica nije pronađena | Grčki Giros',
    description: 'Ova stranica ne postoji.',
    bodyClass: 'page-404',
    noindex: true,
    schema: () => []
  },
  render(ctx) {
    const a = ctx.assets;
    return `<main id="main" class="container not-found">
  <svg class="art" viewBox="0 0 200 220" aria-hidden="true"><use href="${a.art}#bag"/></svg>
  <p class="kicker">Greška 404</p>
  <h1 class="h1">Ova stranica je pojedena.</h1>
  <p class="lead">Ništa strašno, meni je i dalje tu.</p>
  <div class="cluster" style="justify-content:center"><a class="btn btn--gold" href="/meni/"><span class="btn__label">Pogledaj meni</span>${iconSvg(a, 'arrow', 'btn__icon')}</a><a class="link" href="/">Početna</a></div>
</main>`;
  }
};
