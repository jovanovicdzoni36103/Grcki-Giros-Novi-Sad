// /admin/ — the shop's admin panel (tablet in the kitchen, phone, or PC).
// One PIN login. New orders: visual banner + sound that repeats until silenced + a 5-minute countdown.
// Everything the shop changes day to day (menu, prices, add-ons, zones, hours, pauses, estimates)
// is edited here and saved to Google Sheets through Apps Script — no code, no spreadsheet editing.
import Money from '../shared/money.cjs';
import { $, $$, on, esc, icon, env, debounce } from '../core/dom.js';
import { apiPost } from '../core/api.js';
import { local } from '../core/storage.js';
import { toast } from '../ui/toast.js';
import * as overlay from '../ui/overlay.js';
import { ART_VARIANTS } from '../ui/art-variants.js';
import { artSvg, artBg, TAG_LABELS } from '../ui/render.js';

const TOKEN_KEY = 'gg:admin:v1';
const SOUND_KEY = 'gg:admin:sound';
const root = () => $('[data-admin]');

const VIEWS = [
  ['pregled', 'Pregled', 'star'],
  ['nove', 'Nove porudžbine', 'bell'],
  ['aktivne', 'Aktivne', 'clock'],
  ['istorija', 'Istorija', 'repeat'],
  ['proizvodi', 'Proizvodi', 'bag'],
  ['kategorije', 'Kategorije', 'meander'],
  ['dodaci', 'Dodaci', 'plus'],
  ['zone', 'Zone dostave', 'map'],
  ['radno-vreme', 'Radno vreme', 'sun'],
  ['porucivanje', 'Dostupnost poručivanja', 'pause'],
  ['procene', 'Procena vremena', 'scooter'],
  ['utisci', 'Feedback', 'check-circle'],
  ['podesavanja', 'Podešavanja', 'lock']
];

const STATUS_LABEL = { NEW: 'Nova', CONFIRMED: 'Potvrđena', PREPARING: 'U pripremi', READY: 'Spremna', COMPLETED: 'Završena', REJECTED: 'Odbijena' };
const DAY_NAMES = ['', 'Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota', 'Nedelja'];

const state = {
  token: null,
  expiresAt: 0,
  view: 'pregled',
  board: null,
  catalog: null,
  zones: null,
  hours: null,
  settings: null,
  feedback: null,
  history: { q: '', date: '', status: '', page: 0, total: 0, orders: [] },
  productFilter: '',
  productSearch: '',
  seen: new Set(),
  acked: new Set(),
  sound: local.get(SOUND_KEY) !== false,
  audio: null,
  poll: 10,
  timer: null,
  failures: 0,
  alarmTimer: null,
  alarmRepeats: 0,
  serverOffset: 0,
  busy: new Set(),
  firstLoad: true,
  wake: null
};

window.GG_ADMIN = { chimes: 0 };

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

function keepSession(token, expiresAt) {
  state.token = token;
  state.expiresAt = expiresAt;
  local.set(TOKEN_KEY, { token, expiresAt, poll: state.poll });
}

async function call(action, payload = {}, opts) {
  const res = await apiPost(action, { token: state.token, ...payload }, opts);
  // The server renews the session while the panel is in use, so an open panel is never logged out mid-shift.
  if (res.ok && res.session && res.session.token) keepSession(res.session.token, res.session.expiresAt);
  if (!res.ok && res.error.code === 'UNAUTHORIZED') {
    local.remove(TOKEN_KEY);
    state.token = null;
    renderLogin(res.error.message);
  }
  return res;
}

function fail(res, fallback) {
  toast({ text: (res && res.error && res.error.message) || fallback || 'Izmena nije sačuvana. Pokušajte ponovo.', tone: 'error', icon: 'alert', timeout: 6000 });
}

const now = () => Date.now() + state.serverOffset;

// ---------------------------------------------------------------------------
// Sound: Web Audio chime (no file, works offline), unlocked by the PIN tap.
// ---------------------------------------------------------------------------

function unlockAudio() {
  try {
    state.audio = state.audio || new (window.AudioContext || window.webkitAudioContext)();
    if (state.audio.state === 'suspended') state.audio.resume();
  } catch {
    state.audio = null;
  }
}

function chime() {
  if (!state.sound) return;
  window.GG_ADMIN.chimes++;
  if (!state.audio) return;
  const ctx = state.audio;
  const t0 = ctx.currentTime;
  [0, 0.22, 0.44].forEach((d, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = [880, 1175, 1568][i];
    gain.gain.setValueAtTime(0.0001, t0 + d);
    gain.gain.exponentialRampToValueAtTime(0.55, t0 + d + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0 + d);
    osc.stop(t0 + d + 0.4);
  });
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}

/**
 * Keeps the kitchen tablet's screen on while the panel is open (Screen Wake Lock). A locked screen hides the
 * page, the browser then slows its timers to about once a minute, and new orders would chime late or not at all.
 */
async function keepScreenOn() {
  if (!state.token || document.hidden || !('wakeLock' in navigator) || (state.wake && !state.wake.released)) return;
  try {
    state.wake = await navigator.wakeLock.request('screen');
  } catch {
    state.wake = null; // battery saver or an unsupported browser: the staff guide says to keep the screen on
  }
}

const newOrders = () => ((state.board && state.board.orders) || []).filter((o) => o.status === 'NEW');
const unacked = () => newOrders().filter((o) => !state.acked.has(o.id));

/** Repeats every 20 s while a new order is neither answered nor silenced — at most 15 times (5 minutes). */
function syncAlarm() {
  const pending = newOrders();
  const loud = unacked();
  document.title = pending.length ? `(${pending.length}) NOVA PORUDŽBINA — Admin` : 'Admin — Grčki Giros';
  document.body.classList.toggle('has-new', loud.length > 0);
  if (!loud.length) {
    clearInterval(state.alarmTimer);
    state.alarmTimer = null;
    state.alarmRepeats = 0;
    return;
  }
  if (state.alarmTimer) return;
  state.alarmTimer = setInterval(() => {
    if (!unacked().length || ++state.alarmRepeats > 15) {
      clearInterval(state.alarmTimer);
      state.alarmTimer = null;
      return;
    }
    chime();
  }, 20000);
}

function silence() {
  newOrders().forEach((o) => state.acked.add(o.id));
  clearInterval(state.alarmTimer);
  state.alarmTimer = null;
  state.alarmRepeats = 0;
  renderAlert();
  syncAlarm();
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

function renderLogin(message) {
  clearTimeout(state.timer);
  clearInterval(state.alarmTimer);
  state.alarmTimer = null;
  document.body.classList.remove('has-new');
  root().innerHTML = `<div class="pin">
    <div class="pin__brand"><img class="brand__mark" src="/assets/img/logo-112.png" alt="" width="48" height="56"><strong>Grčki Giros</strong><span>Admin panel</span></div>
    <form class="pin__form" data-pin-form>
      <label class="pin__label" for="pin">Unesite PIN</label>
      <input class="pin__input" id="pin" name="pin" type="password" inputmode="numeric" autocomplete="current-password" maxlength="8" pattern="[0-9]*" required>
      <p class="pin__error" role="alert">${message ? esc(message) : ''}</p>
      <div class="pin__pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 'del', 0, 'ok']
        .map((k) =>
          k === 'del'
            ? `<button type="button" data-key="del" aria-label="Obriši">${icon('arrow-left')}</button>`
            : k === 'ok'
              ? `<button type="submit" class="is-ok" aria-label="Prijava">${icon('check')}</button>`
              : `<button type="button" data-key="${k}">${k}</button>`
        )
        .join('')}</div>
    </form>
  </div>`;
  const input = $('#pin');
  input.focus();
  on($('[data-pin-form]'), 'click', '[data-key]', (e, b) => {
    unlockAudio();
    if (b.dataset.key === 'del') input.value = input.value.slice(0, -1);
    else if (input.value.length < 8) input.value += b.dataset.key;
  });
  $('[data-pin-form]').addEventListener('submit', async (e) => {
    e.preventDefault();
    unlockAudio();
    const res = await apiPost('admin.login', { pin: input.value });
    if (!res.ok) {
      renderLogin(res.error.message);
      return;
    }
    state.poll = res.data.pollSeconds || 10;
    keepSession(res.data.token, res.data.expiresAt);
    renderShell();
    refresh();
    keepScreenOn();
  });
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

function renderShell() {
  root().innerHTML = `<header class="pbar">
      <div class="pbar__brand"><img class="brand__mark" src="/assets/img/logo-112.png" alt="" width="48" height="56"><strong>Grčki Giros</strong><span class="pbar__clock" data-clock></span></div>
      <span class="pbar__conn" data-conn><i></i><span>Povezivanje…</span></span>
      <span class="pbar__shop" data-shop-state></span>
      <button type="button" class="icon-btn" data-sound aria-label="${state.sound ? 'Isključi zvuk' : 'Uključi zvuk'}" aria-pressed="${state.sound}">${icon(state.sound ? 'bell' : 'bell-off')}</button>
      <button type="button" class="text-btn" data-logout>Odjava</button>
    </header>
    <div class="alert-bar" data-alert hidden></div>
    <div class="admin">
      <nav class="admin__nav" aria-label="Sekcije">${VIEWS.map(
        ([id, label, ic]) => `<a href="#${id}" data-view-link="${id}">${icon(ic)}<span>${label}</span><b class="admin__count" data-count="${id}" hidden></b></a>`
      ).join('')}</nav>
      <main class="admin__main" id="main" data-view tabindex="-1"></main>
    </div>
    <div class="overlay drawer admin-drawer" data-drawer hidden>
      <div class="overlay__scrim" data-drawer-close></div>
      <aside class="overlay__panel" role="dialog" aria-modal="true" aria-labelledby="drawer-title" tabindex="-1">
        <header class="overlay__head"><h2 class="h3" id="drawer-title" data-drawer-title></h2><button type="button" class="icon-btn" data-drawer-close aria-label="Zatvori">${icon('close')}</button></header>
        <div class="overlay__body" data-drawer-body></div>
      </aside>
    </div>`;
  setView(viewFromHash(), { quiet: true });
  tickClock();
  measureBar();
}

/** The top bar wraps on phones; sticky nav and alert sit right under its real height. */
function measureBar() {
  const bar = $('.pbar');
  if (bar) document.documentElement.style.setProperty('--pbar-h', `${bar.offsetHeight}px`);
}

function viewFromHash() {
  const id = location.hash.replace('#', '');
  return VIEWS.some((v) => v[0] === id) ? id : state.view;
}

function setView(id, { quiet } = {}) {
  state.view = id;
  $$('[data-view-link]').forEach((a) => (a.dataset.viewLink === id ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  const nav = $('.admin__nav');
  const active = $(`[data-view-link="${id}"]`);
  if (nav && active && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: Math.max(0, active.offsetLeft - 16) });
  renderView();
  loadFor(id);
  if (!quiet) {
    const main = $('[data-view]');
    if (main) main.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }
}

const SOURCES = {
  proizvodi: ['catalog', 'admin.catalog'],
  kategorije: ['catalog', 'admin.catalog'],
  dodaci: ['catalog', 'admin.catalog'],
  zone: ['zones', 'admin.zones'],
  'radno-vreme': ['hours', 'admin.hours'],
  porucivanje: ['settings', 'admin.settings'],
  procene: ['settings', 'admin.settings'],
  podesavanja: ['settings', 'admin.settings'],
  utisci: ['feedback', 'admin.feedback']
};

/** Fresh data for a section. Re-renders only when something changed, so a form the shop is filling is never wiped. */
async function loadFor(id) {
  if (id === 'istorija') {
    await searchHistory(0);
    return;
  }
  const src = SOURCES[id];
  if (!src) return;
  const res = await call(src[1]);
  if (!res.ok) return;
  const changed = JSON.stringify(state[src[0]]) !== JSON.stringify(res.data);
  state[src[0]] = res.data;
  if (changed && state.view === id) renderView();
}

function tickClock() {
  const c = $('[data-clock]');
  if (c) c.textContent = new Date(now()).toLocaleTimeString('sr-Latn-RS', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Belgrade' });
}

function setConn(ok, text) {
  const c = $('[data-conn]');
  if (!c) return;
  c.classList.toggle('is-ok', ok);
  c.classList.toggle('is-bad', !ok);
  c.querySelector('span').textContent = text;
}

// ---------------------------------------------------------------------------
// Orders: board, alert, cards, detail
// ---------------------------------------------------------------------------

async function refresh() {
  clearTimeout(state.timer);
  if (!state.token) return;
  const res = await call('admin.board', {}, { timeoutMs: 15000 });
  if (!res.ok) {
    if (!state.token) return;
    state.failures++;
    setConn(false, `Nema veze (${state.failures}) — pokušavam ponovo`);
    state.timer = setTimeout(refresh, Math.min(60, state.poll * Math.pow(1.6, state.failures)) * 1000);
    return;
  }
  state.failures = 0;
  state.serverOffset = res.data.serverNow - Date.now();
  const fresh = res.data.orders.filter((o) => o.status === 'NEW' && !state.seen.has(o.id));
  res.data.orders.forEach((o) => state.seen.add(o.id));
  state.board = res.data;
  if (fresh.length) {
    chime();
    if (!state.firstLoad) toast({ text: fresh.length === 1 ? `Nova porudžbina #${fresh[0].publicNumber}` : `${fresh.length} nove porudžbine`, icon: 'bell', timeout: 6000 });
    if (state.firstLoad && state.view === 'pregled') setView('nove', { quiet: true });
  }
  state.firstLoad = false;
  renderBoardParts();
  setConn(true, `Povezano · ${new Date(now()).toLocaleTimeString('sr-Latn-RS', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Belgrade' })}`);
  tickClock();
  state.timer = setTimeout(refresh, state.poll * 1000);
}

function renderBoardParts() {
  renderAlert();
  renderCounts();
  renderShopState();
  if (['pregled', 'nove', 'aktivne'].includes(state.view)) renderView();
  syncAlarm();
}

function renderCounts() {
  const orders = (state.board && state.board.orders) || [];
  const counts = {
    nove: orders.filter((o) => o.status === 'NEW').length,
    aktivne: orders.filter((o) => ['CONFIRMED', 'PREPARING', 'READY'].includes(o.status)).length
  };
  Object.entries(counts).forEach(([k, n]) => {
    const b = $(`[data-count="${k}"]`);
    if (!b) return;
    b.hidden = !n;
    b.textContent = String(n);
    b.classList.toggle('is-hot', k === 'nove' && n > 0);
  });
}

function renderShopState() {
  const el = $('[data-shop-state]');
  if (!el || !state.board) return;
  const s = state.board.settings;
  const shop = state.board.shop;
  let text = 'Otvoreno · primamo porudžbine';
  let tone = 'ok';
  if (!s.orderingEnabled) {
    text = 'Poručivanje PAUZIRANO';
    tone = 'bad';
  } else if (shop.onBreak) {
    text = `Pauza · ${shop.next ? 'ponovo ' + shop.next : ''}`;
    tone = 'warn';
  } else if (!shop.open) {
    text = `Zatvoreno${shop.next ? ' · otvaramo ' + shop.next : ''}`;
    tone = 'warn';
  } else if (!s.deliveryEnabled || !s.pickupEnabled) {
    text = !s.deliveryEnabled ? 'Otvoreno · dostava isključena' : 'Otvoreno · preuzimanje isključeno';
    tone = 'warn';
  }
  el.className = `pbar__shop is-${tone}`;
  el.textContent = text;
  document.body.classList.toggle('is-paused', !s.orderingEnabled);
}

function renderAlert() {
  const bar = $('[data-alert]');
  if (!bar) return;
  const list = newOrders();
  if (!list.length) {
    bar.hidden = true;
    return;
  }
  const loud = unacked().length > 0;
  const overdue = list.filter((o) => isOverdue(o));
  bar.hidden = false;
  bar.className = `alert-bar${loud ? ' is-loud' : ''}${overdue.length ? ' is-overdue' : ''}`;
  bar.innerHTML = `${icon('bell')}<strong>${list.length === 1 ? `Nova porudžbina #${list[0].publicNumber}` : `${list.length} nove porudžbine`} čeka${list.length === 1 ? '' : 'ju'} potvrdu</strong>
    ${overdue.length ? `<span class="alert-bar__late">${overdue.length === 1 ? `#${overdue[0].publicNumber} kasni` : `${overdue.length} kasne`} — pozovite kupca</span>` : ''}
    <a class="btn btn--sm btn--gold" href="#nove" data-view-link-inline><span class="btn__label">Otvori</span></a>
    ${loud ? `<button type="button" class="btn btn--sm btn--ghost" data-silence><span class="btn__label">Utišaj</span></button>` : ''}`;
}

function isOverdue(o) {
  return o.status === 'NEW' && o.acceptBy && now() > Date.parse(o.acceptBy);
}

function countdownText(o) {
  const left = Math.round((Date.parse(o.acceptBy) - now()) / 1000);
  if (left >= 0) return `Prihvatite za ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  const late = Math.ceil(-left / 60);
  return `KASNI ${late} min — pozovite kupca`;
}

function whenLine(o) {
  if (o.when === 'asap') return `<strong>ŠTO PRE</strong> <span>okvirno ${esc(o.promisedTime)}</span>`;
  return `<strong>${esc(o.whenText)}</strong>`;
}

function actionButtons(o, { big } = {}) {
  // Only moves the backend allows for this order (o.next comes from the same STATUS_TRANSITIONS the server enforces).
  const allowed = (status) => !Array.isArray(o.next) || o.next.includes(status);
  const b = (status, label, cls = 'btn--blue', confirmText) =>
    allowed(status)
      ? `<button type="button" class="btn ${big ? 'btn--lg' : 'btn--sm'} ${cls}" data-status="${status}" data-id="${esc(o.id)}"${confirmText ? ` data-confirm="${esc(confirmText)}"` : ''}><span class="btn__label">${label}</span></button>`
      : '';
  const text = (status, label) => (allowed(status) ? `<button type="button" class="text-btn" data-status="${status}" data-id="${esc(o.id)}">${label}</button>` : '');
  const reject = (label) =>
    allowed('REJECTED')
      ? `<button type="button" class="text-btn text-btn--danger" data-status="REJECTED" data-id="${esc(o.id)}" data-confirm="${esc(`${label} porudžbinu #${o.publicNumber}? Kupac će videti da je odbijena.`)}">${label}</button>`
      : '';
  switch (o.status) {
    case 'NEW':
      return b('CONFIRMED', 'Prihvati', 'btn--gold') + b('REJECTED', 'Odbij', 'btn--danger', `Odbiti porudžbinu #${o.publicNumber}? Kupac će videti da je odbijena.`);
    case 'CONFIRMED':
      return b('PREPARING', 'U pripremu') + b('READY', 'Spremna', 'btn--ghost') + reject('Otkaži');
    case 'PREPARING':
      return b('READY', 'Spremna', 'btn--gold') + text('CONFIRMED', 'Vrati korak') + reject('Otkaži');
    case 'READY':
      return b('COMPLETED', o.mode === 'delivery' ? 'Isporučeno' : 'Preuzeto', 'btn--gold') + text('PREPARING', 'Vrati korak') + reject('Otkaži');
    case 'COMPLETED':
      return text('READY', 'Vrati na „Spremna“');
    default:
      return '';
  }
}

function orderCard(o) {
  const isDelivery = o.mode === 'delivery';
  const phone = o.customer.phoneDisplay || o.customer.phone;
  const overdue = isOverdue(o);
  return `<article class="pcard pcard--${esc(o.status.toLowerCase())}${overdue ? ' is-overdue' : ''}${state.busy.has(o.id) ? ' is-busy' : ''}" data-order="${esc(o.id)}">
    <header class="pcard__head">
      <span class="pcard__num">#${o.publicNumber}</span>
      <span class="pcard__type pcard__type--${o.mode}">${isDelivery ? 'Dostava' : 'Preuzimanje'}</span>
      <span class="pcard__status">${esc(STATUS_LABEL[o.status] || o.status)}</span>
    </header>
    ${o.status === 'NEW' ? `<p class="pcard__deadline${overdue ? ' is-late' : ''}" data-countdown="${esc(o.id)}">${esc(countdownText(o))}</p>` : ''}
    <p class="pcard__when">${whenLine(o)} <span>primljena ${esc(o.createdLabel)}${o.businessDate !== state.board.businessDate ? ' · ' + esc(o.createdDate) : ''}</span></p>
    <p class="pcard__who"><strong>${esc(o.customer.name)}</strong> <a href="tel:${esc(o.customer.phone)}">${icon('phone')}${esc(phone)}</a></p>
    ${o.address ? `<p class="pcard__addr">${icon('pin')}<span>${esc(o.address.line)}${o.address.aptFloor ? ', ' + esc(o.address.aptFloor) : ''}</span>${o.address.zone ? ` <small>${esc(o.address.zone)}</small>` : ''}</p>` : ''}
    <ul class="pcard__items" role="list">${(o.items || [])
      .map((l) => `<li><b>${l.qty}×</b> <span><strong>${esc(l.name)}</strong>${l.summary ? `<small>${esc(l.summary)}</small>` : ''}${l.removedSummary ? `<small class="bez">${esc(l.removedSummary)}</small>` : ''}${l.note ? `<small class="note">„${esc(l.note)}“</small>` : ''}</span></li>`)
      .join('')}</ul>
    ${o.note ? `<p class="pcard__note">${icon('note')}${esc(o.note)}</p>` : ''}
    <p class="pcard__money"><span>Ukupno <strong>${esc(Money.formatRSD(o.total))}</strong></span>${isDelivery && o.cash !== '' ? `<span>Plaća ${esc(Money.formatRSD(o.cash))} · kusur <strong>${esc(Money.formatRSD(o.change))}</strong></span>` : '<span>Plaća na kasi</span>'}</p>
    <footer class="pcard__actions">${actionButtons(o, { big: o.status === 'NEW' })}<button type="button" class="text-btn" data-detail="${esc(o.id)}">Detalji</button></footer>
  </article>`;
}

function orderDetailHtml(o) {
  const isDelivery = o.mode === 'delivery';
  const maps = o.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.address.line + ', Novi Sad')}` : '';
  const row = (label, value) => (value ? `<div><dt>${label}</dt><dd>${value}</dd></div>` : '');
  const stamps = [
    ['Primljena', o.createdAt],
    ['Potvrđena', o.confirmedAt],
    ['Spremna', o.readyAt],
    ['Završena', o.completedAt],
    ['Odbijena', o.rejectedAt]
  ]
    .filter((s) => s[1])
    .map((s) => `${s[0]} ${esc(String(s[1]).slice(11, 16))}`)
    .join(' · ');
  return `<div class="odetail">
    <p class="odetail__head"><span class="pcard__num">#${o.publicNumber}</span><span class="pcard__type pcard__type--${o.mode}">${isDelivery ? 'Dostava' : 'Preuzimanje'}</span><span class="status-pill status-pill--${esc(o.status.toLowerCase())}">${esc(STATUS_LABEL[o.status] || o.status)}</span></p>
    ${o.status === 'NEW' ? `<p class="pcard__deadline${isOverdue(o) ? ' is-late' : ''}" data-countdown="${esc(o.id)}">${esc(countdownText(o))}</p>` : ''}
    <dl class="odetail__facts">
      ${row('Vreme', whenLine(o))}
      ${row('Primljena', `${esc(o.createdDate)} ${esc(o.createdLabel)}`)}
      ${row('Kupac', `<strong>${esc(o.customer.name)}</strong>`)}
      ${row('Telefon', `<a href="tel:${esc(o.customer.phone)}"><strong>${esc(o.customer.phoneDisplay || o.customer.phone)}</strong></a>`)}
      ${row('Email', esc(o.customer.email))}
      ${o.address ? row('Adresa', `<a href="${esc(maps)}" target="_blank" rel="noopener">${esc(o.address.line)}${o.address.aptFloor ? ', ' + esc(o.address.aptFloor) : ''}</a>`) : ''}
      ${o.address ? row('Zona', esc(o.address.zone)) : ''}
      ${o.address ? row('Za dostavljača', esc(o.address.note)) : ''}
      ${row('Napomena', o.note ? `<strong class="odetail__note">${esc(o.note)}</strong>` : '')}
      ${row('Istorija', stamps)}
    </dl>
    <table class="otable"><thead><tr><th>Stavka</th><th>Kol.</th><th>Iznos</th></tr></thead><tbody>${(o.items || [])
      .map(
        (l) =>
          `<tr><td><strong>${esc(l.name)}</strong>${l.summary ? `<small>${esc(l.summary)}</small>` : ''}${l.removedSummary ? `<small class="bez">${esc(l.removedSummary)}</small>` : ''}${l.note ? `<small class="note">„${esc(l.note)}“</small>` : ''}<small>cena ${esc(Money.formatRSD(l.unitPrice))}${l.optionsPrice ? ` (od toga dodaci ${esc(Money.formatRSD(l.optionsPrice))})` : ''}</small></td><td>${l.qty}</td><td class="num">${esc(Money.formatNumber(l.lineTotal))}</td></tr>`
      )
      .join('')}</tbody>
      <tfoot><tr><td colspan="2">Međuzbir</td><td class="num">${esc(Money.formatNumber(o.subtotal))}</td></tr>${isDelivery ? `<tr><td colspan="2">Dostava</td><td class="num">${esc(Money.formatNumber(o.deliveryFee))}</td></tr>` : ''}<tr class="is-total"><td colspan="2">Ukupno</td><td class="num">${esc(Money.formatRSD(o.total))}</td></tr>
      ${isDelivery && o.cash !== '' ? `<tr><td colspan="2">Plaća gotovinom</td><td class="num">${esc(Money.formatRSD(o.cash))}</td></tr><tr><td colspan="2"><strong>Kusur</strong></td><td class="num"><strong>${esc(Money.formatRSD(o.change))}</strong></td></tr>` : `<tr><td colspan="2">Plaća</td><td class="num">na kasi</td></tr>`}</tfoot>
    </table>
    <div class="pcard__actions">${actionButtons(o, { big: true })}</div>
    <p class="small muted">${esc(o.id)}${o.emailStatus ? ' · email: ' + esc(o.emailStatus) : ''}</p>
  </div>`;
}

function openDrawer(title, html) {
  const d = $('[data-drawer]');
  $('[data-drawer-title]').textContent = title;
  $('[data-drawer-body]').innerHTML = html;
  overlay.open(d, { focus: '[role="dialog"]' });
}

function closeDrawer() {
  overlay.close($('[data-drawer]'));
}

function findOrder(id) {
  return ((state.board && state.board.orders) || []).find((x) => x.id === id) || state.history.orders.find((x) => x.id === id) || null;
}

async function openOrder(id) {
  let o = findOrder(id);
  if (!o) {
    const res = await call('admin.order', { orderId: id });
    if (!res.ok) return fail(res);
    o = res.data;
  }
  openDrawer(`Porudžbina #${o.publicNumber}`, orderDetailHtml(o));
}

async function setStatus(id, status) {
  const o = findOrder(id);
  // What this screen showed: the server refuses the change if another device moved the order meanwhile.
  const from = o ? o.status : undefined;
  state.busy.add(id);
  if (o) {
    o.status = status;
    o.next = []; // no buttons until the server answers with the moves allowed from the new status
    renderView();
  }
  const res = await call('admin.status', { orderId: id, status, from });
  state.busy.delete(id);
  if (!res.ok) {
    fail(res, 'Status nije sačuvan.');
    refresh();
    return;
  }
  const updated = res.data;
  [state.board && state.board.orders, state.history.orders].forEach((list) => {
    if (!list) return;
    const i = list.findIndex((x) => x.id === id);
    if (i !== -1) list[i] = updated;
  });
  state.acked.delete(id);
  toast({ text: `#${updated.publicNumber}: ${STATUS_LABEL[updated.status].toLowerCase()}.`, icon: updated.status === 'REJECTED' ? 'alert' : 'check-circle', timeout: 2600 });
  const drawer = $('[data-drawer]');
  if (overlay.isOpen(drawer) && $('[data-drawer-title]').textContent === `Porudžbina #${updated.publicNumber}`) $('[data-drawer-body]').innerHTML = orderDetailHtml(updated);
  renderBoardParts();
  if (state.view === 'istorija') renderView();
  refresh();
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

function loading() {
  return '<p class="muted admin__loading">Učitavanje…</p>';
}

function viewHead(title, lead, actions = '') {
  return `<header class="vhead"><div><h1 class="vhead__title">${title}</h1>${lead ? `<p class="vhead__lead">${lead}</p>` : ''}</div>${actions ? `<div class="vhead__actions">${actions}</div>` : ''}</header>`;
}

function renderView() {
  const main = $('[data-view]');
  if (!main) return;
  const fn = {
    pregled: viewDashboard,
    nove: viewNew,
    aktivne: viewActive,
    istorija: viewHistory,
    proizvodi: viewProducts,
    kategorije: viewCategories,
    dodaci: viewAddons,
    zone: viewZones,
    'radno-vreme': viewHours,
    porucivanje: viewOrdering,
    procene: viewEstimates,
    utisci: viewFeedback,
    podesavanja: viewSettings
  }[state.view];
  const scroll = window.scrollY;
  const active = document.activeElement && document.activeElement.closest('[data-view]') ? document.activeElement : null;
  const focusedName = active ? active.getAttribute('name') : null;
  // Text typed while data was still arriving (a 2–6 s Apps Script response) must survive the re-render.
  const typed = active && /^(INPUT|TEXTAREA)$/.test(active.tagName) && !['checkbox', 'radio'].includes(active.type) ? active.value : null;
  main.innerHTML = fn();
  if (['pregled', 'nove', 'aktivne'].includes(state.view)) window.scrollTo({ top: scroll });
  if (focusedName) {
    const again = main.querySelector(`[name="${CSS.escape(focusedName)}"]`);
    if (again) {
      if (typed !== null && again.value !== typed) again.value = typed;
      again.focus({ preventScroll: true });
    }
  }
}

function boardNotices() {
  if (!state.board) return '';
  const s = state.board.settings;
  const quota = typeof s.emailQuota === 'number' ? s.emailQuota : -1;
  return (
    (s.testMode
      ? `<p class="notice notice--error">${icon('alert')}<span><strong>Test režim je uključen:</strong> emailovi o porudžbinama ne idu kuhinji ni kupcima, već samo na test adresu. Pre puštanja u rad u tabeli SETTINGS postavite <code>test_mode</code> na FALSE.</span></p>`
      : '') +
    (quota >= 0 && quota < 25
      ? `<p class="notice notice--error">${icon('alert')}<span><strong>Email kvota za danas je skoro potrošena (ostalo ${quota}).</strong> Kad ostane 10, kupcima se emailovi više ne šalju, a kuhinji ide samo prva adresa. Porudžbine i dalje stižu ovde, u panel. Kvota se obnavlja sutra.</span></p>`
      : '')
  );
}

function viewDashboard() {
  if (!state.board) return viewHead('Pregled') + loading();
  const d = state.board.dashboard;
  const tile = (label, value, tone = '', href = '') =>
    `<${href ? `a href="${href}"` : 'div'} class="kpi${tone ? ' kpi--' + tone : ''}"><span class="kpi__label">${label}</span><span class="kpi__value num">${value}</span></${href ? 'a' : 'div'}>`;
  const overdue = state.board.orders.filter(isOverdue);
  return `${viewHead('Pregled', `Danas, ${esc(state.board.businessDate.split('-').reverse().join('.'))}.`)}
    ${boardNotices()}
    <div class="kpis">
      ${tile('Porudžbine danas', d.orders)}
      ${tile('Vrednost danas', esc(Money.formatRSD(d.value)))}
      ${tile('Dostava', d.delivery)}
      ${tile('Preuzimanje', d.pickup)}
      ${tile('Završene', d.completed, 'ok')}
      ${tile('Odbijene', d.rejected, d.rejected ? 'bad' : '')}
      ${tile('Čekaju potvrdu', d.newCount, d.newCount ? 'warn' : '', '#nove')}
      ${tile('Istekao rok (5 min)', d.overdue, d.overdue ? 'bad' : '', '#nove')}
      ${tile('U radu', d.active - d.newCount, '', '#aktivne')}
    </div>
    ${overdue.length ? `<section class="vsection"><h2 class="vsection__title">Zahteva pažnju</h2><div class="cards">${overdue.map(orderCard).join('')}</div></section>` : ''}
    <p class="small muted">Vrednost ne uključuje odbijene porudžbine. Detaljna statistika i izveštaji stižu emailom i stoje u Google tabeli (DASHBOARD).</p>`;
}

function viewNew() {
  if (!state.board) return viewHead('Nove porudžbine') + loading();
  const list = newOrders().slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.publicNumber - a.publicNumber);
  const mins = state.board.settings.acceptTimeoutMin;
  return `${viewHead('Nove porudžbine', `Prihvatite ili odbijte svaku porudžbinu u roku od ${mins} minuta. Najnovije su gore.`)}
    ${boardNotices()}
    ${list.length ? `<div class="cards cards--new">${list.map(orderCard).join('')}</div>` : `<div class="empty">${icon('check-circle')}<p>Nema novih porudžbina.</p><p class="small muted">Stranica se osvežava sama na svakih ${state.poll} s. Kad stigne nova, čućete zvuk.</p></div>`}`;
}

function viewActive() {
  if (!state.board) return viewHead('Aktivne porudžbine') + loading();
  const orders = state.board.orders;
  const col = (status, title) => {
    const list = orders.filter((o) => o.status === status).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.publicNumber - b.publicNumber);
    return `<section class="col"><h2>${title} <b>${list.length}</b></h2>${list.length ? list.map(orderCard).join('') : '<p class="col__empty">—</p>'}</section>`;
  };
  const done = orders.filter((o) => o.status === 'COMPLETED' && o.businessDate === state.board.businessDate);
  return `${viewHead('Aktivne porudžbine', 'Jedan dodir pomera porudžbinu u sledeći korak. Kupac vidi promenu na svojoj stranici statusa.')}
    <div class="board">${col('CONFIRMED', 'Potvrđene')}${col('PREPARING', 'U pripremi')}${col('READY', 'Spremne')}</div>
    <details class="vsection"><summary class="vsection__title">Završene danas (${done.length})</summary><div class="cards">${done.map(orderCard).join('') || '<p class="muted">—</p>'}</div></details>`;
}

function viewHistory() {
  const h = state.history;
  const statusOpts = ['', 'NEW', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'REJECTED']
    .map((s) => `<option value="${s}" ${h.status === s ? 'selected' : ''}>${s ? STATUS_LABEL[s] : 'Svi statusi'}</option>`)
    .join('');
  const rows = h.orders
    .map(
      (o) => `<tr data-detail="${esc(o.id)}" tabindex="0"><td><strong>#${o.publicNumber}</strong></td><td>${esc(o.createdDate)} ${esc(o.createdLabel)}</td><td>${esc(o.customer.name)}<small>${esc(o.customer.phoneDisplay || o.customer.phone)}</small></td><td>${o.mode === 'delivery' ? 'Dostava' : 'Preuzimanje'}</td><td class="num">${esc(Money.formatNumber(o.total))}</td><td><span class="status-pill status-pill--${esc(o.status.toLowerCase())}">${esc(STATUS_LABEL[o.status] || o.status)}</span></td></tr>`
    )
    .join('');
  return `${viewHead('Istorija porudžbina', 'Pretraga po broju, imenu, telefonu, datumu i statusu.')}
    <form class="filters" data-history-form>
      <label class="field"><span class="field__label">Broj, ime ili telefon</span><input class="input" name="q" value="${esc(h.q)}" placeholder="npr. 1042, Ana, 064…" autocomplete="off"></label>
      <label class="field"><span class="field__label">Datum</span><input class="input" type="date" name="date" value="${esc(h.date)}"></label>
      <label class="field"><span class="field__label">Status</span><select class="input" name="status">${statusOpts}</select></label>
      <button class="btn btn--blue" type="submit"><span class="btn__label">Traži</span></button>
    </form>
    <p class="small muted" data-history-total>${h.loading ? 'Tražim…' : `Pronađeno: ${h.total}`}</p>
    <div class="table-wrap"><table class="otable otable--list"><thead><tr><th>Broj</th><th>Vreme</th><th>Kupac</th><th>Tip</th><th>Iznos</th><th>Status</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="muted">Nema porudžbina za ovu pretragu.</td></tr>'}</tbody></table></div>
    ${h.orders.length < h.total ? `<button type="button" class="btn btn--ghost" data-history-more><span class="btn__label">Učitaj još</span></button>` : ''}`;
}

/** Only the newest search may render: an older, slower response must never overwrite a newer one. */
let historySeq = 0;

async function searchHistory(page) {
  const h = state.history;
  const seq = ++historySeq;
  h.loading = true;
  if (state.view === 'istorija') renderView();
  const res = await call('admin.history', { q: h.q, date: h.date, status: h.status, page });
  if (seq !== historySeq) return;
  h.loading = false;
  if (!res.ok) {
    fail(res);
    if (state.view === 'istorija') renderView();
    return;
  }
  h.page = page;
  h.total = res.data.total;
  h.orders = page === 0 ? res.data.orders : h.orders.concat(res.data.orders);
  if (state.view === 'istorija') renderView();
}

// --- Products -----------------------------------------------------------------------

function catName(id) {
  const c = state.catalog && state.catalog.categories.find((x) => x.id === id);
  return c ? c.name : id;
}

function thumb(p) {
  return `<span class="thumb art-frame" style="--art-bg:${artBg(p)}">${artSvg(env().assets, p)}</span>`;
}

function toggle(name, checked, label, attrs = '') {
  return `<label class="switch switch--sm"><span>${label}</span><input type="checkbox" name="${esc(name)}" ${checked ? 'checked' : ''} ${attrs}></label>`;
}

function moveButtons(kind, id, first, last) {
  return `<span class="move"><button type="button" class="icon-btn icon-btn--sm move__up" data-move="${kind}" data-id="${esc(id)}" data-dir="up" aria-label="Pomeri gore" ${first ? 'disabled' : ''}>${icon('chevron')}</button><button type="button" class="icon-btn icon-btn--sm move__down" data-move="${kind}" data-id="${esc(id)}" data-dir="down" aria-label="Pomeri dole" ${last ? 'disabled' : ''}>${icon('chevron')}</button></span>`;
}

function viewProducts() {
  if (!state.catalog) return viewHead('Proizvodi') + loading();
  const c = state.catalog;
  const cats = c.categories.slice().sort((a, b) => a.sort - b.sort);
  const q = state.productSearch.trim().toLowerCase();
  const chips = [`<button type="button" class="chip" data-product-filter="" aria-pressed="${!state.productFilter}">Sve</button>`]
    .concat(cats.map((cat) => `<button type="button" class="chip" data-product-filter="${esc(cat.id)}" aria-pressed="${state.productFilter === cat.id}">${esc(cat.name)}</button>`))
    .join('');
  const sections = cats
    .filter((cat) => !state.productFilter || cat.id === state.productFilter)
    .map((cat) => {
      const list = c.products.filter((p) => p.categoryId === cat.id && (!q || p.name.toLowerCase().includes(q))).sort((a, b) => a.sort - b.sort);
      if (!list.length) return '';
      return `<section class="vsection"><h2 class="vsection__title">${esc(cat.name)}${cat.active ? '' : ' <small class="badge badge--off">kategorija isključena</small>'}</h2>
        <ul class="plist" role="list">${list
          .map(
            (p, i) => `<li class="plist__row${p.active ? '' : ' is-hidden'}${p.available ? '' : ' is-soldout'}" data-product-row="${esc(p.id)}">
              ${moveButtons('product', p.id, i === 0, i === list.length - 1)}
              ${thumb(p)}
              <div class="plist__main"><strong>${esc(p.name)}</strong><span class="num">${esc(Money.formatRSD(p.price))}</span>${p.demo ? '<small class="badge">probni</small>' : ''}${!p.active ? '<small class="badge badge--off">nije na meniju</small>' : ''}${!p.available ? '<small class="badge badge--bad">rasprodato</small>' : ''}</div>
              <div class="plist__toggles">${toggle('active', p.active, 'Na meniju', `data-flag="active" data-id="${esc(p.id)}"`)}${toggle('available', p.available, 'Dostupno', `data-flag="available" data-id="${esc(p.id)}"`)}</div>
              <button type="button" class="btn btn--sm btn--ghost" data-edit-product="${esc(p.id)}"><span class="btn__label">Izmeni</span></button>
            </li>`
          )
          .join('')}</ul></section>`;
    })
    .join('');
  return `${viewHead('Proizvodi', 'Cena, opis, slika, kategorija, dodaci i dostupnost. „Dostupno“ isključite kad nešto nestane — proizvod ostaje na meniju ali ne može da se poruči.', `<button type="button" class="btn btn--gold" data-edit-product=""><span class="btn__label">+ Novi proizvod</span></button>`)}
    <div class="toolbar"><div class="chips">${chips}</div><label class="toolbar__search"><span class="sr-only">Pretraga proizvoda</span><input class="input" name="productSearch" value="${esc(state.productSearch)}" placeholder="Traži proizvod…" autocomplete="off"></label></div>
    ${sections || '<p class="muted">Nema proizvoda.</p>'}`;
}

function productForm(p) {
  const c = state.catalog;
  const groups = c.groups.slice().sort((a, b) => a.sort - b.sort);
  const cats = c.categories.slice().sort((a, b) => a.sort - b.sort);
  const artOptions = Object.keys(ART_VARIANTS)
    .map((k) => `<option value="${esc(k)}" ${p.art === k ? 'selected' : ''}>${esc(k)}</option>`)
    .join('');
  const groupRows = groups
    .map((g) => {
      const on = (p.groups || []).includes(g.id);
      const opts = c.options.filter((o) => o.groupId === g.id).sort((a, b) => a.sort - b.sort);
      return `<div class="gpick${on ? ' is-on' : ''}" data-gpick="${esc(g.id)}">
        <label class="check"><input type="checkbox" name="groups" value="${esc(g.id)}" ${on ? 'checked' : ''}><span><strong>${esc(g.name)}</strong> <small>${g.type === 'single' ? 'jedan izbor' : 'više izbora'}${g.required ? ', obavezno' : ''} · ${opts.length} opcija</small></span></label>
        <div class="gpick__defaults" ${on ? '' : 'hidden'}><span class="small muted">Podrazumevano uključeno:</span><div class="chips">${opts
          .map((o) => `<label><input class="chip-input" type="checkbox" name="defaults" value="${esc(o.id)}" ${(p.defaults || []).includes(o.id) ? 'checked' : ''}><span class="chip">${esc(o.name)}${o.price ? ` <small>+${o.price}</small>` : ''}</span></label>`)
          .join('')}</div></div>
      </div>`;
    })
    .join('');
  const tags = Object.entries(TAG_LABELS)
    .map(([k, l]) => `<label><input class="chip-input" type="checkbox" name="tags" value="${k}" ${(p.tags || []).includes(k) ? 'checked' : ''}><span class="chip">${esc(l)}</span></label>`)
    .join('');
  return `<form class="aform" data-product-form data-id="${esc(p.id || '')}" novalidate>
    <div class="aform__preview" data-product-preview>${thumb(p)}</div>
    <div class="field" data-field="name"><label class="field__label" for="p-name">Naziv</label><input class="input" id="p-name" name="name" value="${esc(p.name || '')}" maxlength="60" required><p class="field__error" role="alert"></p></div>
    <div class="field-row field-row--even">
      <div class="field" data-field="categoryId"><label class="field__label" for="p-cat">Kategorija</label><select class="input" id="p-cat" name="categoryId">${cats.map((x) => `<option value="${esc(x.id)}" ${p.categoryId === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select><p class="field__error" role="alert"></p></div>
      <div class="field" data-field="price"><label class="field__label" for="p-price">Cena (RSD)</label><input class="input" id="p-price" name="price" inputmode="numeric" value="${esc(p.price ?? '')}" required><p class="field__error" role="alert"></p></div>
    </div>
    <div class="field" data-field="description"><label class="field__label" for="p-desc">Opis <span class="optional">opciono</span></label><textarea class="input" id="p-desc" name="description" rows="3" maxlength="300">${esc(p.description || '')}</textarea><p class="field__error" role="alert"></p></div>
    <fieldset class="aform__box"><legend>Slika</legend>
      <div class="field" data-field="image"><label class="field__label" for="p-image">Fotografija</label>
        <div class="upload"><input class="input" id="p-image" name="image" value="${esc(p.image || '')}" placeholder="https://… ili dodajte fotografiju"><label class="btn btn--sm btn--blue upload__btn"><span class="btn__label">Dodaj fotografiju</span><input type="file" accept="image/jpeg,image/png,image/webp" data-upload hidden></label></div>
        <p class="field__hint">Fotografija se smanjuje na telefonu/računaru i čuva na Google Drive-u lokala. Prazno = ilustracija ispod.</p><p class="field__error" role="alert"></p></div>
      <div class="field"><label class="field__label" for="p-art">Ilustracija (kad nema fotografije)</label><select class="input" id="p-art" name="art"><option value="">Po kategoriji</option>${artOptions}</select></div>
    </fieldset>
    <fieldset class="aform__box"><legend>Dodaci i opcije</legend><p class="field__hint">Označite grupe dodataka koje kupac bira za ovaj proizvod. Nove grupe i opcije pravite u sekciji „Dodaci“.</p>${groupRows || '<p class="muted">Nema grupa.</p>'}</fieldset>
    <fieldset class="aform__box"><legend>Prikaz</legend>
      <div class="field-row field-row--even">
        <div class="field" data-field="comparePrice"><label class="field__label" for="p-compare">Stara cena <span class="optional">precrtana</span></label><input class="input" id="p-compare" name="comparePrice" inputmode="numeric" value="${esc(p.comparePrice || '')}"><p class="field__error" role="alert"></p></div>
        <div class="field"><label class="field__label" for="p-badge">Natpis <span class="optional">npr. Akcija</span></label><input class="input" id="p-badge" name="badge" value="${esc(p.badge || '')}" maxlength="20"></div>
      </div>
      <div class="field"><label class="field__label" for="p-includes">Sadrži <span class="optional">za pakete</span></label><input class="input" id="p-includes" name="includes" value="${esc(p.includes || '')}" maxlength="80" placeholder="npr. 2 girosa · 2 soka"></div>
      <p class="field__label">Oznake</p><div class="chips">${tags}</div>
    </fieldset>
    <fieldset class="aform__box"><legend>Dostupnost</legend>
      ${toggle('active', p.active !== false, 'Na meniju (vidi se na sajtu)')}
      ${toggle('available', p.available !== false, 'Dostupno za poručivanje (nije rasprodato)')}
      ${toggle('delivery', p.delivery !== false, 'Može u dostavu')}
      ${toggle('pickup', p.pickup !== false, 'Može za preuzimanje')}
    </fieldset>
    <input type="hidden" name="kind" value="${esc(p.kind || 'item')}">
    <div class="aform__foot"><button type="submit" class="btn btn--gold btn--lg"><span class="btn__label">${p.id ? 'Sačuvaj izmene' : 'Dodaj proizvod'}</span></button><button type="button" class="text-btn" data-drawer-close>Otkaži</button></div>
  </form>`;
}

function formValues(formEl) {
  const fd = new FormData(formEl);
  const out = {};
  for (const [k, v] of fd.entries()) {
    if (['groups', 'defaults', 'tags'].includes(k)) (out[k] = out[k] || []).push(v);
    else out[k] = v;
  }
  formEl.querySelectorAll('input[type="checkbox"]:not([value])').forEach((cb) => (out[cb.name] = cb.checked));
  formEl.querySelectorAll('.switch input[type="checkbox"]').forEach((cb) => (out[cb.name] = cb.checked));
  return out;
}

function showFormError(formEl, res) {
  formEl.querySelectorAll('.field.has-error').forEach((f) => f.classList.remove('has-error'));
  const field = res && res.error && res.error.field ? formEl.querySelector(`[data-field="${CSS.escape(res.error.field)}"]`) : null;
  if (field) {
    field.classList.add('has-error');
    const err = field.querySelector('.field__error');
    if (err) err.textContent = res.error.message;
    const input = field.querySelector('input, select, textarea');
    if (input) input.focus();
  } else fail(res);
}

async function saveProduct(formEl) {
  const v = formValues(formEl);
  const id = formEl.dataset.id;
  const existing = id ? state.catalog.products.find((p) => p.id === id) : {};
  const product = {
    ...(existing || {}),
    id: id || undefined,
    name: v.name,
    categoryId: v.categoryId,
    price: v.price,
    comparePrice: v.comparePrice,
    description: v.description,
    image: v.image,
    art: v.art,
    groups: v.groups || [],
    defaults: v.defaults || [],
    tags: v.tags || [],
    badge: v.badge,
    includes: v.includes,
    kind: v.kind,
    active: v.active,
    available: v.available,
    delivery: v.delivery,
    pickup: v.pickup
  };
  const btn = formEl.querySelector('button[type="submit"]');
  btn.disabled = true;
  const res = await call('admin.product.save', { product });
  btn.disabled = false;
  if (!res.ok) return showFormError(formEl, res);
  state.catalog = res.data.catalog;
  closeDrawer();
  renderView();
  toast({ text: `${product.name}: ${id ? 'izmene su sačuvane' : 'dodat na meni'}. Sajt ga prikazuje za najviše minut.`, icon: 'check-circle', timeout: 4000 });
}

/** Shrinks a photo in the browser (max 1000 px, JPEG) so the upload stays small on a weak connection. */
function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, 1000 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Slika ne može da se pročita.'));
    };
    img.src = url;
  });
}

async function uploadImage(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const formEl = input.closest('form');
  const label = input.closest('.upload__btn').querySelector('.btn__label');
  label.textContent = 'Šaljem…';
  try {
    const data = await shrinkImage(file);
    const res = await call('admin.image.upload', { type: 'image/jpeg', data, name: formEl.querySelector('[name="name"]').value || 'proizvod' }, { timeoutMs: 60000 });
    if (!res.ok) return showFormError(formEl, res);
    formEl.querySelector('[name="image"]').value = res.data.url;
    updatePreview(formEl);
    toast({ text: 'Fotografija je dodata. Sačuvajte proizvod.', icon: 'check-circle' });
  } catch (err) {
    toast({ text: err.message, tone: 'error', icon: 'alert' });
  } finally {
    label.textContent = 'Dodaj fotografiju';
    input.value = '';
  }
}

function updatePreview(formEl) {
  const box = formEl.querySelector('[data-product-preview]');
  if (!box) return;
  box.innerHTML = thumb({ name: formEl.querySelector('[name="name"]').value, image: formEl.querySelector('[name="image"]').value.trim(), art: formEl.querySelector('[name="art"]').value, categoryId: formEl.querySelector('[name="categoryId"]').value });
}

// --- Categories ------------------------------------------------------------------------

function viewCategories() {
  if (!state.catalog) return viewHead('Kategorije') + loading();
  const cats = state.catalog.categories.slice().sort((a, b) => a.sort - b.sort);
  return `${viewHead('Kategorije', 'Redosled ovde je redosled na meniju. Isključena kategorija sakriva sve svoje proizvode.', `<button type="button" class="btn btn--gold" data-edit-category=""><span class="btn__label">+ Nova kategorija</span></button>`)}
    <ul class="plist" role="list">${cats
      .map(
        (c, i) => `<li class="plist__row${c.active ? '' : ' is-hidden'}">${moveButtons('category', c.id, i === 0, i === cats.length - 1)}
          <div class="plist__main"><strong>${esc(c.name)}</strong><small class="muted">${state.catalog.products.filter((p) => p.categoryId === c.id).length} proizvoda${c.description ? ' · ' + esc(c.description) : ''}</small></div>
          <div class="plist__toggles">${toggle('active', c.active, 'Uključena', `data-category-toggle="${esc(c.id)}"`)}</div>
          <button type="button" class="btn btn--sm btn--ghost" data-edit-category="${esc(c.id)}"><span class="btn__label">Izmeni</span></button></li>`
      )
      .join('')}</ul>`;
}

function categoryForm(c) {
  return `<form class="aform" data-category-form data-id="${esc(c.id || '')}" novalidate>
    <div class="field" data-field="name"><label class="field__label" for="c-name">Naziv</label><input class="input" id="c-name" name="name" value="${esc(c.name || '')}" maxlength="40" required><p class="field__error" role="alert"></p></div>
    <div class="field"><label class="field__label" for="c-desc">Kratak opis <span class="optional">opciono</span></label><input class="input" id="c-desc" name="description" value="${esc(c.description || '')}" maxlength="200"></div>
    ${toggle('active', c.active !== false, 'Uključena (vidi se na meniju)')}
    <div class="aform__foot"><button type="submit" class="btn btn--gold btn--lg"><span class="btn__label">${c.id ? 'Sačuvaj' : 'Dodaj kategoriju'}</span></button><button type="button" class="text-btn" data-drawer-close>Otkaži</button></div>
  </form>`;
}

async function saveCategory(formEl, override) {
  const v = override || formValues(formEl);
  const id = formEl ? formEl.dataset.id : v.id;
  const res = await call('admin.category.save', { category: { id: id || undefined, name: v.name, description: v.description, active: v.active } });
  if (!res.ok) return formEl ? showFormError(formEl, res) : fail(res);
  state.catalog = res.data.catalog;
  if (formEl) closeDrawer();
  renderView();
  toast({ text: `Kategorija „${v.name}“ je sačuvana.`, icon: 'check-circle' });
}

// --- Add-ons ------------------------------------------------------------------------------

function viewAddons() {
  if (!state.catalog) return viewHead('Dodaci') + loading();
  const c = state.catalog;
  const groups = c.groups.slice().sort((a, b) => a.sort - b.sort);
  return `${viewHead('Dodaci i opcije', 'Grupe (npr. Sosovi, Dodaci) i njihove opcije sa doplatom. Isključena opcija ne može da se izabere.', `<button type="button" class="btn btn--gold" data-edit-group=""><span class="btn__label">+ Nova grupa</span></button>`)}
    ${groups
      .map((g) => {
        const opts = c.options.filter((o) => o.groupId === g.id).sort((a, b) => a.sort - b.sort);
        const used = c.products.filter((p) => (p.groups || []).includes(g.id)).length;
        return `<section class="vsection gbox"><header class="gbox__head"><div><h2 class="vsection__title">${esc(g.name)}</h2><p class="small muted">${g.type === 'single' ? 'Jedan izbor' : g.max ? `Do ${g.max} izbora` : 'Više izbora'}${g.required ? ' · obavezno' : ''} · koristi ${used} proizvod${used === 1 ? '' : 'a'}</p></div>
          <div class="cluster"><button type="button" class="btn btn--sm btn--ghost" data-edit-group="${esc(g.id)}"><span class="btn__label">Izmeni grupu</span></button><button type="button" class="btn btn--sm btn--blue" data-edit-option="" data-group="${esc(g.id)}"><span class="btn__label">+ Opcija</span></button></div></header>
          <ul class="plist" role="list">${opts
            .map(
              (o, i) => `<li class="plist__row${o.available ? '' : ' is-soldout'}">${moveButtons('option', o.id, i === 0, i === opts.length - 1)}
                <div class="plist__main"><strong>${esc(o.name)}</strong><span class="num">${o.price ? '+' + esc(Money.formatRSD(o.price)) : 'bez doplate'}</span></div>
                <div class="plist__toggles">${toggle('available', o.available, 'Dostupno', `data-option-toggle="${esc(o.id)}"`)}</div>
                <button type="button" class="btn btn--sm btn--ghost" data-edit-option="${esc(o.id)}"><span class="btn__label">Izmeni</span></button></li>`
            )
            .join('') || '<li class="muted plist__row">Nema opcija.</li>'}</ul></section>`;
      })
      .join('')}`;
}

function groupForm(g) {
  return `<form class="aform" data-group-form data-id="${esc(g.id || '')}" novalidate>
    <div class="field" data-field="name"><label class="field__label" for="g-name">Naziv grupe</label><input class="input" id="g-name" name="name" value="${esc(g.name || '')}" maxlength="40" required><p class="field__error" role="alert"></p></div>
    <div class="field"><span class="field__label">Izbor</span><div class="chips"><label><input class="chip-input" type="radio" name="type" value="multi" ${g.type !== 'single' ? 'checked' : ''}><span class="chip">Više izbora (npr. sosovi)</span></label><label><input class="chip-input" type="radio" name="type" value="single" ${g.type === 'single' ? 'checked' : ''}><span class="chip">Tačno jedan (npr. meso)</span></label></div></div>
    <div class="field-row field-row--even">
      <div class="field" data-field="max"><label class="field__label" for="g-max">Najviše izbora <span class="optional">0 = bez ograničenja</span></label><input class="input" id="g-max" name="max" inputmode="numeric" value="${esc(g.max ?? 0)}"><p class="field__error" role="alert"></p></div>
      <div class="field"><label class="field__label" for="g-display">Prikaz</label><select class="input" id="g-display" name="display">${[['chips', 'Dugmići'], ['cards', 'Kartice'], ['toggle', 'Prekidač'], ['info', 'Samo informacija']].map(([k, l]) => `<option value="${k}" ${g.display === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    </div>
    <label class="check"><input type="checkbox" name="required" ${g.required ? 'checked' : ''}><span>Obavezan izbor (kupac ne može da doda proizvod bez njega)</span></label>
    <div class="field"><label class="field__label" for="g-hint">Pomoćni tekst <span class="optional">opciono</span></label><input class="input" id="g-hint" name="hint" value="${esc(g.hint || '')}" maxlength="120"></div>
    <div class="aform__foot"><button type="submit" class="btn btn--gold btn--lg"><span class="btn__label">${g.id ? 'Sačuvaj' : 'Dodaj grupu'}</span></button><button type="button" class="text-btn" data-drawer-close>Otkaži</button></div>
  </form>`;
}

function optionForm(o) {
  return `<form class="aform" data-option-form data-id="${esc(o.id || '')}" data-group="${esc(o.groupId || '')}" novalidate>
    <div class="field" data-field="name"><label class="field__label" for="o-name">Naziv</label><input class="input" id="o-name" name="name" value="${esc(o.name || '')}" maxlength="40" required><p class="field__error" role="alert"></p></div>
    <div class="field" data-field="price"><label class="field__label" for="o-price">Doplata (RSD) <span class="optional">0 = bez doplate</span></label><input class="input" id="o-price" name="price" inputmode="numeric" value="${esc(o.price ?? 0)}"><p class="field__error" role="alert"></p></div>
    ${toggle('available', o.available !== false, 'Dostupno')}
    <div class="aform__foot"><button type="submit" class="btn btn--gold btn--lg"><span class="btn__label">${o.id ? 'Sačuvaj' : 'Dodaj opciju'}</span></button><button type="button" class="text-btn" data-drawer-close>Otkaži</button></div>
  </form>`;
}

// --- Zones ------------------------------------------------------------------------------------

function viewZones() {
  if (!state.zones) return viewHead('Zone dostave') + loading();
  const z = state.zones;
  return `${viewHead('Zone dostave', `Kupac bira naselje sa spiska. Svaka zona ima svoju cenu dostave i minimalnu porudžbinu (prazno = ${esc(Money.formatRSD(z.defaultMin))}). Adrese van zona ne mogu da poruče dostavu.`, `<button type="button" class="btn btn--gold" data-edit-zone=""><span class="btn__label">+ Nova zona</span></button>`)}
    ${z.zonesEnabled ? '' : '<p class="notice notice--error">Zone su isključene u tabeli (zones_enabled). Kupci plaćaju jedinstvenu cenu dostave.</p>'}
    <ul class="plist" role="list">${z.zones
      .map(
        (zone, i) => `<li class="plist__row${zone.active ? '' : ' is-hidden'}">${moveButtons('zone', zone.id, i === 0, i === z.zones.length - 1)}
          <div class="plist__main"><strong>${esc(zone.name)}</strong><span class="num">${esc(Money.formatRSD(zone.fee))} · min. ${esc(Money.formatRSD(zone.minOrder === '' ? z.defaultMin : zone.minOrder))}</span><small class="muted">${esc(zone.areas)}</small></div>
          <div class="plist__toggles">${toggle('active', zone.active, 'Aktivna', `data-zone-toggle="${esc(zone.id)}"`)}</div>
          <button type="button" class="btn btn--sm btn--ghost" data-edit-zone="${esc(zone.id)}"><span class="btn__label">Izmeni</span></button></li>`
      )
      .join('')}</ul>`;
}

function zoneForm(z) {
  return `<form class="aform" data-zone-form data-id="${esc(z.id || '')}" novalidate>
    <div class="field" data-field="name"><label class="field__label" for="z-name">Naziv zone</label><input class="input" id="z-name" name="name" value="${esc(z.name || '')}" maxlength="60" required><p class="field__error" role="alert"></p></div>
    <div class="field" data-field="areas"><label class="field__label" for="z-areas">Naselja u zoni <span class="optional">zarezom odvojeno</span></label><textarea class="input" id="z-areas" name="areas" rows="3">${esc(z.areas || '')}</textarea><p class="field__hint">Kupac bira jedno od ovih naselja.</p></div>
    <div class="field-row field-row--even">
      <div class="field" data-field="fee"><label class="field__label" for="z-fee">Cena dostave (RSD)</label><input class="input" id="z-fee" name="fee" inputmode="numeric" value="${esc(z.fee ?? '')}" required><p class="field__error" role="alert"></p></div>
      <div class="field" data-field="minOrder"><label class="field__label" for="z-min">Minimalna porudžbina (RSD)</label><input class="input" id="z-min" name="minOrder" inputmode="numeric" value="${esc(z.minOrder ?? 500)}" placeholder="500"><p class="field__error" role="alert"></p></div>
    </div>
    ${toggle('active', z.active !== false, 'Aktivna (dostavljamo)')}
    <div class="aform__foot"><button type="submit" class="btn btn--gold btn--lg"><span class="btn__label">${z.id ? 'Sačuvaj' : 'Dodaj zonu'}</span></button><button type="button" class="text-btn" data-drawer-close>Otkaži</button></div>
  </form>`;
}

async function saveZone(formEl, override) {
  const v = override || formValues(formEl);
  const id = formEl ? formEl.dataset.id : v.id;
  const res = await call('admin.zone.save', { zone: { id: id || undefined, name: v.name, areas: v.areas, fee: v.fee, minOrder: v.minOrder, active: v.active } });
  if (!res.ok) return formEl ? showFormError(formEl, res) : fail(res);
  state.zones = res.data.zones;
  if (formEl) closeDrawer();
  renderView();
  toast({ text: `Zona „${v.name}“ je sačuvana.`, icon: 'check-circle' });
}

// --- Hours ------------------------------------------------------------------------------------

function viewHours() {
  if (!state.hours) return viewHead('Radno vreme') + loading();
  const byDow = Object.fromEntries(state.hours.hours.map((h) => [h.dow, h]));
  // Plain text in 24-hour form: <input type="time"> follows the browser language and may show AM/PM.
  const t = (dow, name, value, label) =>
    `<label class="htime"><span class="sr-only">${DAY_NAMES[dow]} — ${label}</span><input class="input" type="text" inputmode="numeric" autocomplete="off" maxlength="5" placeholder="00:00" pattern="[0-2]?[0-9][:.]?[0-5][0-9]" name="d${dow}.${name}" value="${esc(value || '')}"></label>`;
  const rows = [1, 2, 3, 4, 5, 6, 7]
    .map((dow) => {
      const h = byDow[dow] || { dow, closed: true };
      return `<tr data-field="d${dow}.open" class="${h.closed ? 'is-closed' : ''}"><th scope="row">${DAY_NAMES[dow]}</th>
        <td><label class="switch switch--sm"><span>Radi</span><input type="checkbox" name="d${dow}.open_day" ${h.closed ? '' : 'checked'}></label></td>
        <td>${t(dow, 'open', h.open, 'otvaranje')}<span class="htime__dash">–</span>${t(dow, 'close', h.close, 'zatvaranje')}</td>
        <td>${t(dow, 'delivery_open', h.delivery_open, 'dostava od')}<span class="htime__dash">–</span>${t(dow, 'delivery_close', h.delivery_close, 'dostava do')}</td>
        <td>${t(dow, 'break_start', h.break_start, 'pauza od')}<span class="htime__dash">–</span>${t(dow, 'break_end', h.break_end, 'pauza do')}</td></tr>`;
    })
    .join('');
  return `${viewHead('Radno vreme', 'Van radnog vremena i tokom pauze meni ostaje vidljiv, ali poručivanje je zatvoreno. Posle pauze sistem sam nastavlja. Zatvaranje posle ponoći (npr. 01:00) je u redu.')}
    <form data-hours-form novalidate>
      <div class="table-wrap"><table class="otable htable"><thead><tr><th>Dan</th><th>Radi</th><th>Lokal</th><th>Dostava</th><th>Pauza <span class="optional">opciono</span></th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="field__error" data-hours-error role="alert"></p>
      <div class="aform__foot"><button type="submit" class="btn btn--gold btn--lg"><span class="btn__label">Sačuvaj radno vreme</span></button></div>
    </form>
    <p class="small muted">Praznici i izuzeci (npr. Nova godina) upisuju se u tabelu SPECIAL_HOURS u Google Sheets-u.</p>`;
}

async function saveHours(formEl) {
  const fd = new FormData(formEl);
  const hours = [1, 2, 3, 4, 5, 6, 7].map((dow) => ({
    dow,
    closed: !fd.get(`d${dow}.open_day`),
    open: fd.get(`d${dow}.open`) || '',
    close: fd.get(`d${dow}.close`) || '',
    delivery_open: fd.get(`d${dow}.delivery_open`) || '',
    delivery_close: fd.get(`d${dow}.delivery_close`) || '',
    break_start: fd.get(`d${dow}.break_start`) || '',
    break_end: fd.get(`d${dow}.break_end`) || ''
  }));
  const res = await call('admin.hours.save', { hours });
  const err = formEl.querySelector('[data-hours-error]');
  if (!res.ok) {
    err.textContent = res.error.message;
    return;
  }
  err.textContent = '';
  state.hours = res.data;
  renderView();
  toast({ text: 'Radno vreme je sačuvano. Sajt ga koristi za najviše minut.', icon: 'check-circle' });
  refresh();
}

// --- Settings-based views -----------------------------------------------------------------------

const bool = (v) => String(v).toUpperCase() === 'TRUE';

function bigSwitch(key, label, hint) {
  const s = state.settings;
  return `<label class="bigswitch${bool(s[key]) ? ' is-on' : ''}"><span><strong>${label}</strong><small>${hint}</small></span><input type="checkbox" data-setting-toggle="${key}" ${bool(s[key]) ? 'checked' : ''}></label>`;
}

function viewOrdering() {
  if (!state.settings) return viewHead('Dostupnost poručivanja') + loading();
  const s = state.settings;
  const busy = Number(s.extra_wait_min) || 0;
  return `${viewHead('Dostupnost poručivanja', 'Isključivanje ne sakriva meni — kupci vide jasnu poruku da trenutno ne primamo porudžbine.')}
    <div class="stack">
      ${bigSwitch('ordering_enabled', 'Online poručivanje', bool(s.ordering_enabled) ? 'Uključeno — sajt prima porudžbine u radno vreme.' : 'PAUZIRANO — niko ne može da poruči.')}
      ${bigSwitch('delivery_enabled', 'Dostava', bool(s.delivery_enabled) ? 'Uključena.' : 'Isključena — preuzimanje i dalje radi.')}
      ${bigSwitch('pickup_enabled', 'Preuzimanje u lokalu', bool(s.pickup_enabled) ? 'Uključeno.' : 'Isključeno — dostava i dalje radi.')}
      <form class="aform aform--inline" data-settings-form><div class="field" data-field="pause_message"><label class="field__label" for="s-pause">Poruka kupcima tokom pauze</label><input class="input" id="s-pause" name="pause_message" value="${esc(s.pause_message)}" maxlength="160"><p class="field__error" role="alert"></p></div><button type="submit" class="btn btn--blue"><span class="btn__label">Sačuvaj poruku</span></button></form>
      <div class="aform__box"><p class="field__label">Gužva — dodatno vreme na sve procene</p><div class="chips">${[0, 15, 30, 45]
        .map((m) => `<button type="button" class="chip" data-busy="${m}" aria-pressed="${busy === m}">${m ? '+' + m + ' min' : 'Normalno'}</button>`)
        .join('')}</div></div>
    </div>`;
}

function viewEstimates() {
  if (!state.settings) return viewHead('Procena vremena') + loading();
  const s = state.settings;
  const n = (key, label, hint = '') => `<div class="field" data-field="${key}"><label class="field__label" for="s-${key}">${label}</label><input class="input" id="s-${key}" name="${key}" inputmode="numeric" value="${esc(s[key])}">${hint ? `<p class="field__hint">${hint}</p>` : ''}<p class="field__error" role="alert"></p></div>`;
  return `${viewHead('Procena vremena', 'Kupac vidi ove procene kod izbora „Što pre“ i na potvrdi porudžbine.')}
    <form class="aform" data-settings-form novalidate>
      <fieldset class="aform__box"><legend>Preuzimanje (minuta)</legend><div class="field-row field-row--even">${n('pickup_eta_min', 'Najkraće')}${n('pickup_eta_max', 'Najduže')}</div></fieldset>
      <fieldset class="aform__box"><legend>Dostava (minuta)</legend><div class="field-row field-row--even">${n('delivery_eta_min', 'Najkraće')}${n('delivery_eta_max', 'Najduže')}</div></fieldset>
      <fieldset class="aform__box"><legend>Pravila</legend><div class="field-row field-row--even">${n('accept_timeout_min', 'Rok za prihvatanje nove porudžbine (min)')}${n('preorder_days', 'Zakazivanje najviše dana unapred', '0 = samo „Što pre“')}</div>${n('extra_wait_min', 'Gužva — dodatno vreme (min)', 'Dodaje se na sve procene dok ga ne vratite na 0.')}</fieldset>
      <div class="aform__foot"><button type="submit" class="btn btn--gold btn--lg"><span class="btn__label">Sačuvaj procene</span></button></div>
    </form>`;
}

function viewSettings() {
  if (!state.settings) return viewHead('Podešavanja') + loading();
  const s = state.settings;
  const f = (key, label, extra = '') => `<div class="field" data-field="${key}"><label class="field__label" for="s-${key}">${label}</label><input class="input" id="s-${key}" name="${key}" value="${esc(s[key])}" ${extra}><p class="field__error" role="alert"></p></div>`;
  return `${viewHead('Podešavanja', 'Podaci lokala, emailovi i minimalna porudžbina.')}
    <form class="aform" data-settings-form novalidate>
      <fieldset class="aform__box"><legend>Lokal</legend>${f('business_name', 'Naziv')}${f('address_street', 'Adresa')}${f('address_city', 'Grad')}<div class="field-row field-row--even">${f('phone_display', 'Telefon (kako se prikazuje)')}${f('phone_e164', 'Telefon za poziv', 'inputmode="tel"')}</div>${f('email_public', 'Javni email', 'type="email"')}</fieldset>
      <fieldset class="aform__box"><legend>Emailovi za obaveštenja</legend><p class="small muted">Nove porudžbine, poruke sa sajta, prijave za posao sa CV-jem i izveštaji stižu na sve popunjene adrese. Prazno polje se preskače.</p><div class="field-row field-row--even">${f('EMAIL_1', 'EMAIL_1', 'type="email" autocomplete="off"')}${f('EMAIL_2', 'EMAIL_2', 'type="email" autocomplete="off"')}</div><div class="field-row field-row--even">${f('EMAIL_3', 'EMAIL_3', 'type="email" autocomplete="off"')}${f('EMAIL_4', 'EMAIL_4', 'type="email" autocomplete="off"')}</div></fieldset>
      <fieldset class="aform__box"><legend>Porudžbine</legend>${f('min_order_delivery', 'Minimalna porudžbina za dostavu kad zona nema svoj minimum (RSD)', 'inputmode="numeric"')}
        <label class="check"><input type="checkbox" name="customer_confirmation_enabled" ${bool(s.customer_confirmation_enabled) ? 'checked' : ''}><span>Kupac dobija email da je porudžbina primljena</span></label>
        <label class="check"><input type="checkbox" name="customer_status_emails" ${bool(s.customer_status_emails) ? 'checked' : ''}><span>Kupac dobija email kad je porudžbina potvrđena, odbijena ili spremna za preuzimanje</span></label></fieldset>
      <div class="aform__foot"><button type="submit" class="btn btn--gold btn--lg"><span class="btn__label">Sačuvaj podešavanja</span></button></div>
    </form>
    <form class="aform" data-pin-change novalidate>
      <fieldset class="aform__box"><legend>Promena PIN-a</legend><div class="field-row field-row--even"><div class="field" data-field="currentPin"><label class="field__label" for="pin-cur">Trenutni PIN</label><input class="input" id="pin-cur" name="currentPin" type="password" inputmode="numeric" autocomplete="current-password"><p class="field__error" role="alert"></p></div><div class="field" data-field="newPin"><label class="field__label" for="pin-new">Novi PIN (6–8 cifara)</label><input class="input" id="pin-new" name="newPin" type="password" inputmode="numeric" autocomplete="new-password"><p class="field__error" role="alert"></p></div></div><button type="submit" class="btn btn--blue"><span class="btn__label">Promeni PIN</span></button></fieldset>
    </form>
    ${bool(s.test_mode) ? '<p class="notice notice--error">Test režim je uključen: svi emailovi idu samo na test adresu (SETTINGS ▸ test_mode). Pre puštanja u rad isključite ga u tabeli.</p>' : ''}`;
}

async function saveSettings(changes, formEl) {
  const res = await call('admin.settings.save', { changes });
  if (!res.ok) return formEl ? showFormError(formEl, res) : fail(res);
  state.settings = res.data.settings;
  renderView();
  toast({ text: 'Sačuvano. Sajt koristi nove vrednosti za najviše minut.', icon: 'check-circle' });
  refresh();
}

// --- Feedback ------------------------------------------------------------------------------------

function viewFeedback() {
  if (!state.feedback) return viewHead('Feedback') + loading();
  const f = state.feedback;
  const max = Math.max(1, ...f.distribution);
  const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
  return `${viewHead('Feedback kupaca', 'Ocene posle završenih porudžbina.')}
    <div class="kpis"><div class="kpi"><span class="kpi__label">Prosečna ocena</span><span class="kpi__value num">${f.count ? f.average.toFixed(1).replace('.', ',') : '—'}</span></div><div class="kpi"><span class="kpi__label">Broj ocena</span><span class="kpi__value num">${f.count}</span></div></div>
    <div class="dist">${[5, 4, 3, 2, 1].map((n) => `<div class="dist__row"><span>${n} ★</span><i style="--w:${(f.distribution[n - 1] / max) * 100}%"></i><b>${f.distribution[n - 1]}</b></div>`).join('')}</div>
    <ul class="fblist" role="list">${
      f.items
        .map(
          (x) => `<li class="fb"><header><span class="fb__stars" aria-label="${x.rating} od 5">${stars(x.rating)}</span><strong>#${x.orderNumber}</strong><span class="muted small">${esc(x.name)} · ${esc(String(x.createdAt).slice(0, 10).split('-').reverse().join('.'))}</span></header>
          ${x.good.length ? `<p><span class="badge badge--ok">Dobro</span> ${x.good.map(esc).join(', ')}</p>` : ''}
          ${x.improve.length ? `<p><span class="badge badge--bad">Može bolje</span> ${x.improve.map(esc).join(', ')}</p>` : ''}
          ${x.comment ? `<blockquote>${esc(x.comment)}</blockquote>` : ''}</li>`
        )
        .join('') || '<li class="muted">Još nema ocena.</li>'
    }</ul>`;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

async function flagProduct(input) {
  const res = await call('admin.product.flag', { id: input.dataset.id, field: input.dataset.flag, value: input.checked });
  if (!res.ok) {
    input.checked = !input.checked;
    return fail(res);
  }
  const p = state.catalog.products.find((x) => x.id === input.dataset.id);
  if (p) p[input.dataset.flag] = input.checked;
  renderView();
  toast({ text: `${p ? p.name : ''}: ${input.dataset.flag === 'available' ? (input.checked ? 'ponovo dostupno' : 'rasprodato') : input.checked ? 'na meniju' : 'sklonjeno sa menija'}.`, icon: input.checked ? 'check-circle' : 'pause' });
}

async function move(kind, id, dir) {
  const action = { product: 'admin.product.move', category: 'admin.category.move', option: 'admin.option.move', zone: 'admin.zone.move' }[kind];
  const res = await call(action, { id, dir });
  if (!res.ok) return fail(res);
  if (res.data.catalog) state.catalog = res.data.catalog;
  if (res.data.zones) state.zones = res.data.zones;
  renderView();
}

function wire() {
  const r = root();
  window.addEventListener('hashchange', () => state.token && setView(viewFromHash()));
  on(r, 'click', '[data-status]', (e, b) => {
    if (b.dataset.confirm && !window.confirm(b.dataset.confirm)) return;
    unlockAudio();
    setStatus(b.dataset.id, b.dataset.status);
  });
  on(r, 'click', '[data-detail]', (e, el) => {
    if (e.target.closest('a, button:not([data-detail])')) return;
    openOrder(el.dataset.detail);
  });
  on(r, 'keydown', 'tr[data-detail]', (e, el) => {
    if (e.key === 'Enter') openOrder(el.dataset.detail);
  });
  on(r, 'click', '[data-silence]', silence);
  on(r, 'click', '[data-drawer-close]', closeDrawer);
  on(r, 'click', '[data-sound]', (e, b) => {
    state.sound = !state.sound;
    local.set(SOUND_KEY, state.sound);
    unlockAudio();
    b.innerHTML = icon(state.sound ? 'bell' : 'bell-off');
    b.setAttribute('aria-pressed', String(state.sound));
    b.setAttribute('aria-label', state.sound ? 'Isključi zvuk' : 'Uključi zvuk');
    if (state.sound) chime();
    toast({ text: state.sound ? 'Zvuk za nove porudžbine je uključen.' : 'Zvuk je isključen. Nove porudžbine i dalje trepere na ekranu.', icon: state.sound ? 'bell' : 'bell-off' });
  });
  on(r, 'click', '[data-logout]', () => {
    local.remove(TOKEN_KEY);
    state.token = null;
    if (state.wake) state.wake.release().catch(() => {});
    renderLogin('Odjavljeni ste.');
  });
  // History
  on(r, 'submit', '[data-history-form]', (e, f) => {
    e.preventDefault();
    const fd = new FormData(f);
    Object.assign(state.history, { q: fd.get('q') || '', date: fd.get('date') || '', status: fd.get('status') || '' });
    searchHistory(0);
  });
  on(r, 'click', '[data-history-more]', () => searchHistory(state.history.page + 1));
  // Products
  on(r, 'click', '[data-product-filter]', (e, b) => {
    state.productFilter = b.dataset.productFilter;
    renderView();
  });
  on(
    r,
    'input',
    '[name="productSearch"]',
    debounce((e) => {
      state.productSearch = e.target.value;
      renderView();
    }, 200)
  );
  on(r, 'change', '[data-flag]', (e, input) => flagProduct(input));
  on(r, 'click', '[data-move]', (e, b) => move(b.dataset.move, b.dataset.id, b.dataset.dir));
  on(r, 'click', '[data-edit-product]', (e, b) => {
    const p = b.dataset.editProduct ? state.catalog.products.find((x) => x.id === b.dataset.editProduct) : { categoryId: state.productFilter || state.catalog.categories[0].id, active: true, available: true, delivery: true, pickup: true, groups: [], defaults: [], tags: [] };
    openDrawer(p.id ? `Izmena: ${p.name}` : 'Novi proizvod', productForm(p));
  });
  on(r, 'submit', '[data-product-form]', (e, f) => {
    e.preventDefault();
    saveProduct(f);
  });
  on(r, 'change', '[data-upload]', (e, input) => uploadImage(input));
  on(r, 'change', '[data-product-form] [name="groups"]', (e, cb) => {
    const box = cb.closest('[data-gpick]');
    box.classList.toggle('is-on', cb.checked);
    box.querySelector('.gpick__defaults').hidden = !cb.checked;
  });
  on(r, 'input', '[data-product-form] [name="image"], [data-product-form] [name="name"]', (e, el) => updatePreview(el.closest('form')));
  on(r, 'change', '[data-product-form] [name="art"], [data-product-form] [name="categoryId"]', (e, el) => updatePreview(el.closest('form')));
  // Categories
  on(r, 'click', '[data-edit-category]', (e, b) => {
    const c = b.dataset.editCategory ? state.catalog.categories.find((x) => x.id === b.dataset.editCategory) : { active: true };
    openDrawer(c.id ? `Kategorija: ${c.name}` : 'Nova kategorija', categoryForm(c));
  });
  on(r, 'submit', '[data-category-form]', (e, f) => {
    e.preventDefault();
    saveCategory(f);
  });
  on(r, 'change', '[data-category-toggle]', (e, input) => {
    const c = state.catalog.categories.find((x) => x.id === input.dataset.categoryToggle);
    saveCategory(null, { ...c, active: input.checked });
  });
  // Add-ons
  on(r, 'click', '[data-edit-group]', (e, b) => {
    const g = b.dataset.editGroup ? state.catalog.groups.find((x) => x.id === b.dataset.editGroup) : { type: 'multi', display: 'chips', max: 0 };
    openDrawer(g.id ? `Grupa: ${g.name}` : 'Nova grupa dodataka', groupForm(g));
  });
  on(r, 'submit', '[data-group-form]', async (e, f) => {
    e.preventDefault();
    const v = formValues(f);
    const res = await call('admin.group.save', { group: { id: f.dataset.id || undefined, name: v.name, type: v.type, max: v.max, display: v.display, required: v.required, hint: v.hint } });
    if (!res.ok) return showFormError(f, res);
    state.catalog = res.data.catalog;
    closeDrawer();
    renderView();
    toast({ text: `Grupa „${v.name}“ je sačuvana.`, icon: 'check-circle' });
  });
  on(r, 'click', '[data-edit-option]', (e, b) => {
    const o = b.dataset.editOption ? state.catalog.options.find((x) => x.id === b.dataset.editOption) : { groupId: b.dataset.group, price: 0, available: true };
    openDrawer(o.id ? `Opcija: ${o.name}` : 'Nova opcija', optionForm(o));
  });
  const saveOption = async (f, override) => {
    const v = override || formValues(f);
    const res = await call('admin.option.save', { option: { id: (f ? f.dataset.id : v.id) || undefined, groupId: f ? f.dataset.group : v.groupId, name: v.name, price: v.price, available: v.available } });
    if (!res.ok) return f ? showFormError(f, res) : fail(res);
    state.catalog = res.data.catalog;
    if (f) closeDrawer();
    renderView();
    toast({ text: `Opcija „${v.name}“ je sačuvana.`, icon: 'check-circle' });
  };
  on(r, 'submit', '[data-option-form]', (e, f) => {
    e.preventDefault();
    saveOption(f);
  });
  on(r, 'change', '[data-option-toggle]', (e, input) => {
    const o = state.catalog.options.find((x) => x.id === input.dataset.optionToggle);
    saveOption(null, { ...o, available: input.checked });
  });
  // Zones
  on(r, 'click', '[data-edit-zone]', (e, b) => {
    const z = b.dataset.editZone ? state.zones.zones.find((x) => x.id === b.dataset.editZone) : { active: true, minOrder: 500 };
    openDrawer(z.id ? `Zona: ${z.name}` : 'Nova zona', zoneForm(z));
  });
  on(r, 'submit', '[data-zone-form]', (e, f) => {
    e.preventDefault();
    saveZone(f);
  });
  on(r, 'change', '[data-zone-toggle]', (e, input) => {
    const z = state.zones.zones.find((x) => x.id === input.dataset.zoneToggle);
    saveZone(null, { ...z, active: input.checked });
  });
  // Hours
  on(r, 'submit', '[data-hours-form]', (e, f) => {
    e.preventDefault();
    saveHours(f);
  });
  on(r, 'change', '[data-hours-form] [name$=".open_day"]', (e, cb) => cb.closest('tr').classList.toggle('is-closed', !cb.checked));
  // Settings
  on(r, 'change', '[data-setting-toggle]', (e, input) => {
    const key = input.dataset.settingToggle;
    if (!input.checked && key === 'ordering_enabled' && !window.confirm('Pauzirati online poručivanje? Kupci će videti da trenutno ne primamo porudžbine.')) {
      input.checked = true;
      return;
    }
    saveSettings({ [key]: input.checked });
  });
  on(r, 'click', '[data-busy]', (e, b) => saveSettings({ extra_wait_min: Number(b.dataset.busy) }));
  on(r, 'submit', '[data-settings-form]', (e, f) => {
    e.preventDefault();
    const changes = {};
    f.querySelectorAll('input[name], select[name], textarea[name]').forEach((el) => {
      changes[el.name] = el.type === 'checkbox' ? el.checked : el.value;
    });
    saveSettings(changes, f);
  });
  on(r, 'submit', '[data-pin-change]', async (e, f) => {
    e.preventDefault();
    const v = formValues(f);
    const res = await call('admin.pin.change', { currentPin: v.currentPin, newPin: v.newPin });
    if (!res.ok) return showFormError(f, res);
    if (res.data.token) keepSession(res.data.token, res.data.expiresAt);
    f.reset();
    toast({ text: 'PIN je promenjen. Svi drugi uređaji su odjavljeni i prijavljuju se novim PIN-om.', icon: 'lock', timeout: 8000 });
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.token) {
      refresh();
      keepScreenOn();
    }
  });
  window.addEventListener('resize', debounce(measureBar, 150));
  // Countdown ticks every second without re-rendering whole cards.
  setInterval(() => {
    if (!state.board) return;
    $$('[data-countdown]').forEach((el) => {
      const o = findOrder(el.dataset.countdown);
      if (!o || o.status !== 'NEW') return;
      el.textContent = countdownText(o);
      const late = isOverdue(o);
      if (late !== el.classList.contains('is-late')) {
        el.classList.toggle('is-late', late);
        const card = el.closest('.pcard');
        if (card) card.classList.toggle('is-overdue', late);
        renderAlert();
      }
    });
    tickClock();
  }, 1000);
}

function init() {
  wire();
  const saved = local.get(TOKEN_KEY);
  // The server decides whether the session is still valid (a tablet with a wrong clock must not force a PIN on
  // every reload); an expired token simply gets UNAUTHORIZED on the first poll and the PIN screen.
  if (saved && typeof saved.token === 'string' && saved.token) {
    state.token = saved.token;
    state.expiresAt = saved.expiresAt;
    state.poll = saved.poll || 10;
    renderShell();
    refresh();
    keepScreenOn();
    // Browsers only allow sound after a tap on the page.
    document.addEventListener('pointerdown', unlockAudio, { once: true });
    toast({ text: 'Dodirnite ekran jednom da uključite zvuk za nove porudžbine.', icon: 'bell', timeout: 8000 });
  } else {
    renderLogin();
  }
}

init();
