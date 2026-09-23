// Apps Script client. GET for reads, POST text/plain for writes (no CORS preflight).
// Every failure comes back as { ok:false, error:{ code, message } } with a sentence a guest can act on.
import { env } from './dom.js';

const NETWORK_MESSAGE = 'Nema veze sa serverom. Proverite internet i pokušajte ponovo.';
const TIMEOUT_MESSAGE = 'Server se ne javlja. Pokušajte ponovo.';

function devParams() {
  // Local development only (never in production builds): E2E tests pin the emulator clock
  // for the whole visit (__now survives navigation) and inject one-off failures (__fail).
  const e = env();
  if (e.env !== 'dev') return '';
  const q = new URLSearchParams(location.search);
  const out = new URLSearchParams();
  let pinned = q.get('__now');
  try {
    if (pinned) sessionStorage.setItem('gg:dev-now', pinned);
    else pinned = sessionStorage.getItem('gg:dev-now');
  } catch {
    /* storage blocked */
  }
  if (pinned) out.set('__now', pinned);
  if (q.get('__fail')) out.set('__fail', q.get('__fail'));
  const s = out.toString();
  return s ? '&' + s : '';
}

async function request(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, redirect: 'follow', credentials: 'omit' });
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return { ok: false, error: { code: 'BAD_RESPONSE', message: NETWORK_MESSAGE } };
    }
    return body && typeof body === 'object' ? body : { ok: false, error: { code: 'BAD_RESPONSE', message: NETWORK_MESSAGE } };
  } catch (err) {
    if (err.name === 'AbortError') return { ok: false, error: { code: 'TIMEOUT', message: TIMEOUT_MESSAGE } };
    return { ok: false, error: { code: 'NETWORK', message: NETWORK_MESSAGE } };
  } finally {
    clearTimeout(timer);
  }
}

export function apiGet(action, params = {}, { timeoutMs = 9000 } = {}) {
  const q = new URLSearchParams({ action, ...params }).toString();
  return request(`${env().api}?${q}${devParams()}`, { method: 'GET' }, timeoutMs);
}

export function apiPost(action, payload, { timeoutMs = 25000 } = {}) {
  const sep = env().api.includes('?') ? '&' : '?';
  const dev = devParams();
  return request(
    `${env().api}${dev ? sep + dev.slice(1) : ''}`,
    { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, payload }) },
    timeoutMs
  );
}
