// Small DOM helpers. No framework: pages are server-rendered HTML enhanced by these modules.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function on(target, type, selectorOrHandler, handler) {
  if (typeof selectorOrHandler === 'function') {
    target.addEventListener(type, selectorOrHandler);
    return () => target.removeEventListener(type, selectorOrHandler);
  }
  const listener = (event) => {
    const match = event.target.closest(selectorOrHandler);
    if (match && target.contains(match)) handler(event, match);
  };
  target.addEventListener(type, listener);
  return () => target.removeEventListener(type, listener);
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export function env() {
  return window.GG || { api: '/api', assets: { icons: '/assets/img/icons.svg', art: '/assets/img/art.svg' }, env: 'dev' };
}

export function icon(name, cls = 'icon') {
  return `<svg class="${cls}" aria-hidden="true" focusable="false"><use href="${env().assets.icons}#i-${name}"/></svg>`;
}

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const finePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 15) >> 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
