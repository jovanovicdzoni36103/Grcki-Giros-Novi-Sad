// Toast notifications (polite live region). Used for "Dodato u korpu", undo and quick upsell.
import { icon, esc } from '../core/dom.js';

function region() {
  let r = document.querySelector('[data-toasts]');
  if (!r) {
    r = document.createElement('div');
    r.className = 'toast-region';
    r.setAttribute('data-toasts', '');
    r.setAttribute('aria-live', 'polite');
    document.body.appendChild(r);
  }
  return r;
}

/**
 * toast({ text, icon, tone, action: { label, onClick }, extra: HTMLElement|string, timeout })
 */
export function toast(opts) {
  const r = region();
  const el = document.createElement('div');
  el.className = 'toast' + (opts.tone === 'error' ? ' toast--error' : '');
  el.setAttribute('role', opts.tone === 'error' ? 'alert' : 'status');
  el.innerHTML = `<div class="toast__row">${icon(opts.icon || 'check-circle')}<p class="toast__text">${esc(opts.text)}</p>${
    opts.action ? `<button type="button" class="toast__action">${esc(opts.action.label)}</button>` : ''
  }</div>`;
  if (opts.extra) {
    const extra = typeof opts.extra === 'string' ? document.createRange().createContextualFragment(opts.extra) : opts.extra;
    el.appendChild(extra);
  }
  let timer;
  const dismiss = () => {
    clearTimeout(timer);
    if (!el.isConnected) return;
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 260);
  };
  if (opts.action) {
    el.querySelector('.toast__action').addEventListener('click', () => {
      opts.action.onClick();
      dismiss();
    });
  }
  el.addEventListener('pointerenter', () => clearTimeout(timer));
  el.addEventListener('pointerleave', () => (timer = setTimeout(dismiss, 2500)));
  while (r.children.length >= 2) r.firstElementChild.remove();
  r.appendChild(el);
  timer = setTimeout(dismiss, opts.timeout || 4500);
  return { el, dismiss };
}
