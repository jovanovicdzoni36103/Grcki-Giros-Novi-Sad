// EMAIL_1…EMAIL_4: one place in SETTINGS for everyone on the shop side who gets email.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { freshBackend, placeOrder, setSettings } from './helpers.mjs';

const meta = { elapsedMs: 30000, hp: '' };
const pdf = Buffer.from('%PDF-1.4\n%%EOF').toString('base64');
const SLOTS = (a = '', b = '', c = '', d = '') => ({ EMAIL_1: a, EMAIL_2: b, EMAIL_3: c, EMAIL_4: d });

/** Every kind of staff email once: new order, contact message, job application with CV, daily report. */
function everyChannel(emu) {
  assert.equal(placeOrder(emu).ok, true);
  assert.equal(emu.doPost({ action: 'contact.submit', payload: { requestId: randomUUID(), name: 'Jelena Petrović', phone: '063 555 1234', email: '', topic: 'Pitanje', message: 'Da li radite nedeljom?', meta } }).ok, true);
  const job = emu.doPost({ action: 'jobs.submit', payload: { requestId: randomUUID(), name: 'Marko Ilić', phone: '062 111 2233', email: '', position: '', message: '', cv: { name: 'cv.pdf', type: 'application/pdf', data: pdf }, meta } });
  assert.equal(job.ok, true, JSON.stringify(job.error));
  emu.setNow('2026-09-24T01:15:00+02:00');
  emu.run('dailyReport_', { force: true });
  const staff = (re) => emu.state.outbox.filter((m) => re.test(m.subject)).map((m) => m.to).sort();
  return {
    order: staff(/^#1001 · /),
    contact: staff(/^Poruka sa sajta/),
    cv: staff(/^Prijava za posao/),
    cvAttachment: emu.state.outbox.filter((m) => /^Prijava za posao/.test(m.subject)).every((m) => m.attachments.length === 1),
    report: staff(/izveštaj/i)
  };
}

test('EMAIL_1 filled, EMAIL_2–4 empty: everything goes to EMAIL_1, empty slots are silently skipped', () => {
  const emu = freshBackend({ settings: SLOTS('nikola.jovanovic.mef@gmail.com') });
  const sent = everyChannel(emu);
  const one = ['nikola.jovanovic.mef@gmail.com'];
  assert.deepEqual([sent.order, sent.contact, sent.cv, sent.report], [one, one, one, one]);
  assert.equal(sent.cvAttachment, true, 'CV is attached');
  assert.equal(emu.state.outbox.filter((m) => !m.to).length, 0, 'nothing sent to an empty address');
  assert.deepEqual(emu.rows('ERROR_LOG'), []);
  assert.equal(emu.rows('ORDERS')[0]['Email Status'], 'SENT 1');
});

test('two slots filled (EMAIL_1 and EMAIL_3): both get every email; filling a slot needs no code change', () => {
  const emu = freshBackend({ settings: SLOTS('nikola.jovanovic.mef@gmail.com', '', 'nikola.culiflow@gmail.com') });
  const sent = everyChannel(emu);
  const two = ['nikola.culiflow@gmail.com', 'nikola.jovanovic.mef@gmail.com'];
  assert.deepEqual([sent.order, sent.contact, sent.cv, sent.report], [two, two, two, two]);
  assert.equal(emu.rows('ORDERS')[0]['Email Status'], 'SENT 2');
});

test('all four slots, a mistyped one and a duplicate: the typo is skipped and logged, duplicates get one email', () => {
  const emu = freshBackend({ settings: SLOTS('a@grckigiros.test', 'nije-email', 'A@grckigiros.test ', 'd@grckigiros.test') });
  assert.equal(placeOrder(emu).ok, true);
  assert.deepEqual(emu.state.outbox.filter((m) => /^#1001/.test(m.subject)).map((m) => m.to).sort(), ['a@grckigiros.test', 'd@grckigiros.test']);
  assert.ok(emu.rows('SYSTEM_LOG').some((l) => /EMAIL_2 nije ispravna email adresa/.test(l.Message)));
  assert.deepEqual(emu.rows('ERROR_LOG'), []);
});

test('all slots empty: the order is still saved and on the admin board, email is skipped without an error', () => {
  const emu = freshBackend({ settings: SLOTS() });
  const r = placeOrder(emu);
  assert.equal(r.ok, true);
  assert.equal(emu.rows('ORDERS').length, 1);
  assert.match(emu.rows('ORDERS')[0]['Email Status'], /^SKIPPED \(no_recipients\)/);
  assert.deepEqual(emu.rows('ERROR_LOG'), []);
});

test('changing a slot later takes effect on the next email (SETTINGS is the only place)', () => {
  const emu = freshBackend({ settings: SLOTS('prvi@grckigiros.test') });
  placeOrder(emu);
  setSettings(emu, { EMAIL_2: 'drugi@grckigiros.test' });
  placeOrder(emu, { customer: { phone: '0647778899' } });
  assert.deepEqual(emu.state.outbox.filter((m) => /^#1002/.test(m.subject)).map((m) => m.to).sort(), ['drugi@grckigiros.test', 'prvi@grckigiros.test']);
});
