// /panel/ — the shop's tablet. PIN login, live orders with a sound alert, one-tap statuses,
// sold-out switches, pause and "busy" time. Built for a weak connection: polling with backoff.
import Money from '../shared/money.cjs';
import { $, $$, on, esc, icon } from '../core/dom.js';
import { apiPost } from '../core/api.js';
import { local } from '../core/storage.js';
import { toast } from '../ui/toast.js';

const TOKEN_KEY = 'gg:panel:v1';
const SOUND_KEY = 'gg:panel:sound';
const root = () => $('[data-panel]');

const state = {
  token: null,
  expiresAt: 0,
  orders: [],
  products: [],
  settings: { orderingEnabled: true, extraWaitMin: 0 },
  seen: new Set(),
  sound: local.get(SOUND_KEY) !== false,
  audio: null,
  poll: 10,
  timer: null,
  failures: 0,
  alarmTimer: null,
  serverOffset: 0,
  busy: new Set()
};

const LABEL = {
  NEW: 'Nova',
  ACCEPTED: 'Prihvaćena',
  PREPARING: 'U pripremi',
  READY: 'Spremna',
  OUT_FOR_DELIVERY: 'Na putu',
  COMPLETED: 'Završena',
  CANCELLED: 'Otkazana',
  FAILED: 'Neuspela'
};

// ---------------------------------------------------------------------------
// Sound: Web Audio chime (no file download, works offline), unlocked by the PIN tap.
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
  if (!state.sound || !state.audio) return;
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

function syncAlarm() {
  const pending = state.orders.filter((o) => o.status === 'NEW').length;
  document.title = pending ? `(${pending}) NOVA PORUDŽBINA — Grčki Giros` : 'Panel — Grčki Giros';
  document.body.classList.toggle('has-new', pending > 0);
  clearInterval(state.alarmTimer);
  if (pending) state.alarmTimer = setInterval(chime, 15000);
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

function renderLogin(message) {
  clearTimeout(state.timer);
  clearInterval(state.alarmTimer);
  document.body.classList.remove('has-new');
  root().innerHTML = `<div class="pin">
    <div class="pin__brand"><svg class="brand__mark" aria-hidden="true"><use href="${window.GG.assets.icons}#i-meander"/></svg><strong>Grčki Giros</strong><span>Panel porudžbina</span></div>
    <form class="pin__form" data-pin-form>
      <label class="pin__label" for="pin">Unesite PIN</label>
      <input class="pin__input" id="pin" name="pin" type="password" inputmode="numeric" autocomplete="off" maxlength="8" pattern="[0-9]*" required>
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
    const res = await apiPost('panel.login', { pin: input.value });
    if (!res.ok) {
      renderLogin(res.error.message);
      return;
    }
    state.token = res.data.token;
    state.expiresAt = res.data.expiresAt;
    state.poll = res.data.pollSeconds || 10;
    local.set(TOKEN_KEY, { token: state.token, expiresAt: state.expiresAt, poll: state.poll });
    renderShell();
    refresh();
  });
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

function renderShell() {
  root().innerHTML = `<header class="pbar">
      <div class="pbar__brand"><svg class="brand__mark" aria-hidden="true"><use href="${window.GG.assets.icons}#i-meander"/></svg><strong>Grčki Giros</strong><span class="pbar__clock" data-clock></span></div>
      <span class="pbar__conn" data-conn><i></i><span>Povezivanje…</span></span>
      <label class="switch pbar__switch"><span>Primamo porudžbine</span><input type="checkbox" data-ordering></label>
      <div class="pbar__busy" role="group" aria-label="Gužva"><span>Gužva</span>${[0, 15, 30]
        .map((m) => `<button type="button" class="chip" data-busy="${m}" aria-pressed="false">${m ? '+' + m : 'Ne'}</button>`)
        .join('')}</div>
      <button type="button" class="icon-btn" data-sound aria-label="Zvuk">${icon(state.sound ? 'bell' : 'bell-off')}</button>
      <button type="button" class="btn btn--sm btn--ghost" data-open-products><span class="btn__label">Rasprodato</span></button>
      <button type="button" class="text-btn" data-logout>Odjava</button>
    </header>
    <main class="board">
      <section class="col col--new"><h2>Nove <b data-count="new">0</b></h2><div data-col="new"></div></section>
      <section class="col"><h2>U radu <b data-count="work">0</b></h2><div data-col="work"></div></section>
      <section class="col"><h2>Spremne · na putu <b data-count="ready">0</b></h2><div data-col="ready"></div></section>
      <section class="col col--done"><h2>Završene danas <b data-count="done">0</b></h2><div data-col="done"></div></section>
    </main>
    <div class="overlay drawer" data-products-drawer hidden>
      <div class="overlay__scrim" data-close-products></div>
      <aside class="overlay__panel" role="dialog" aria-modal="true" aria-label="Rasprodato">
        <header class="overlay__head"><h2 class="h3">Dostupnost</h2><button type="button" class="icon-btn" data-close-products aria-label="Zatvori">${icon('close')}</button></header>
        <div class="overlay__body" data-products></div>
      </aside>
    </div>`;
  tickClock();
}

function tickClock() {
  const c = $('[data-clock]');
  if (c) c.textContent = new Date(Date.now() + state.serverOffset).toLocaleTimeString('sr-Latn-RS', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Belgrade' });
}

function ageLabel(iso) {
  const mins = Math.max(0, Math.round((Date.now() + state.serverOffset - Date.parse(iso)) / 60000));
  if (mins < 1) return 'upravo';
  if (mins < 60) return `pre ${mins} min`;
  return `pre ${Math.floor(mins / 60)} h ${mins % 60} min`;
}

function actionsFor(o) {
  const b = (status, label, cls = 'btn--blue') => `<button type="button" class="btn btn--sm ${cls}" data-status="${status}" data-id="${esc(o.id)}"><span class="btn__label">${label}</span></button>`;
  const cancel = `<button type="button" class="text-btn" data-status="CANCELLED" data-id="${esc(o.id)}" data-confirm="Otkazati porudžbinu #${o.publicNumber}?">Otkaži</button>`;
  switch (o.status) {
    case 'NEW':
      return b('ACCEPTED', 'Prihvati', 'btn--gold btn--lg') + `<button type="button" class="text-btn" data-status="CANCELLED" data-id="${esc(o.id)}" data-confirm="Odbiti porudžbinu #${o.publicNumber}? Pozovite kupca da mu javite.">Odbij</button>`;
    case 'ACCEPTED':
      return b('PREPARING', 'U pripremi') + cancel;
    case 'PREPARING':
      return b('READY', 'Spremno', 'btn--gold') + cancel;
    case 'READY':
      return (o.mode === 'delivery' ? b('OUT_FOR_DELIVERY', 'Predato kuriru') : b('COMPLETED', 'Preuzeto', 'btn--gold')) + cancel;
    case 'OUT_FOR_DELIVERY':
      return b('COMPLETED', 'Isporučeno', 'btn--gold') + `<button type="button" class="text-btn" data-status="FAILED" data-id="${esc(o.id)}" data-confirm="Označiti #${o.publicNumber} kao neisporučenu?">Nije isporučeno</button>`;
    default:
      return '';
  }
}

function card(o) {
  const isDelivery = o.mode === 'delivery';
  const when = o.when === 'asap' ? `ŠTO PRE · oko ${esc(o.promisedTime)}` : `ZAKAZANO ${esc(o.when)}`;
  const phone = o.customer.phoneDisplay || o.customer.phone;
  const maps = o.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.address.line + ', Novi Sad')}` : '';
  return `<article class="pcard pcard--${o.status.toLowerCase()}${state.busy.has(o.id) ? ' is-busy' : ''}" data-order="${esc(o.id)}">
    <header class="pcard__head">
      <span class="pcard__num">#${o.publicNumber}</span>
      <span class="pcard__type pcard__type--${o.mode}">${isDelivery ? 'Dostava' : 'Preuzimanje'}</span>
      <span class="pcard__status">${LABEL[o.status] || o.status}</span>
    </header>
    <p class="pcard__when"><strong>${when}</strong> <span>primljena ${esc(o.createdLabel)} · ${ageLabel(o.createdAt)}</span></p>
    <p class="pcard__who"><strong>${esc(o.customer.name)}</strong> <a href="tel:${esc(o.customer.phone)}">${icon('phone')}${esc(phone)}</a></p>
    ${o.address ? `<p class="pcard__addr"><a href="${maps}" target="_blank" rel="noopener">${icon('pin')}${esc(o.address.line)}${o.address.apt ? ', ' + esc(o.address.apt) : ''}</a>${o.address.zone ? ` <small>${esc(o.address.zone)}</small>` : ''}${o.address.note ? `<small>Kurir: ${esc(o.address.note)}</small>` : ''}</p>` : ''}
    <ul class="pcard__items" role="list">${(o.items || [])
      .map((l) => `<li><b>${l.qty}×</b> <span><strong>${esc(l.name)}</strong>${l.summary ? `<small>${esc(l.summary)}</small>` : ''}${l.removedSummary ? `<small class="bez">${esc(l.removedSummary)}</small>` : ''}${l.note ? `<small class="note">„${esc(l.note)}“</small>` : ''}</span></li>`)
      .join('')}</ul>
    ${o.note ? `<p class="pcard__note">${icon('note')}${esc(o.note)}</p>` : ''}
    <p class="pcard__money"><span>Ukupno <strong>${esc(Money.formatRSD(o.total))}</strong></span>${isDelivery && o.cash !== '' ? `<span>Plaća ${esc(Money.formatRSD(o.cash))} · kusur <strong>${esc(Money.formatRSD(o.change))}</strong></span>` : '<span>Plaća na kasi</span>'}</p>
    <footer class="pcard__actions">${actionsFor(o)}</footer>
  </article>`;
}

function renderBoard() {
  const groups = { new: [], work: [], ready: [], done: [] };
  state.orders.forEach((o) => {
    if (o.status === 'NEW') groups.new.push(o);
    else if (o.status === 'ACCEPTED' || o.status === 'PREPARING') groups.work.push(o);
    else if (o.status === 'READY' || o.status === 'OUT_FOR_DELIVERY') groups.ready.push(o);
    else groups.done.push(o);
  });
  groups.new.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  groups.work.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  Object.entries(groups).forEach(([k, list]) => {
    const col = $(`[data-col="${k}"]`);
    if (!col) return;
    col.innerHTML = list.length ? list.map(card).join('') : `<p class="col__empty">${k === 'new' ? 'Nema novih porudžbina.' : '—'}</p>`;
    $(`[data-count="${k}"]`).textContent = String(list.length);
  });
  const ordering = $('[data-ordering]');
  if (ordering) ordering.checked = !!state.settings.orderingEnabled;
  $$('[data-busy]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.busy) === Number(state.settings.extraWaitMin))));
  document.body.classList.toggle('is-paused', !state.settings.orderingEnabled);
  renderProducts();
  syncAlarm();
}

function renderProducts() {
  const box = $('[data-products]');
  if (!box) return;
  let lastCat = '';
  box.innerHTML = state.products
    .map((p) => {
      const head = p.category !== lastCat ? `<h3 class="pl__cat">${esc(p.category)}</h3>` : '';
      lastCat = p.category;
      return `${head}<label class="switch pl__row"><span>${esc(p.name)}</span><input type="checkbox" data-product-toggle="${esc(p.id)}" ${p.available ? 'checked' : ''}></label>`;
    })
    .join('');
}

function setConn(ok, text) {
  const c = $('[data-conn]');
  if (!c) return;
  c.classList.toggle('is-ok', ok);
  c.classList.toggle('is-bad', !ok);
  c.querySelector('span').textContent = text;
}

async function refresh() {
  clearTimeout(state.timer);
  const res = await apiPost('panel.orders', { token: state.token }, { timeoutMs: 15000 });
  if (!res.ok) {
    if (res.error.code === 'UNAUTHORIZED') {
      local.remove(TOKEN_KEY);
      renderLogin(res.error.message);
      return;
    }
    state.failures++;
    setConn(false, `Nema veze (${state.failures}) — pokušavam ponovo`);
    state.timer = setTimeout(refresh, Math.min(60, state.poll * Math.pow(1.6, state.failures)) * 1000);
    return;
  }
  state.failures = 0;
  state.serverOffset = res.data.serverNow - Date.now();
  const fresh = res.data.orders.filter((o) => o.status === 'NEW' && !state.seen.has(o.id));
  const firstLoad = state.seen.size === 0 && state.orders.length === 0;
  res.data.orders.forEach((o) => state.seen.add(o.id));
  state.orders = res.data.orders;
  state.products = res.data.products;
  state.settings = res.data.settings;
  renderBoard();
  setConn(true, `Povezano · ${new Date(Date.now() + state.serverOffset).toLocaleTimeString('sr-Latn-RS', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Belgrade' })}`);
  if (fresh.length && !firstLoad) {
    chime();
    toast({ text: fresh.length === 1 ? `Nova porudžbina #${fresh[0].publicNumber}` : `${fresh.length} nove porudžbine`, icon: 'bell', timeout: 6000 });
  } else if (fresh.length && firstLoad) chime();
  tickClock();
  state.timer = setTimeout(refresh, state.poll * 1000);
}

async function setStatus(id, status) {
  const o = state.orders.find((x) => x.id === id);
  if (!o) return;
  const previous = o.status;
  o.status = status;
  state.busy.add(id);
  renderBoard();
  const res = await apiPost('panel.status', { token: state.token, orderId: id, status });
  state.busy.delete(id);
  if (!res.ok) {
    o.status = previous;
    renderBoard();
    toast({ text: res.error.message || 'Promena nije sačuvana.', tone: 'error', icon: 'alert' });
    if (res.error.code === 'UNAUTHORIZED') renderLogin(res.error.message);
    return;
  }
  Object.assign(o, res.data);
  renderBoard();
}

function wire() {
  const r = root();
  on(r, 'click', '[data-status]', (e, b) => {
    if (b.dataset.confirm && !window.confirm(b.dataset.confirm)) return;
    unlockAudio();
    setStatus(b.dataset.id, b.dataset.status);
  });
  on(r, 'change', '[data-ordering]', async (e, input) => {
    const want = input.checked;
    if (!want && !window.confirm('Pauzirati poručivanje preko sajta? Gosti će videti da trenutno ne primamo porudžbine.')) {
      input.checked = true;
      return;
    }
    const res = await apiPost('panel.settings', { token: state.token, orderingEnabled: want });
    if (!res.ok) {
      input.checked = !want;
      toast({ text: res.error.message, tone: 'error', icon: 'alert' });
      return;
    }
    state.settings.orderingEnabled = want;
    renderBoard();
    toast({ text: want ? 'Sajt ponovo prima porudžbine.' : 'Poručivanje je pauzirano.', icon: want ? 'check-circle' : 'pause' });
  });
  on(r, 'click', '[data-busy]', async (e, b) => {
    const extra = Number(b.dataset.busy);
    const res = await apiPost('panel.settings', { token: state.token, extraWaitMin: extra });
    if (!res.ok) {
      toast({ text: res.error.message, tone: 'error', icon: 'alert' });
      return;
    }
    state.settings.extraWaitMin = extra;
    renderBoard();
    toast({ text: extra ? `Gostima prikazujemo +${extra} min.` : 'Vreme čekanja je normalno.', icon: 'clock' });
  });
  on(r, 'click', '[data-sound]', (e, b) => {
    state.sound = !state.sound;
    local.set(SOUND_KEY, state.sound);
    unlockAudio();
    b.innerHTML = icon(state.sound ? 'bell' : 'bell-off');
    if (state.sound) chime();
  });
  on(r, 'click', '[data-open-products]', () => {
    const d = $('[data-products-drawer]');
    d.hidden = false;
    requestAnimationFrame(() => d.classList.add('is-open'));
  });
  on(r, 'click', '[data-close-products]', () => {
    const d = $('[data-products-drawer]');
    d.classList.remove('is-open');
    setTimeout(() => (d.hidden = true), 400);
  });
  on(r, 'change', '[data-product-toggle]', async (e, input) => {
    const id = input.dataset.productToggle;
    const res = await apiPost('panel.availability', { token: state.token, productId: id, available: input.checked });
    if (!res.ok) {
      input.checked = !input.checked;
      toast({ text: res.error.message, tone: 'error', icon: 'alert' });
      return;
    }
    const p = state.products.find((x) => x.id === id);
    if (p) p.available = input.checked;
    toast({ text: `${p ? p.name : id}: ${input.checked ? 'ponovo dostupno' : 'rasprodato'}.`, icon: input.checked ? 'check-circle' : 'pause' });
  });
  on(r, 'click', '[data-logout]', () => {
    local.remove(TOKEN_KEY);
    state.token = null;
    renderLogin('Odjavljeni ste.');
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.token) refresh();
  });
  setInterval(() => {
    tickClock();
    $$('[data-order]').length && state.orders.length && renderBoard();
  }, 60000);
}

function init() {
  wire();
  const saved = local.get(TOKEN_KEY);
  if (saved && saved.token && saved.expiresAt > Date.now()) {
    state.token = saved.token;
    state.expiresAt = saved.expiresAt;
    state.poll = saved.poll || 10;
    renderShell();
    refresh();
    // Browsers only allow sound after a tap on the page.
    document.addEventListener('pointerdown', unlockAudio, { once: true });
    toast({ text: 'Dodirnite ekran jednom da uključite zvuk za nove porudžbine.', icon: 'bell', timeout: 8000 });
  } else {
    renderLogin();
  }
}

init();
