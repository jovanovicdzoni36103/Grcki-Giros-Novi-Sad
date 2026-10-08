// Home: hero status, live hours, "kako do girosa" sticky scene.
import { $, $$, prefersReducedMotion } from '../core/dom.js';
import { subscribe } from '../core/events.js';
import { catalog } from '../core/catalog.js';
import { statusLine } from '../core/availability.js';
import Scheduling from '../shared/scheduling.cjs';
import { bootCommon } from './common.js';
import { hoursRows } from '../ui/render.js';

function heroStatus(snap) {
  const s = statusLine(snap);
  $$('[data-hero-status]').forEach((el) => {
    el.classList.toggle('is-open', s.open);
    el.classList.toggle('is-closed', !s.open);
    el.querySelector('[data-status-text]').textContent = s.text;
  });
}

function liveHours() {
  const s = catalog();
  if (!s.cfg) return;
  const rows = Scheduling.weeklySummary(s.cfg);
  $$('[data-hours]').forEach((dl) => (dl.innerHTML = hoursRows(rows, { deliveryColumn: dl.hasAttribute('data-hours-delivery') })));
}

/** "Kako do girosa": on desktop the three steps pin and advance with scroll; on phones they simply stack. */
function initSteps() {
  const scene = $('[data-steps]');
  if (!scene || prefersReducedMotion()) return;
  const steps = $$('[data-step]', scene);
  const media = window.matchMedia('(min-width: 1024px)');
  let active = -1;
  const setActive = (i) => {
    if (i === active) return;
    active = i;
    scene.style.setProperty('--step', i);
    steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
    scene.querySelectorAll('[data-step-art]').forEach((a, k) => a.classList.toggle('is-active', k === i));
  };
  const onScroll = () => {
    if (!media.matches) {
      setActive(-1);
      return;
    }
    const r = scene.getBoundingClientRect();
    const total = r.height - innerHeight;
    const p = Math.max(0, Math.min(0.999, -r.top / Math.max(1, total)));
    setActive(Math.floor(p * steps.length));
    scene.style.setProperty('--progress', p.toFixed(3));
  };
  window.addEventListener('scroll', () => requestAnimationFrame(onScroll), { passive: true });
  media.addEventListener('change', onScroll);
  onScroll();
}

async function init() {
  await bootCommon();
  subscribe('availability', heroStatus);
  subscribe('catalog', liveHours);
  liveHours();
  initSteps();
}

init();
