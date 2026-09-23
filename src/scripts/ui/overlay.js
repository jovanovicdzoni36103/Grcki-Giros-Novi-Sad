// Accessible overlays (drawer, sheet, mobile nav): focus trap, Escape, scroll lock, and the phone's
// Back button closes the overlay instead of leaving the page.
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const stack = [];

function trap(event) {
  const top = stack[stack.length - 1];
  if (!top) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    close(top.el);
    return;
  }
  if (event.key !== 'Tab') return;
  const items = Array.from(top.el.querySelectorAll(FOCUSABLE)).filter((n) => n.offsetParent !== null || n === document.activeElement);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

document.addEventListener('keydown', trap);

window.addEventListener('popstate', () => {
  const top = stack[stack.length - 1];
  if (top && top.pushed) {
    top.pushed = false;
    close(top.el, { fromHistory: true });
  }
});

function syncLock() {
  document.body.classList.toggle('is-locked', stack.some((s) => s.lock));
}

export function isOpen(el) {
  return stack.some((s) => s.el === el);
}

/** options: { focus: element | selector, onClose, lock (default true), history (default true) } */
export function open(el, options = {}) {
  if (isOpen(el)) return;
  const entry = { el, opener: document.activeElement, onClose: options.onClose, lock: options.lock !== false, pushed: false };
  stack.push(entry);
  el.hidden = false;
  // Force a style flush so the transition runs from the closed state.
  void el.offsetWidth;
  el.classList.add('is-open');
  syncLock();
  if (options.history !== false) {
    history.pushState({ ggOverlay: true }, '');
    entry.pushed = true;
  }
  const target = typeof options.focus === 'string' ? el.querySelector(options.focus) : options.focus;
  requestAnimationFrame(() => (target || el.querySelector('[role="dialog"]') || el).focus({ preventScroll: true }));
}

export function close(el, { fromHistory = false } = {}) {
  const idx = stack.findIndex((s) => s.el === el);
  if (idx === -1) return;
  const [entry] = stack.splice(idx, 1);
  el.classList.remove('is-open');
  syncLock();
  const done = () => {
    if (!isOpen(el)) el.hidden = true;
  };
  const panel = el.querySelector('.overlay__panel') || el;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    done();
  };
  panel.addEventListener('transitionend', finish, { once: true });
  setTimeout(finish, 650);
  if (entry.pushed && !fromHistory) {
    entry.pushed = false;
    history.back();
  }
  if (entry.opener && document.contains(entry.opener)) entry.opener.focus({ preventScroll: true });
  if (entry.onClose) entry.onClose();
}

export function closeAll() {
  stack.slice().reverse().forEach((s) => close(s.el));
}
