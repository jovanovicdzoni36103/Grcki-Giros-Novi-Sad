// GENERATED from src/scripts/shared/scheduling.cjs by tools/gas-sync.mjs — do not edit here.
/*
 * Grčki Giros — scheduling core.
 * Shared verbatim by the browser bundle, Node tests and Google Apps Script (copied to Shared_Scheduling.gs).
 * Works purely on Europe/Belgrade wall-clock values: { date: 'YYYY-MM-DD', minutes: 0..1439 }.
 * Business windows may cross midnight (09:00–01:00 is stored as 540–1500 on the business date).
 *
 * Rules (owner-editable in SETTINGS / HOURS):
 * - Ordering is possible only while the shop is open, not in its break, not paused, and the mode is on.
 * - ŠTO PRE stops asap_cutoff_min before closing and before the break.
 * - Scheduled slots: every slot_interval_min, up to preorder_days × 24 h ahead, never in the past,
 *   never outside the (delivery) window, never inside the break, and never earlier than the kitchen
 *   (re)opening + the minimum preparation estimate.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GG_Scheduling = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var DAY_NAMES = ['', 'Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota', 'Nedelja'];
  var DAY_SHORT = ['', 'Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'];
  var DAY_ACCUSATIVE = ['', 'u ponedeljak', 'u utorak', 'u sredu', 'u četvrtak', 'u petak', 'u subotu', 'u nedelju'];

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  /** '09:00' -> 540. Accepts '9:00', '09.00', '0900', '24:00'. Returns null for empty/invalid. */
  function parseHM(value) {
    if (value === null || value === undefined) return null;
    var s = String(value).trim();
    if (!s) return null;
    var m = s.match(/^(\d{1,2})[:.h]?(\d{2})?$/);
    if (!m) return null;
    var h = parseInt(m[1], 10);
    var min = m[2] ? parseInt(m[2], 10) : 0;
    if (h > 24 || min > 59 || (h === 24 && min > 0)) return null;
    return h * 60 + min;
  }

  /** 1500 -> '01:00', 1440 -> '00:00'. */
  function formatHM(minutes) {
    var m = ((Math.round(minutes) % 1440) + 1440) % 1440;
    return pad2(Math.floor(m / 60)) + ':' + pad2(m % 60);
  }

  function ceilTo(value, step) {
    if (!step || step <= 1) return Math.ceil(value);
    return Math.ceil(value / step) * step;
  }

  function parseDate(dateStr) {
    var m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) throw new Error('Invalid date: ' + dateStr);
    return { y: +m[1], m: +m[2], d: +m[3] };
  }

  function dateAdd(dateStr, days) {
    var p = parseDate(dateStr);
    var t = Date.UTC(p.y, p.m - 1, p.d) + days * 86400000;
    var d = new Date(t);
    return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
  }

  /** ISO day of week: 1 = Monday … 7 = Sunday. */
  function dowOf(dateStr) {
    var p = parseDate(dateStr);
    var js = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
    return js === 0 ? 7 : js;
  }

  function daysBetween(fromDate, toDate) {
    var a = parseDate(fromDate);
    var b = parseDate(toDate);
    return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);
  }

  function formatDateShort(dateStr) {
    var p = parseDate(dateStr);
    return pad2(p.d) + '.' + pad2(p.m) + '.';
  }

  /** Wall-clock parts of an epoch in a time zone, via Intl (browser, Node). Apps Script uses Util.gs instead. */
  function partsFromEpoch(epoch, timeZone) {
    var fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'Europe/Belgrade',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    });
    var out = {};
    fmt.formatToParts(new Date(epoch)).forEach(function (p) {
      out[p.type] = p.value;
    });
    var hour = parseInt(out.hour, 10) % 24;
    return { date: out.year + '-' + out.month + '-' + out.day, minutes: hour * 60 + parseInt(out.minute, 10) };
  }

  function toNumber(value, fallback) {
    if (value === '' || value === null || value === undefined) return fallback;
    var n = Number(value);
    return isFinite(n) ? n : fallback;
  }

  function toBool(value, fallback) {
    if (value === true || value === false) return value;
    if (value === null || value === undefined || value === '') return fallback;
    var s = String(value).trim().toUpperCase();
    if (s === 'TRUE' || s === 'DA' || s === '1' || s === 'YES') return true;
    if (s === 'FALSE' || s === 'NE' || s === '0' || s === 'NO') return false;
    return fallback;
  }

  function dayRow(row) {
    return {
      closed: toBool(row.closed, false),
      open: row.open || '',
      close: row.close || '',
      delivery_open: row.delivery_open || '',
      delivery_close: row.delivery_close || '',
      break_start: row.break_start || '',
      break_end: row.break_end || ''
    };
  }

  /**
   * Builds the normalized scheduling config from flat settings + hours rows + special rows.
   * Same function on both sides so the browser and the server can never disagree on defaults.
   */
  function buildConfig(settings, hoursRows, specialRows) {
    var s = settings || {};
    var hours = {};
    (hoursRows || []).forEach(function (row) {
      var dow = toNumber(row.dow, 0);
      if (dow < 1 || dow > 7) return;
      hours[dow] = dayRow(row);
    });
    var special = {};
    (specialRows || []).forEach(function (row) {
      if (!row || !row.date || !toBool(row.active, true)) return;
      var r = dayRow(row);
      r.label = row.label || '';
      special[row.date] = r;
    });
    var deliveryEtaMin = toNumber(s.delivery_eta_min, 45);
    var pickupEtaMin = toNumber(s.pickup_eta_min, 15);
    return {
      hours: hours,
      special: special,
      orderingEnabled: toBool(s.ordering_enabled, true),
      deliveryEnabled: toBool(s.delivery_enabled, true),
      pickupEnabled: toBool(s.pickup_enabled, true),
      deliveryEtaMin: deliveryEtaMin,
      deliveryEtaMax: Math.max(deliveryEtaMin, toNumber(s.delivery_eta_max, deliveryEtaMin)),
      pickupEtaMin: pickupEtaMin,
      pickupEtaMax: Math.max(pickupEtaMin, toNumber(s.pickup_eta_max, pickupEtaMin)),
      extraWaitMin: Math.max(0, toNumber(s.extra_wait_min, 0)),
      asapCutoffMin: Math.max(0, toNumber(s.asap_cutoff_min, 15)),
      slotFirstOffsetMin: Math.max(0, toNumber(s.slot_first_offset_min, 30)),
      slotIntervalMin: Math.max(5, toNumber(s.slot_interval_min, 30)),
      slotRoundMin: Math.max(1, toNumber(s.slot_round_min, 30)),
      preorderDays: Math.max(0, Math.min(14, toNumber(s.preorder_days, 7))),
      rolloverHour: toNumber(s.business_day_rollover_hour, 6)
    };
  }

  function normalizeWindow(openStr, closeStr) {
    var open = parseHM(openStr);
    var close = parseHM(closeStr);
    if (open === null || close === null) return null;
    if (close <= open) close += 1440;
    return { open: open, close: close };
  }

  /** A break inside the store window, in the same business minutes as the window (may be after midnight). */
  function normalizeBreak(src, store) {
    if (!store) return null;
    var start = parseHM(src.break_start);
    var end = parseHM(src.break_end);
    if (start === null || end === null) return null;
    if (start < store.open) start += 1440;
    if (end <= start) end += 1440;
    if (start < store.open || end > store.close || end - start < 5) return null;
    return { start: start, end: end };
  }

  /** Store, delivery and break windows for one business date (special hours win over the weekly table). */
  function windowsFor(dateStr, cfg) {
    var special = cfg.special[dateStr];
    var src = special || cfg.hours[dowOf(dateStr)];
    if (!src || src.closed) {
      return { closed: true, store: null, delivery: null, brk: null, special: !!special, label: special ? special.label : '' };
    }
    var store = normalizeWindow(src.open, src.close);
    var delivery = normalizeWindow(src.delivery_open, src.delivery_close);
    if (store && delivery) {
      if (delivery.open < store.open && delivery.open + 1440 < store.close) {
        delivery = { open: delivery.open + 1440, close: delivery.close + 1440 };
      }
      // Delivery can never run outside the store's own window.
      delivery = { open: Math.max(delivery.open, store.open), close: Math.min(delivery.close, store.close) };
      if (delivery.close <= delivery.open) delivery = null;
    }
    return {
      closed: !store,
      store: store,
      delivery: store ? delivery : null,
      brk: normalizeBreak(src, store),
      special: !!special,
      label: special ? special.label : ''
    };
  }

  function modeWindow(dateStr, cfg, mode) {
    var w = windowsFor(dateStr, cfg);
    return mode === 'delivery' ? w.delivery : w.store;
  }

  /** Early-morning minutes (before the rollover hour) belong to the previous business day. */
  function businessContext(nowParts, cfg) {
    var rollover = cfg.rolloverHour * 60;
    if (nowParts.minutes < rollover) {
      return { date: dateAdd(nowParts.date, -1), t: nowParts.minutes + 1440 };
    }
    return { date: nowParts.date, t: nowParts.minutes };
  }

  function etaFor(cfg, mode) {
    if (mode === 'delivery') return { min: cfg.deliveryEtaMin + cfg.extraWaitMin, max: cfg.deliveryEtaMax + cfg.extraWaitMin };
    return { min: cfg.pickupEtaMin + cfg.extraWaitMin, max: cfg.pickupEtaMax + cfg.extraWaitMin };
  }

  function modeEnabled(cfg, mode) {
    return mode === 'delivery' ? cfg.deliveryEnabled : cfg.pickupEnabled;
  }

  /** Human label for a future opening, relative to the calendar "now". */
  function openingLabel(nowParts, date, minutes) {
    var calDate = minutes >= 1440 ? dateAdd(date, 1) : date;
    var diff = daysBetween(nowParts.date, calDate);
    var hm = formatHM(minutes);
    // After midnight the guest still counts days from yesterday, like the day chips (Sutra): only this morning is "ujutru".
    if (nowParts.minutes < 360) {
      if (diff === 0 && minutes < 720) return 'ujutru u ' + hm;
      diff += 1;
    }
    if (diff === 0) return 'danas u ' + hm;
    if (diff === 1) return 'sutra u ' + hm;
    if (diff > 1 && diff < 7) return DAY_ACCUSATIVE[dowOf(calDate)] + ' u ' + hm;
    return formatDateShort(calDate) + ' u ' + hm;
  }

  function findNextOpening(nowParts, cfg, mode, businessDate, includeToday) {
    for (var i = includeToday ? 0 : 1; i <= 21; i++) {
      var d = dateAdd(businessDate, i);
      var w = modeWindow(d, cfg, mode);
      if (w) return { date: d, minutes: w.open, label: openingLabel(nowParts, d, w.open) };
    }
    return null;
  }

  /** Mode window split around the break: [{ from, to, kitchenFrom }]. kitchenFrom = when cooking (re)starts. */
  function segmentsFor(dateStr, cfg, mode) {
    var w = windowsFor(dateStr, cfg);
    var win = mode === 'delivery' ? w.delivery : w.store;
    if (!win) return [];
    var parts = [{ from: win.open, to: win.close, kitchenFrom: w.store.open }];
    if (w.brk) {
      parts = [];
      if (win.open < w.brk.start) parts.push({ from: win.open, to: Math.min(win.close, w.brk.start), kitchenFrom: w.store.open });
      if (win.close > w.brk.end) parts.push({ from: Math.max(win.open, w.brk.end), to: win.close, kitchenFrom: w.brk.end });
    }
    return parts;
  }

  function dayLabel(nowParts, cfg, businessDate) {
    var diff = daysBetween(businessContext(nowParts, cfg).date, businessDate);
    if (diff === 0) return 'Danas';
    if (diff === 1) return 'Sutra';
    return DAY_SHORT[dowOf(businessDate)] + ' ' + formatDateShort(businessDate);
  }

  /** Slot value sent to the server: calendar date + time, e.g. '2026-09-24 18:30'. */
  function slotValue(businessDate, minutes) {
    var cal = minutes >= 1440 ? dateAdd(businessDate, 1) : businessDate;
    return cal + ' ' + formatHM(minutes);
  }

  /** Parses a slot value into business date + business minutes. */
  function parseSlot(value, cfg) {
    var m = String(value || '').match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})$/);
    if (!m) return null;
    var minutes = parseHM(m[2]);
    if (minutes === null || minutes >= 1440) return null;
    if (minutes < cfg.rolloverHour * 60) return { businessDate: dateAdd(m[1], -1), minutes: minutes + 1440, calendarDate: m[1], time: m[2] };
    return { businessDate: m[1], minutes: minutes, calendarDate: m[1], time: m[2] };
  }

  /**
   * Scheduled slots for the next preorder_days, grouped by business day.
   * ctx = { date, t } is the business "now"; graceMin lets the server accept a slot the browser showed a few minutes ago.
   */
  function scheduleDays(nowParts, cfg, mode, ctx, graceMin) {
    var grace = graceMin || 0;
    var eta = etaFor(cfg, mode);
    var lead = Math.max(cfg.slotFirstOffsetMin, eta.max);
    var earliest = ctx.t + lead - grace; // relative to ctx.date
    var bound = ctx.t + cfg.preorderDays * 1440; // "do 7 dana unapred"
    var days = [];
    for (var i = 0; i <= cfg.preorderDays; i++) {
      var d = dateAdd(ctx.date, i);
      var offset = i * 1440;
      var slots = [];
      segmentsFor(d, cfg, mode).forEach(function (seg) {
        var first = Math.max(seg.from, seg.kitchenFrom + eta.min, earliest - offset);
        var last = seg.to - cfg.asapCutoffMin;
        for (var m = ceilTo(first, cfg.slotRoundMin); m <= last && m + offset <= bound; m += cfg.slotIntervalMin) {
          slots.push({ value: slotValue(d, m), time: formatHM(m), minutes: m, afterMidnight: m >= 1440 });
        }
      });
      if (slots.length) days.push({ date: d, label: dayLabel(nowParts, cfg, d), slots: slots });
    }
    return days;
  }

  /**
   * Availability for one mode at a given wall-clock moment.
   * state: open | before_open | break | closing | closed | closed_day | paused | disabled
   */
  function availability(nowParts, cfg, mode) {
    var ctx = businessContext(nowParts, cfg);
    var t = ctx.t;
    var eta = etaFor(cfg, mode);
    var all = windowsFor(ctx.date, cfg);
    var w = mode === 'delivery' ? all.delivery : all.store;
    var brk = all.brk && w && all.brk.end > w.open && all.brk.start < w.close ? all.brk : null;
    var result = {
      mode: mode,
      businessDate: ctx.date,
      nowMin: t,
      window: w ? { open: w.open, close: w.close, openLabel: formatHM(w.open), closeLabel: formatHM(w.close) } : null,
      breakWindow: brk ? { start: brk.start, end: brk.end, label: formatHM(brk.start) + '–' + formatHM(brk.end) } : null,
      lastOrder: w ? formatHM(w.close - cfg.asapCutoffMin) : null,
      state: 'closed',
      canOrder: false,
      asap: { available: false, etaMin: eta.min, etaMax: eta.max, readyAt: null, readyLabel: '', readyMaxLabel: '' },
      days: [],
      slots: [],
      next: null
    };

    if (!cfg.orderingEnabled) {
      result.state = 'paused';
      return result;
    }
    if (!modeEnabled(cfg, mode)) {
      result.state = 'disabled';
      return result;
    }
    if (!w) {
      result.state = 'closed_day';
      result.next = findNextOpening(nowParts, cfg, mode, ctx.date, false);
      return result;
    }
    if (t < w.open) {
      result.state = 'before_open';
      result.next = { date: ctx.date, minutes: w.open, label: openingLabel(nowParts, ctx.date, w.open) };
      return result;
    }
    // Ordering stops AT close − cutoff (23:45 for a 00:00 close), so nothing is promised that can't be fulfilled.
    if (t >= w.close - cfg.asapCutoffMin) {
      result.state = t <= w.close ? 'closing' : 'closed';
      result.next = findNextOpening(nowParts, cfg, mode, ctx.date, false);
      return result;
    }
    if (brk && t >= brk.start - cfg.asapCutoffMin && t < brk.end) {
      var resume = Math.max(brk.end, w.open);
      result.state = 'break';
      result.next = { date: ctx.date, minutes: resume, label: openingLabel(nowParts, ctx.date, resume) };
      return result;
    }
    if (brk && t < brk.start) result.lastOrder = formatHM(brk.start - cfg.asapCutoffMin);

    result.state = 'open';
    var ready = ceilTo(t + eta.min, 5);
    var readyMax = ceilTo(t + eta.max, 5);
    result.asap = { available: true, etaMin: eta.min, etaMax: eta.max, readyAt: ready, readyLabel: formatHM(ready), readyMaxLabel: formatHM(readyMax) };
    result.days = scheduleDays(nowParts, cfg, mode, ctx, 0);
    result.slots = result.days.reduce(function (list, d) {
      return list.concat(d.slots);
    }, []);
    result.canOrder = true;
    return result;
  }

  /** Both modes at once, plus a combined headline state for the header pill. */
  function snapshot(nowParts, cfg) {
    var delivery = availability(nowParts, cfg, 'delivery');
    var pickup = availability(nowParts, cfg, 'pickup');
    var anyOpen = delivery.canOrder || pickup.canOrder;
    var next = null;
    if (!anyOpen) {
      var candidates = [delivery.next, pickup.next].filter(Boolean);
      candidates.sort(function (a, b) {
        return daysBetween(b.date, a.date) * 1440 + (a.minutes - b.minutes);
      });
      next = candidates[0] || null;
    }
    return {
      delivery: delivery,
      pickup: pickup,
      open: anyOpen,
      paused: !cfg.orderingEnabled,
      onBreak: delivery.state === 'break' || pickup.state === 'break',
      next: next,
      storeWindow: windowsFor(delivery.businessDate, cfg).store
    };
  }

  /**
   * Server-side check of the requested time. `when` is 'asap' or a slot value ('YYYY-MM-DD HH:MM').
   * graceMin tolerates a slot the browser computed a few minutes earlier.
   */
  function validateWhen(nowParts, cfg, mode, when, graceMin) {
    var grace = graceMin === undefined ? 10 : graceMin;
    var av = availability(nowParts, cfg, mode);
    if (av.state === 'paused') return { ok: false, code: 'CLOSED', reason: 'paused', availability: av };
    if (av.state === 'disabled') return { ok: false, code: 'CLOSED', reason: 'disabled', availability: av };
    if (av.state !== 'open') return { ok: false, code: 'CLOSED', reason: av.state, availability: av };

    if (when === 'asap') {
      return { ok: true, asap: true, promisedMin: av.asap.readyAt, promisedLabel: av.asap.readyLabel, scheduledDate: '', scheduledTime: '', availability: av };
    }
    var slot = parseSlot(when, cfg);
    if (!slot) return { ok: false, code: 'SLOT_UNAVAILABLE', reason: 'invalid', availability: av };
    var ctx = businessContext(nowParts, cfg);
    var days = scheduleDays(nowParts, cfg, mode, ctx, grace);
    var match = null;
    days.forEach(function (d) {
      if (d.date !== slot.businessDate) return;
      d.slots.forEach(function (s) {
        if (s.minutes === slot.minutes) match = { day: d, slot: s };
      });
    });
    if (!match) return { ok: false, code: 'SLOT_UNAVAILABLE', reason: 'out_of_range', availability: av };
    return {
      ok: true,
      asap: false,
      promisedMin: slot.minutes,
      promisedLabel: slot.time,
      scheduledDate: slot.calendarDate,
      scheduledTime: slot.time,
      scheduledBusinessDate: slot.businessDate,
      dayLabel: match.day.label,
      availability: av
    };
  }

  /** Human label for a scheduled slot: 'danas u 18:30', 'sutra u 12:00', 'pet 25.09. u 19:00'. */
  function slotLabel(nowParts, cfg, value) {
    var slot = parseSlot(value, cfg);
    if (!slot) return String(value || '');
    return openingLabel(nowParts, slot.businessDate, slot.minutes);
  }

  /** Compact weekly summary: [{ days: 'Pon–Sub', store: '09:00–01:00', delivery: '10:00–00:00', brk: '' }, { days: 'Ned', closed: true }]. */
  function weeklySummary(cfg) {
    var rows = [];
    for (var dow = 1; dow <= 7; dow++) {
      var h = cfg.hours[dow];
      var key;
      var row;
      if (!h || h.closed || !normalizeWindow(h.open, h.close)) {
        key = 'closed';
        row = { closed: true };
      } else {
        var s = normalizeWindow(h.open, h.close);
        var d = normalizeWindow(h.delivery_open, h.delivery_close);
        var b = normalizeBreak(h, s);
        row = {
          closed: false,
          store: formatHM(s.open) + '–' + formatHM(s.close),
          delivery: d ? formatHM(d.open) + '–' + formatHM(d.close) : '',
          brk: b ? formatHM(b.start) + '–' + formatHM(b.end) : ''
        };
        key = row.store + '|' + row.delivery + '|' + row.brk;
      }
      var prev = rows[rows.length - 1];
      if (prev && prev.key === key && prev.to === dow - 1) {
        prev.to = dow;
      } else {
        row.key = key;
        row.from = dow;
        row.to = dow;
        rows.push(row);
      }
    }
    return rows.map(function (r) {
      var days = r.from === r.to ? DAY_NAMES[r.from] : DAY_SHORT[r.from] + '–' + DAY_SHORT[r.to];
      return { days: days, from: r.from, to: r.to, closed: r.closed, store: r.store || '', delivery: r.delivery || '', brk: r.brk || '' };
    });
  }

  return {
    DAY_NAMES: DAY_NAMES,
    DAY_SHORT: DAY_SHORT,
    parseHM: parseHM,
    formatHM: formatHM,
    ceilTo: ceilTo,
    dateAdd: dateAdd,
    dowOf: dowOf,
    daysBetween: daysBetween,
    formatDateShort: formatDateShort,
    partsFromEpoch: partsFromEpoch,
    toBool: toBool,
    buildConfig: buildConfig,
    windowsFor: windowsFor,
    businessContext: businessContext,
    etaFor: etaFor,
    availability: availability,
    snapshot: snapshot,
    scheduleDays: scheduleDays,
    parseSlot: parseSlot,
    slotValue: slotValue,
    slotLabel: slotLabel,
    validateWhen: validateWhen,
    weeklySummary: weeklySummary,
    openingLabel: openingLabel
  };
});
