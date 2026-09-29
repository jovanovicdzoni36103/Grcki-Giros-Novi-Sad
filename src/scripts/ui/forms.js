// Contact and job forms: inline validation, honeypot, idempotent submit, clear success and error states.
import { esc, icon, uuid } from '../core/dom.js';
import { apiPost } from '../core/api.js';
import { business } from '../core/catalog.js';

export function setError(form, name, message) {
  const field = form.querySelector(`[data-field="${name}"]`);
  if (!field) return false;
  field.classList.toggle('has-error', !!message);
  const err = field.querySelector('.field__error');
  if (err) err.innerHTML = message ? `${icon('alert')}<span>${esc(message)}</span>` : '';
  const input = field.querySelector('input, textarea, select');
  if (input) input.setAttribute('aria-invalid', message ? 'true' : 'false');
  return true;
}

/**
 * bindForm(form, { action, collect(form) → payload, validate(payload) → {ok, errors}, success(html) })
 */
export function bindForm(form, { action, collect, validate, successHtml }) {
  const started = performance.now();
  const status = form.querySelector('[data-form-status]');
  const button = form.querySelector('[type="submit"]');
  let requestId = uuid();
  let busy = false;

  form.addEventListener('focusout', async (e) => {
    const field = e.target.closest('[data-field]');
    if (!field || !field.classList.contains('has-error')) return;
    const v = validate(await collect(form, { lite: true }));
    setError(form, field.dataset.field, v.errors[field.dataset.field] || '');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    // collect() reads the CV file asynchronously: a second click during that read must not send a second copy.
    busy = true;
    const payload = await collect(form);
    const v = validate(payload);
    form.querySelectorAll('[data-field]').forEach((f) => setError(form, f.dataset.field, ''));
    if (!v.ok) {
      busy = false;
      Object.entries(v.errors).forEach(([k, m]) => setError(form, k, m));
      const first = form.querySelector('.has-error input, .has-error textarea, .has-error select');
      if (first) first.focus();
      return;
    }
    button.classList.add('is-busy');
    button.disabled = true;
    status.hidden = true;
    const res = await apiPost(action, { ...payload, requestId, meta: { elapsedMs: Math.round(performance.now() - started), hp: form.querySelector('[name="website"]')?.value || '' } }, { timeoutMs: 30000 });
    busy = false;
    button.classList.remove('is-busy');
    button.disabled = false;
    if (res.ok) {
      form.innerHTML = successHtml(payload);
      form.classList.add('is-sent');
      form.querySelector('[data-success]')?.focus();
      return;
    }
    const err = res.error || {};
    if (err.code === 'VALIDATION' && (err.fields || err.field)) {
      Object.entries(err.fields || { [err.field]: err.message }).forEach(([k, m]) => setError(form, k, m));
    }
    const phone = business().phone_display || '';
    status.hidden = false;
    status.className = 'notice notice--error';
    status.innerHTML = `${icon('alert')}<span>${esc(err.message || 'Slanje nije uspelo.')} ${
      ['NETWORK', 'TIMEOUT', 'SERVER_ERROR', 'BAD_RESPONSE'].includes(err.code) ? `Pokušajte ponovo ili pozovite ${esc(phone)}.` : ''
    }</span>`;
    // The first copy may still be running (BUSY) or may have arrived (NETWORK/TIMEOUT): a retry keeps its id.
    if (!['NETWORK', 'TIMEOUT', 'BUSY'].includes(err.code)) requestId = uuid();
  });
}
