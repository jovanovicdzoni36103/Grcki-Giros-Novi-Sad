// Analytics hooks (PDF: GA4 events — order completed, phone click). Inactive until a GA4 id is configured
// in site.config.json AND the visitor accepts; without that nothing is loaded and nothing leaves the browser.
import { env } from './dom.js';
import { local } from './storage.js';

const CONSENT_KEY = 'gg:consent:v1';
let ready = false;

export function track(name, params = {}) {
  if (!ready || typeof window.gtag !== 'function') return;
  window.gtag('event', name, params);
}

function load(id) {
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', id, { anonymize_ip: true });
  ready = true;
}

export function initAnalytics() {
  const id = env().gaId;
  if (!id) return;
  const consent = local.get(CONSENT_KEY);
  if (consent === 'yes') load(id);
  if (consent) return;
  const bar = document.createElement('div');
  bar.className = 'consent';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Kolačići');
  bar.innerHTML = `<p>Koristimo analitiku da vidimo šta na sajtu radi, a šta ne. Bez reklama.</p><div class="cluster"><button type="button" class="btn btn--sm btn--gold" data-yes><span class="btn__label">U redu</span></button><button type="button" class="btn btn--sm btn--ghost" data-no><span class="btn__label">Ne, hvala</span></button></div>`;
  document.body.appendChild(bar);
  bar.addEventListener('click', (e) => {
    if (e.target.closest('[data-yes]')) {
      local.set(CONSENT_KEY, 'yes');
      load(id);
      bar.remove();
    } else if (e.target.closest('[data-no]')) {
      local.set(CONSENT_KEY, 'no');
      bar.remove();
    }
  });
}

/** Phone and map clicks are conversion signals (PDF: "klik na telefon event"). */
export function trackLinks() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (href.startsWith('tel:')) track('click_phone', { location: a.dataset.track || 'page' });
    else if (/google\.[a-z.]+\/maps|maps\.app/.test(href)) track('click_maps', {});
  });
}
