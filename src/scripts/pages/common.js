// Boot sequence shared by every public page.
import { on } from '../core/dom.js';
import { loadCatalog } from '../core/catalog.js';
import { startAvailability } from '../core/availability.js';
import { initAnalytics, trackLinks } from '../core/analytics.js';
import { initHeader, initOrderBar } from '../ui/header.js';
import { initCartDrawer, openCart } from '../ui/cart-drawer.js';
import { addOrOpen, openProduct } from '../ui/product-sheet.js';
import { initMotion } from '../ui/motion.js';
import { emit } from '../core/events.js';
import * as cart from '../core/cart.js';

export async function bootCommon() {
  window.GG_READY = true;
  initMotion();
  initHeader();
  initCartDrawer();
  if (!document.body.hasAttribute('data-no-order-bar')) initOrderBar({ onOpenCart: openCart });
  initAnalytics();
  trackLinks();

  // Any [data-open-product] or [data-add] anywhere on any page opens the product / adds to cart.
  on(document, 'click', '[data-open-product]', (e, el) => {
    e.preventDefault();
    openProduct(el.dataset.openProduct, { fromEl: el.closest('[data-product]') || el });
  });
  on(document, 'click', '[data-add]', (e, el) => {
    e.preventDefault();
    addOrOpen(el.dataset.add, el);
  });

  await loadCatalog();
  startAvailability();
  emit('cart', cart.view());

  // Deep link: /meni/?p=klasik opens the product (Instagram "Naruči ovo" links).
  const p = new URLSearchParams(location.search).get('p');
  if (p) openProduct(p);
}
