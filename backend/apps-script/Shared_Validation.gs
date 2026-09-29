// GENERATED from src/scripts/shared/validation.cjs by tools/gas-sync.mjs — do not edit here.
/*
 * Grčki Giros — input validation and sanitizing.
 * Shared by the browser (instant feedback) and Apps Script (the check that counts).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GG_Validation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var LIMITS = {
    name: 60,
    email: 120,
    street: 80,
    number: 12,
    apt: 40,
    floor: 20,
    addressNote: 200,
    feedbackComment: 600,
    orderNote: 300,
    lineNote: 140,
    message: 2000,
    topic: 60
  };

  /** Strips control characters (keeps newlines when multiline), trims and caps the length. */
  function clean(value, max, multiline) {
    // Only text and numbers count as text: an object or a list from a tampered request becomes empty, never "[object Object]".
    if (typeof value !== 'string' && !(typeof value === 'number' && isFinite(value))) return '';
    var s = String(value);
    s = multiline ? s.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '') : s.replace(/[\u0000-\u001F\u007F]/g, ' ');
    s = s.replace(/[​-‍﻿]/g, '');
    s = multiline ? s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n') : s.replace(/\s+/g, ' ');
    s = s.trim();
    return max ? s.slice(0, max) : s;
  }

  function formatRsNational(national) {
    // 0642274334 -> 064 227 4334, 063123456 -> 063 123 456
    var d = national.replace(/\D/g, '');
    if (d.length === 10) return d.slice(0, 3) + ' ' + d.slice(3, 6) + ' ' + d.slice(6);
    if (d.length === 9) return d.slice(0, 3) + ' ' + d.slice(3, 6) + ' ' + d.slice(6);
    return d;
  }

  /**
   * Serbian mobile numbers in any common notation, or an international number.
   * Returns { ok, e164, display, kind } or { ok:false, message }.
   */
  function normalizePhone(raw, opts) {
    var options = opts || {};
    var s = clean(raw, 40);
    var message = 'Unesite broj mobilnog telefona, npr. 064 123 4567.';
    if (!s) return { ok: false, message: 'Unesite broj telefona.' };
    if (/[^\d\s+()./-]/.test(s)) return { ok: false, message: message };
    var digits = s.replace(/[\s()./-]/g, '');
    if (digits.indexOf('00') === 0) digits = '+' + digits.slice(2);
    if (digits.indexOf('+') > 0 || (digits.match(/\+/g) || []).length > 1) return { ok: false, message: message };

    var national = null;
    if (digits.indexOf('+381') === 0) national = '0' + digits.slice(4);
    else if (digits.indexOf('381') === 0 && digits.length >= 11) national = '0' + digits.slice(3);
    else if (digits.charAt(0) === '0') national = digits;
    else if (digits.charAt(0) === '6' && (digits.length === 8 || digits.length === 9)) national = '0' + digits;

    if (national !== null) {
      if (national.indexOf('00') === 0) return { ok: false, message: message };
      if (/^06\d{7,8}$/.test(national)) {
        return { ok: true, e164: '+381' + national.slice(1), display: formatRsNational(national), kind: 'rs-mobile' };
      }
      if (options.allowLandline && /^0[1-3]\d{6,8}$/.test(national)) {
        return { ok: true, e164: '+381' + national.slice(1), display: national, kind: 'rs-landline' };
      }
      return { ok: false, message: message };
    }
    if (/^\+[1-9]\d{7,14}$/.test(digits)) {
      return { ok: true, e164: digits, display: digits, kind: 'intl' };
    }
    return { ok: false, message: message };
  }

  function validateName(raw) {
    var s = clean(raw, 200);
    if (s.length < 2) return { ok: false, message: 'Unesite ime i prezime.' };
    if (s.length > LIMITS.name) return { ok: false, message: 'Ime je predugačko (najviše ' + LIMITS.name + ' znakova).' };
    if (!/\p{L}/u.test(s)) return { ok: false, message: 'Unesite ime i prezime.' };
    if (/[<>{}\[\]\\=@#$%^*_|~`"]/.test(s) || /\d{3,}/.test(s)) return { ok: false, message: 'Ime sadrži nedozvoljene znakove.' };
    return { ok: true, value: s };
  }

  function validateEmail(raw, required) {
    var s = clean(raw, 200).toLowerCase();
    if (!s) return required ? { ok: false, message: 'Unesite email adresu.' } : { ok: true, value: '' };
    if (s.length > LIMITS.email || !/^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i.test(s)) {
      return { ok: false, message: 'Email adresa nije ispravna.' };
    }
    return { ok: true, value: s };
  }

  function validateAddress(address) {
    var a = address || {};
    var errors = {};
    var street = clean(a.street, 200);
    var number = clean(a.number, 40);
    var apt = clean(a.apt, 200);
    var floor = clean(a.floor, 100);
    var note = clean(a.note, 400, true);
    if (street.length < 2 || !/\p{L}/u.test(street)) errors.street = 'Unesite ulicu.';
    else if (street.length > LIMITS.street) errors.street = 'Naziv ulice je predugačak.';
    if (!number) errors.number = 'Unesite broj (ili „bb“).';
    else if (number.length > LIMITS.number || !/^(bb|b\.b\.|\d[\dA-Za-z/.\- ]*)$/i.test(number)) errors.number = 'Broj nije ispravan (npr. 12, 12a, 5/3 ili bb).';
    if (apt.length > LIMITS.apt) errors.apt = 'Predugačko (najviše ' + LIMITS.apt + ' znakova).';
    if (floor.length > LIMITS.floor) errors.floor = 'Predugačko (najviše ' + LIMITS.floor + ' znakova).';
    if (note.length > LIMITS.addressNote) errors.note = 'Napomena je predugačka (najviše ' + LIMITS.addressNote + ' znakova).';
    return {
      ok: Object.keys(errors).length === 0,
      errors: errors,
      value: {
        street: street.slice(0, LIMITS.street),
        number: number.slice(0, LIMITS.number),
        apt: apt.slice(0, LIMITS.apt),
        floor: floor.slice(0, LIMITS.floor),
        note: note.slice(0, LIMITS.addressNote)
      }
    };
  }

  /** Chips the guest can tick after a completed order (keys are stored, labels shown). */
  var FEEDBACK_GOOD = { taste: 'Ukus', speed: 'Brzina', temperature: 'Toplo stiglo', portion: 'Porcija', staff: 'Ljubaznost', packaging: 'Pakovanje' };
  var FEEDBACK_IMPROVE = { taste: 'Ukus', speed: 'Brzina', temperature: 'Stiglo hladno', portion: 'Porcija', accuracy: 'Tačnost porudžbine', packaging: 'Pakovanje' };

  function pickKeys(list, allowed) {
    var out = [];
    (Array.isArray(list) ? list : []).forEach(function (k) {
      var key = String(k);
      if (Object.prototype.hasOwnProperty.call(allowed, key) && out.indexOf(key) === -1) out.push(key);
    });
    return out;
  }

  function validateFeedback(payload) {
    var p = payload || {};
    var errors = {};
    var rating = Number(p.rating);
    if (!(rating >= 1 && rating <= 5 && Math.floor(rating) === rating)) errors.rating = 'Izaberite ocenu od 1 do 5.';
    var comment = clean(p.comment, 2000, true);
    if (comment.length > LIMITS.feedbackComment) errors.comment = 'Komentar je predugačak (najviše ' + LIMITS.feedbackComment + ' znakova).';
    return {
      ok: Object.keys(errors).length === 0,
      errors: errors,
      value: { rating: rating, good: pickKeys(p.good, FEEDBACK_GOOD), improve: pickKeys(p.improve, FEEDBACK_IMPROVE), comment: comment.slice(0, LIMITS.feedbackComment) }
    };
  }

  function parseAmount(raw) {
    if (raw === null || raw === undefined || raw === '') return NaN;
    if (typeof raw === 'number') return isFinite(raw) && raw >= 0 && Math.floor(raw) === raw ? raw : NaN;
    if (typeof raw !== 'string') return NaN;
    var s = raw.replace(/\s|RSD|din\.?|dinara/gi, '');
    // "2.000" and "2,000" are thousands in Serbian usage; decimals are not used for cash.
    if (/^\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, '');
    return /^\d+$/.test(s) ? parseInt(s, 10) : NaN;
  }

  function validateCash(raw, total, maxOver) {
    var amount = parseAmount(raw);
    if (!isFinite(amount)) return { ok: false, message: 'Unesite sa koliko novca plaćate.' };
    if (amount < total) return { ok: false, message: 'Iznos mora biti najmanje ' + total + ' RSD.' };
    if (maxOver && amount - total > maxOver) return { ok: false, message: 'Iznos je prevelik. Dostavljač ne može da vrati toliki kusur.' };
    return { ok: true, value: amount, change: amount - total };
  }

  function validateNote(raw, max) {
    var limit = max || LIMITS.orderNote;
    var s = clean(raw, 2000, true);
    if (s.length > limit) return { ok: false, message: 'Napomena je predugačka (najviše ' + limit + ' znakova).', value: s.slice(0, limit) };
    return { ok: true, value: s };
  }

  /**
   * Structural validation of the customer-facing part of an order (not prices, not time — those have their own cores).
   * Returns { ok, errors: { field: message }, value: normalized }.
   */
  function validateOrderContact(payload) {
    var p = payload || {};
    var errors = {};
    var value = {};
    var mode = p.mode === 'delivery' || p.mode === 'pickup' ? p.mode : null;
    if (!mode) errors.mode = 'Izaberite dostavu ili preuzimanje.';
    value.mode = mode;

    var c = p.customer || {};
    var name = validateName(c.name);
    if (!name.ok) errors.name = name.message;
    value.name = name.value || '';

    var phone = normalizePhone(c.phone);
    if (!phone.ok) errors.phone = phone.message;
    value.phone = phone.ok ? phone.e164 : '';
    value.phoneDisplay = phone.ok ? phone.display : '';

    var email = validateEmail(c.email, false);
    if (!email.ok) errors.email = email.message;
    value.email = email.value || '';

    var note = validateNote(p.note, LIMITS.orderNote);
    if (!note.ok) errors.note = note.message;
    value.note = note.value;

    if (mode === 'delivery') {
      var addr = validateAddress(p.address);
      Object.keys(addr.errors).forEach(function (k) {
        errors['address.' + k] = addr.errors[k];
      });
      value.address = addr.value;
      value.zone = clean((p.address || {}).zone, 60);
    } else {
      value.address = { street: '', number: '', apt: '', floor: '', note: '' };
      value.zone = '';
    }
    return { ok: Object.keys(errors).length === 0, errors: errors, value: value };
  }

  function validateContactForm(form) {
    var f = form || {};
    var errors = {};
    var name = validateName(f.name);
    if (!name.ok) errors.name = name.message;
    var phoneRaw = clean(f.phone, 40);
    var phone = phoneRaw ? normalizePhone(phoneRaw, { allowLandline: true }) : { ok: true, e164: '' };
    if (!phone.ok) errors.phone = 'Broj telefona nije ispravan.';
    var email = validateEmail(f.email, false);
    if (!email.ok) errors.email = email.message;
    if (!phoneRaw && !email.value && email.ok) errors.phone = 'Ostavite telefon ili email da bismo mogli da odgovorimo.';
    var message = clean(f.message, 4000, true);
    if (message.length < 5) errors.message = 'Napišite poruku.';
    else if (message.length > LIMITS.message) errors.message = 'Poruka je predugačka (najviše ' + LIMITS.message + ' znakova).';
    return {
      ok: Object.keys(errors).length === 0,
      errors: errors,
      value: { name: name.value || '', phone: phone.e164 || '', email: email.value || '', topic: clean(f.topic, LIMITS.topic), message: message.slice(0, LIMITS.message) }
    };
  }

  function validateJobForm(form) {
    var f = form || {};
    var errors = {};
    var name = validateName(f.name);
    if (!name.ok) errors.name = name.message;
    var phone = normalizePhone(f.phone, { allowLandline: true });
    if (!phone.ok) errors.phone = phone.message;
    var email = validateEmail(f.email, false);
    if (!email.ok) errors.email = email.message;
    var message = clean(f.message, 4000, true);
    if (message.length > LIMITS.message) errors.message = 'Poruka je predugačka.';
    return {
      ok: Object.keys(errors).length === 0,
      errors: errors,
      value: {
        name: name.value || '',
        phone: phone.ok ? phone.e164 : '',
        email: email.value || '',
        experience: clean(f.experience, 60),
        shift: clean(f.shift, 60),
        message: message.slice(0, LIMITS.message)
      }
    };
  }

  /** Prevents spreadsheet formula injection: values starting with = + - @ are stored as text. */
  function sheetSafe(value) {
    if (typeof value !== 'string') return value;
    return /^[=+\-@\t\r]/.test(value) ? "'" + value : value;
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  return {
    LIMITS: LIMITS,
    clean: clean,
    normalizePhone: normalizePhone,
    validateName: validateName,
    validateEmail: validateEmail,
    validateAddress: validateAddress,
    parseAmount: parseAmount,
    validateCash: validateCash,
    validateNote: validateNote,
    validateOrderContact: validateOrderContact,
    validateFeedback: validateFeedback,
    FEEDBACK_GOOD: FEEDBACK_GOOD,
    FEEDBACK_IMPROVE: FEEDBACK_IMPROVE,
    validateContactForm: validateContactForm,
    validateJobForm: validateJobForm,
    sheetSafe: sheetSafe,
    escapeHtml: escapeHtml
  };
});
