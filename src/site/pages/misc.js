// Privatnost, 404, panel.
import { esc, iconSvg } from '../../scripts/ui/render.js';

export const privacy = {
  meta: {
    path: '/privatnost/',
    out: 'privatnost/index.html',
    script: 'basic',
    title: 'Privatnost | Grčki Giros',
    description: 'Kako Grčki Giros koristi podatke iz porudžbina, kontakt forme i prijava za posao.',
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
  <ul>
    <li><strong>Porudžbina:</strong> ime, broj telefona, email (ako ga unesete), adresa za dostavu, sadržaj porudžbine, napomena i iznos gotovine.</li>
    <li><strong>Kontakt forma:</strong> ime, telefon ili email i poruka.</li>
    <li><strong>Prijava za posao:</strong> ime, telefon, email, iskustvo, poruka i CV ako ga pošaljete.</li>
  </ul>
  <h2>Zašto</h2>
  <p>Da bismo pripremili i isporučili porudžbinu, javili se ako nešto nije jasno, odgovorili na poruku ili pozvali kandidata. Zbirne brojke (broj porudžbina, najtraženija jela) koristimo da bismo bolje planirali rad. Podatke ne prodajemo i ne koristimo za reklame.</p>
  <h2>Gde se čuvaju</h2>
  <p>U Google tabeli i Google nalogu lokala, kojima pristupa samo vlasnik. Adresu i telefon za dostavu vidi i dostavljač. Podaci se čuvaju onoliko koliko je potrebno za porudžbinu i poslovnu evidenciju.</p>
  <h2>Na vašem uređaju</h2>
  <p>Sajt pamti korpu i, ako to označite, vaše podatke za sledeću porudžbinu — samo u pregledaču na vašem uređaju. Brišete ih brisanjem podataka sajta u pregledaču.</p>
  <h2>Vaša prava</h2>
  <p>Možete da tražite uvid, ispravku ili brisanje svojih podataka — pozovite nas ili pišite na gore navedeni kontakt.</p>
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
  <p class="lead">Ništa strašno — meni je i dalje tu.</p>
  <div class="cluster" style="justify-content:center"><a class="btn btn--gold" href="/meni/"><span class="btn__label">Pogledaj meni</span>${iconSvg(a, 'arrow', 'btn__icon')}</a><a class="link" href="/">Početna</a></div>
</main>`;
  }
};

export const admin = {
  meta: {
    path: '/admin/',
    out: 'admin/index.html',
    script: 'admin',
    css: 'admin',
    title: 'Admin — Grčki Giros',
    description: 'Admin panel lokala.',
    bodyClass: 'page-panel page-admin',
    noindex: true,
    chrome: false,
    noOrderBar: true,
    schema: () => []
  },
  render() {
    return `<div data-admin><p style="padding:2rem">Učitavanje admin panela…</p><noscript><p style="padding:2rem">Admin panel zahteva JavaScript.</p></noscript></div>`;
  }
};

/** The old tablet address keeps working: /panel/ → /admin/. */
export const panelRedirect = {
  meta: {
    path: '/panel/',
    out: 'panel/index.html',
    script: 'basic',
    title: 'Admin — Grčki Giros',
    description: 'Admin panel je preseljen na /admin/.',
    bodyClass: 'page-panel',
    noindex: true,
    chrome: false,
    noOrderBar: true,
    headExtra: '<meta http-equiv="refresh" content="0; url=/admin/">',
    schema: () => []
  },
  render() {
    return `<main id="main" style="padding:2rem"><p>Admin panel je preseljen: <a href="/admin/">/admin/</a></p><script>location.replace('/admin/' + location.hash)</script></main>`;
  }
};
