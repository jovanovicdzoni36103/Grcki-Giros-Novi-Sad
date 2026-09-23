// Motion with a purpose, all transform/opacity based, all disabled for prefers-reduced-motion.
// reveal: content arrives as you scroll · split: masked headline words · marquee: speed follows scroll
// magnetic: primary CTA leans toward the pointer · tilt: CSS 3D hero · parallax: layered depth
import { $$, prefersReducedMotion, finePointer } from '../core/dom.js';

export function initReveal(root = document) {
  const items = $$('[data-reveal]', root);
  if (!items.length) return;
  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
  );
  items.forEach((el) => io.observe(el));
}

/** Wraps each word of [data-split] headings in masks; keeps the text readable to screen readers. */
export function initSplit(root = document) {
  const heads = $$('[data-split]', root);
  heads.forEach((el) => {
    if (el.dataset.splitDone) return;
    el.dataset.splitDone = '1';
    const label = el.textContent.replace(/\s+/g, ' ').trim();
    let wi = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) {
              frag.appendChild(document.createTextNode(' '));
              return;
            }
            const w = document.createElement('span');
            w.className = 'w';
            w.setAttribute('aria-hidden', 'true');
            const inner = document.createElement('span');
            inner.style.setProperty('--wi', wi++);
            inner.textContent = part;
            w.appendChild(inner);
            frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.tagName !== 'BR') {
          walk(child);
        }
      });
    };
    walk(el);
    el.classList.add('split');
    el.setAttribute('aria-label', label);
    if (prefersReducedMotion()) {
      el.classList.add('is-in');
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-in');
          io.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    io.observe(el);
  });
}

/** Marquees drift slowly and speed up with scroll velocity (Joseph Berry "scroll-txt"). */
export function initMarquee() {
  const marquees = $$('[data-marquee]');
  if (!marquees.length || prefersReducedMotion()) return;
  const state = marquees.map((m) => {
    const track = m.querySelector('.marquee__track');
    track.innerHTML += track.innerHTML; // seamless loop
    return { m, track, x: 0, dir: m.dataset.marquee === 'right' ? 1 : -1, width: 0, visible: true };
  });
  const io = new IntersectionObserver((entries) => entries.forEach((e) => (state.find((s) => s.m === e.target).visible = e.isIntersecting)));
  state.forEach((s) => io.observe(s.m));
  let lastY = window.scrollY;
  let velocity = 0;
  const loop = () => {
    const y = window.scrollY;
    velocity = velocity * 0.9 + Math.min(40, Math.abs(y - lastY)) * 0.1;
    lastY = y;
    state.forEach((s) => {
      if (!s.visible) return;
      if (!s.width) s.width = s.track.scrollWidth / 2;
      s.x += s.dir * (0.45 + velocity * 0.35);
      if (s.x <= -s.width) s.x += s.width;
      if (s.x >= 0 && s.dir > 0) s.x -= s.width;
      s.track.style.transform = `translate3d(${s.x}px,0,0)`;
    });
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  window.addEventListener('resize', () => state.forEach((s) => (s.width = 0)));
}

export function initMagnetic() {
  if (!finePointer() || prefersReducedMotion()) return;
  $$('[data-magnetic]').forEach((el) => {
    const strength = Number(el.dataset.magnetic) || 10;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width - 0.5) * strength * 2;
      const y = ((e.clientY - r.top) / r.height - 0.5) * strength;
      el.style.transform = `translate(${x}px, ${y}px)`;
    });
    el.addEventListener('pointerleave', () => {
      el.style.transform = '';
    });
  });
}

/** CSS 3D tilt driven by the pointer (JB "3D Experience"); on touch devices a gentle scroll parallax instead. */
export function initTilt() {
  const scenes = $$('[data-tilt]');
  if (!scenes.length || prefersReducedMotion()) return;
  scenes.forEach((scene) => {
    const inner = scene.querySelector('[data-tilt-inner]');
    if (!inner) return;
    let raf = 0;
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;
    const animate = () => {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      inner.style.transform = `rotateX(${cy}deg) rotateY(${cx}deg)`;
      if (Math.abs(tx - cx) > 0.01 || Math.abs(ty - cy) > 0.01) raf = requestAnimationFrame(animate);
      else raf = 0;
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(animate);
    };
    if (finePointer()) {
      window.addEventListener('pointermove', (e) => {
        const r = scene.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) return;
        tx = ((e.clientX - (r.left + r.width / 2)) / innerWidth) * 18;
        ty = -((e.clientY - (r.top + r.height / 2)) / innerHeight) * 14;
        kick();
      });
    } else {
      window.addEventListener(
        'scroll',
        () => {
          const r = scene.getBoundingClientRect();
          const p = Math.max(-1, Math.min(1, (r.top + r.height / 2 - innerHeight / 2) / innerHeight));
          ty = p * 10;
          tx = p * -6;
          kick();
        },
        { passive: true }
      );
    }
  });
}

/** [data-parallax="0.2"] moves at a fraction of the scroll speed; [data-spin] rotates with scroll. */
export function initParallax() {
  const items = $$('[data-parallax], [data-spin]');
  if (!items.length || prefersReducedMotion()) return;
  let ticking = false;
  const update = () => {
    const vh = innerHeight;
    items.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      const center = r.top + r.height / 2 - vh / 2;
      if (el.dataset.parallax) el.style.transform = `translate3d(0, ${(-center * Number(el.dataset.parallax)).toFixed(1)}px, 0)`;
      if (el.dataset.spin) el.style.transform = `rotate(${(window.scrollY * Number(el.dataset.spin)).toFixed(1)}deg)`;
    });
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
}

export function initMotion() {
  document.documentElement.classList.add('js');
  initSplit();
  initReveal();
  initMarquee();
  initMagnetic();
  initTilt();
  initParallax();
}
