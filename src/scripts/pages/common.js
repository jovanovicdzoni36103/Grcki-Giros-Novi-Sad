// Boot sequence shared by every public page.
import { loadCatalog } from '../core/catalog.js';
import { startAvailability } from '../core/availability.js';
import { initAnalytics, trackLinks } from '../core/analytics.js';
import { initHeader } from '../ui/header.js';
import { initMotion } from '../ui/motion.js';

export async function bootCommon() {
  window.GG_READY = true;
  initMotion();
  initHeader();
  initAnalytics();
  trackLinks();
  await loadCatalog();
  startAvailability();
}
