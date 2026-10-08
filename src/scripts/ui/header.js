// Header behavior, mobile navigation and the open/closed pill.
import { $, $$, on } from '../core/dom.js';
import { subscribe } from '../core/events.js';
import { statusLine } from '../core/availability.js';
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
}
