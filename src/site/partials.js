// Build-time partials: header, mobile navigation, footer, order bar.
import { esc, iconSvg, hoursRows } from '../scripts/ui/render.js';

export const NAV = [
  { href: '/meni/', label: 'Meni', note: 'poruči' },
  { href: '/o-nama/', label: 'O nama', note: 'od 2021.' },
  { href: '/dostava/', label: 'Dostava', note: 'i preuzimanje' },
  { href: '/kontakt/', label: 'Kontakt', note: 'lokacija' },
  { href: '/posao/', label: 'Posao', note: 'tražimo' }
];

export function brand(ctx, { tag = 'a' } = {}) {
  const inner = `<img class="brand__mark" src="/assets/img/logo-112.png" alt="" width="48" height="56"><span class="brand__word">Grčki Giros<small>Novi Sad · 2021</small></span>`;
  return tag === 'a' ? `<a class="brand" href="/" aria-label="Grčki Giros — početna">${inner}</a>` : `<span class="brand">${inner}</span>`;
}

export function header(ctx) {
  const a = ctx.assets;
  return `<a class="skip-link" href="#main">Preskoči na sadržaj</a>
<header class="site-header" data-header>
  <div class="container site-header__inner">
    ${brand(ctx)}
    <nav class="site-nav" aria-label="Glavna navigacija">
      <ul role="list">${NAV.map((n) => `<li><a href="${n.href}" data-nav-link>${n.label}</a></li>`).join('')}</ul>
    </nav>
    <div class="site-header__actions">
      <span class="status-pill" data-status-pill><span class="status-pill__dot"></span><span data-status-text>${esc(ctx.statusText)}</span></span>
      <a class="btn btn--gold btn--sm header-cta" href="/meni/" data-magnetic="6"><span class="btn__label">Naruči</span>${iconSvg(a, 'arrow', 'btn__icon')}</a>
      <button type="button" class="cart-button" data-cart-open aria-label="Korpa je prazna">${iconSvg(a, 'bag')}<span class="cart-button__count" data-cart-count>0</span></button>
      <button type="button" class="nav-toggle" data-nav-toggle aria-expanded="false" aria-controls="mobile-nav" aria-label="Otvori meni"><span></span><span></span></button>
    </div>
  </div>
</header>
<div class="mobile-nav on-blue" id="mobile-nav" data-mobile-nav hidden role="dialog" aria-modal="true" aria-label="Navigacija">
  <ul role="list">
    <li><a class="mobile-nav__link" href="/">Početna</a></li>
    ${NAV.map((n) => `<li><a class="mobile-nav__link" href="${n.href}">${n.label}<small>${n.note}</small></a></li>`).join('')}
  </ul>
  <div class="mobile-nav__meta">
    <a href="tel:${esc(ctx.business.phone_e164)}" data-track="mobile-nav">${esc(ctx.business.phone_display)}</a>
    <span>${esc(ctx.business.address_street)}, ${esc(ctx.business.address_city)}</span>
    <span>${esc(ctx.hoursLine)}</span>
  </div>
</div>`;
}

export function orderBar() {
  return `<div class="order-bar" data-order-bar data-menu-href="/meni/"><a class="order-bar__cta" href="/meni/" data-order-bar-link><span class="order-bar__label">Naruči online<span class="order-bar__meta">Pravi grčki giros</span></span></a></div>`;
}

export function footer(ctx) {
  const b = ctx.business;
  const a = ctx.assets;
  return `<footer class="site-footer on-blue">
  <div class="container">
    <div class="footer-grid">
      <div>
        <p class="footer-lead">Grčki, ali domaćinski. Pita stiže iz Atine.</p>
        <a class="footer-phone" href="tel:${esc(b.phone_e164)}" data-track="footer">${esc(b.phone_display)}</a>
        <p style="margin-top:0.4rem">Porudžbine telefonom i online</p>
      </div>
      <div>
        <h2>Lokal</h2>
        <p>${esc(b.address_street)}${b.address_note ? ` <span class="small">(${esc(b.address_note)})</span>` : ''}<br>${esc(b.postal_code)} ${esc(b.address_city)}</p>
        <p style="margin-top:0.8rem"><a class="social" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.map_query || b.address_street + ', ' + b.address_city)}" target="_blank" rel="noopener">${iconSvg(a, 'map')}Otvori u mapama</a></p>
        ${b.instagram_url ? `<p style="margin-top:0.4rem"><a class="social" href="${esc(b.instagram_url)}" target="_blank" rel="noopener">${iconSvg(a, 'instagram')}Instagram</a></p>` : ''}
      </div>
      <div>
        <h2>Radno vreme</h2>
        <dl class="hours-list" data-hours>${hoursRows(ctx.weekly)}</dl>
        <p class="small" style="margin-top:0.6rem">Dostava ${esc(ctx.deliveryLine)}</p>
        ${b.hours_note ? `<p class="small" style="margin-top:0.4rem">${esc(b.hours_note)}</p>` : ''}
      </div>
      <div>
        <h2>Sajt</h2>
        <ul role="list">
          <li><a href="/meni/">Meni i poručivanje</a></li>
          <li><a href="/dostava/">Dostava i česta pitanja</a></li>
          <li><a href="/o-nama/">O nama</a></li>
          <li><a href="/kontakt/">Kontakt</a></li>
          <li><a href="/posao/">Posao</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-wordmark" aria-hidden="true">Grčki Giros</div>
  </div>
  <div class="footer-bottom container">
    <span>© ${ctx.year} ${esc(b.business_name)} · ${esc(b.address_city)}</span>
    <span>Cene su u dinarima, sa PDV-om · Plaćanje gotovinom</span>
    <a href="/privatnost/">Privatnost</a>
  </div>
</footer>`;
}
