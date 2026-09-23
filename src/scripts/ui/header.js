// Header behavior, mobile navigation, open/closed pill, cart badge and the mobile order bar.
import { $, $$, on, icon, esc } from '../core/dom.js';
import { subscribe } from '../core/events.js';
import { statusLine } from '../core/availability.js';
import Money from '../shared/money.cjs';
import * as overlay from './overlay.js';

export function initHeader() {
  const header = $('[data-header]');
  if (!header) return;
  const autoHide = !document.body.hasAttribute('data-header-fixed');
  let lastY = window.scrollY;
  let ticking = false;
  const update = () => {
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 8);
    if (autoHide && !document.body.classList.contains('nav-open')) {
      const goingDown = y > lastY + 4;
      const goingUp = y < lastY - 4;
      if (goingDown && y > 240) header.classList.add('is-hidden');
      else if (goingUp || y < 120) header.classList.remove('is-hidden');
    }
    lastY = y;
    ticking = false;
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true }
  );
  update();

  // Current page in the navigation.
  const path = location.pathname.replace(/index\.html$/, '');
  $$('[data-nav-link]').forEach((a) => {
    const href = a.getAttribute('href');
    if (href !== '/' && path.startsWith(href)) a.setAttribute('aria-current', 'page');
  });

  // Mobile navigation.
  const toggle = $('[data-nav-toggle]');
  const nav = $('[data-mobile-nav]');
  if (toggle && nav) {
    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Zatvori meni' : 'Otvori meni');
      document.body.classList.toggle('nav-open', open);
      header.classList.remove('is-hidden');
    };
    on(toggle, 'click', () => {
      if (overlay.isOpen(nav)) overlay.close(nav);
      else {
        setOpen(true);
        overlay.open(nav, { focus: 'a', onClose: () => setOpen(false) });
      }
    });
    on(nav, 'click', 'a', () => overlay.close(nav));
  }

  subscribe('availability', (snap) => {
    const s = statusLine(snap);
    $$('[data-status-pill]').forEach((pill) => {
      pill.classList.toggle('is-open', s.open);
      pill.classList.toggle('is-closed', !s.open);
      const t = pill.querySelector('[data-status-text]');
      if (t) t.textContent = s.text;
    });
  });

  subscribe('cart', (view) => {
    const count = view.itemCount || 0;
    $$('[data-cart-open]').forEach((btn) => {
      btn.classList.toggle('has-items', count > 0);
      btn.setAttribute('aria-label', count ? `Korpa, ${count} ${count === 1 ? 'artikal' : 'artikla'}, ${Money.formatRSD(view.total || 0)}` : 'Korpa je prazna');
      const c = btn.querySelector('[data-cart-count]');
      if (c) c.textContent = String(count);
    });
  });
}

export function bumpCart() {
  $$('[data-cart-open]').forEach((btn) => {
    btn.classList.remove('bump');
    void btn.offsetWidth;
    btn.classList.add('bump');
  });
}

/** Mobile bottom bar: "Naruči online" when the cart is empty, the cart total when it is not. */
export function initOrderBar({ onOpenCart }) {
  const bar = $('[data-order-bar]');
  if (!bar) return;
  document.body.classList.add('has-order-bar');
  const link = bar.querySelector('[data-order-bar-link]');
  let lastSnap = null;
  let lastView = null;
  const render = () => {
    const view = lastView;
    const snap = lastSnap;
    const count = view ? view.itemCount : 0;
    if (count > 0) {
      link.classList.add('is-cart');
      link.setAttribute('href', '#korpa');
      link.innerHTML = `<span class="order-bar__label">Korpa · ${count} ${count === 1 ? 'artikal' : 'artikla'}<span class="order-bar__meta">Pregled i poručivanje</span></span><span class="order-bar__total num">${esc(
        Money.formatRSD(view.total || view.subtotal || 0)
      )}${icon('arrow')}</span>`;
    } else {
      link.classList.remove('is-cart');
      link.setAttribute('href', bar.dataset.menuHref || '/meni/');
      const meta = snap ? (snap.open ? `Dostava ~${snap.delivery.asap.etaMin} min · preuzimanje ~${snap.pickup.asap.etaMin} min` : statusLine(snap).text) : 'Pravi grčki giros';
      link.innerHTML = `<span class="order-bar__label">${snap && !snap.open ? 'Pogledaj meni' : 'Naruči online'}<span class="order-bar__meta">${esc(meta)}</span></span><span class="order-bar__total">${icon('arrow')}</span>`;
    }
  };
  on(link, 'click', (e) => {
    if (lastView && lastView.itemCount > 0) {
      e.preventDefault();
      onOpenCart();
    }
  });
  subscribe('cart', (v) => {
    lastView = v;
    render();
  });
  subscribe('availability', (s) => {
    lastSnap = s;
    render();
  });
  render();
}
