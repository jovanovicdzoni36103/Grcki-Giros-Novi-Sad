import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { freshBackend, setSettings } from './helpers.mjs';

const meta = { elapsedMs: 20000, hp: '' };
const contact = (emu, over = {}) =>
  emu.doPost({ action: 'contact.submit', payload: { requestId: randomUUID(), name: 'Jelena Petrović', phone: '063 555 1234', email: 'jelena@example.com', topic: 'Pitanje', message: 'Da li radite za praznike?', meta, ...over } });
const job = (emu, over = {}) =>
  emu.doPost({ action: 'jobs.submit', payload: { requestId: randomUUID(), name: 'Marko Ilić', phone: '062 111 2233', email: 'marko@example.com', experience: '1–3 godine', shift: 'Obe smene', message: 'Radio sam u pekari.', meta, ...over } });
const pdfBase64 = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF').toString('base64');

describe('contact form', () => {
  test('saved to CONTACT and emailed with reply-to the sender', () => {
    const emu = freshBackend({ settings: { EMAIL_1: 'info@grckigiros.test', EMAIL_2: '', EMAIL_3: '' } });
    const r = contact(emu);
    assert.equal(r.ok, true, JSON.stringify(r.error));
    const [row] = emu.rows('CONTACT');
    assert.equal(row.Name, 'Jelena Petrović');
    assert.equal(row.Phone, '+381635551234');
    assert.equal(row.Status, 'NEW');
    const [mail] = emu.state.outbox;
    assert.equal(mail.to, 'info@grckigiros.test');
    assert.equal(mail.replyTo, 'jelena@example.com');
    assert.match(mail.subject, /^Poruka sa sajta: Pitanje$/);
  });

  test('needs a way to answer, a message, and rejects bots', () => {
    const emu = freshBackend();
    const noWay = contact(emu, { phone: '', email: '' });
    assert.equal(noWay.error.code, 'VALIDATION');
    assert.equal(noWay.error.field, 'phone');
    assert.equal(contact(emu, { message: '' }).error.field, 'message');
    assert.equal(contact(emu, { meta: { hp: 'x' } }).error.code, 'BAD_REQUEST');
  });

  test('rate limited per sender', () => {
    const emu = freshBackend();
    for (let i = 0; i < 3; i++) assert.equal(contact(emu).ok, true);
    assert.equal(contact(emu).error.code, 'RATE_LIMITED');
  });
});

describe('job application', () => {
  test('with CV: stored in Drive, attached for both recipients, candidate confirmed', () => {
    const emu = freshBackend({ settings: { EMAIL_1: 'milica.tontic70@gmail.com', EMAIL_2: 'svetislavtontic@gmail.com', EMAIL_3: '' } });
    const r = job(emu, { cv: { name: 'cv.pdf', type: 'application/pdf', data: pdfBase64 } });
    assert.equal(r.ok, true, JSON.stringify(r.error));
    assert.equal(emu.state.driveFiles.length, 1);
    assert.match(emu.state.driveFiles[0].name, /^CV_Marko_Ilić_20260923-1423\.pdf$/);
    const [row] = emu.rows('JOBS');
    assert.match(row.CV, /^https:\/\/drive\.google\.com\/file\/d\//);
    assert.equal(row.Position, 'Prodavac-kuvar');
    const staff = emu.state.outbox.filter((m) => m.subject === 'Prijava za posao: Marko Ilić');
    assert.deepEqual(staff.map((m) => m.to).sort(), ['milica.tontic70@gmail.com', 'svetislavtontic@gmail.com']);
    assert.deepEqual(staff[0].attachments, [emu.state.driveFiles[0].name]);
    const confirm = emu.state.outbox.find((m) => m.to === 'marko@example.com');
    assert.match(confirm.htmlBody, /Vlasnik vas zove/);
  });

  test('CV is optional; bad type or size is refused with a clear message', () => {
    const emu = freshBackend();
    assert.equal(job(emu, { email: '' }).ok, true);
    assert.equal(emu.state.outbox.filter((m) => m.to === '').length, 0);
    const exe = job(emu, { phone: '0621112299', cv: { name: 'x.exe', type: 'application/x-msdownload', data: pdfBase64 } });
    assert.equal(exe.error.field, 'cv');
    const huge = job(emu, { phone: '0621112288', cv: { name: 'cv.pdf', type: 'application/pdf', data: Buffer.alloc(4 * 1024 * 1024 + 10).toString('base64') } });
    assert.equal(huge.error.code, 'VALIDATION');
    assert.match(huge.error.message, /4 MB/);
    const empty = job(emu, { phone: '0621112277', cv: { name: 'cv.pdf', type: 'application/pdf', data: '' } });
    assert.deepEqual([empty.error.field, /prazan/.test(empty.error.message)], ['cv', true]);
  });

  test('phone is required', () => {
    const emu = freshBackend();
    assert.equal(job(emu, { phone: '' }).error.field, 'phone');
  });
});

describe('email recipients live in SETTINGS, not in code', () => {
  test('comma separated lists are validated', () => {
    const emu = freshBackend();
    const r = emu.run('recipients_', 'a@grckigiros.test, not-an-email, b@grckigiros.test');
    assert.deepEqual(JSON.parse(JSON.stringify(r)), ['a@grckigiros.test', 'b@grckigiros.test']);
  });
});

describe('one submit per requestId (double click, retry racing the first copy)', () => {
  test('a copy that arrives while the first still runs gets BUSY and stores nothing; later copies replay the result', () => {
    const emu = freshBackend();
    const requestId = randomUUID();
    emu.state.cache.set('idem:job:' + requestId, { v: JSON.stringify({ pending: true }), exp: Infinity });
    assert.equal(job(emu, { requestId }).error.code, 'BUSY');
    assert.equal(emu.rows('JOBS').length, 0);
    emu.state.cache.clear();
    assert.equal(job(emu, { requestId }).ok, true);
    assert.equal(job(emu, { requestId }).ok, true, 'replayed');
    assert.equal(emu.rows('JOBS').length, 1);
    const to = emu.state.outbox.filter((m) => /^Prijava za posao/.test(m.subject)).map((m) => m.to);
    assert.equal(new Set(to).size, to.length, 'nobody got the application twice: ' + to.join(', '));
  });

  test('a failed run frees the id: the corrected retry with the same id goes through', () => {
    const emu = freshBackend();
    const requestId = randomUUID();
    assert.equal(contact(emu, { requestId, message: '' }).error.code, 'VALIDATION');
    assert.equal(contact(emu, { requestId }).ok, true);
    assert.equal(emu.rows('CONTACT').length, 1);
  });
});
