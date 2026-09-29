import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const S = require('../../src/scripts/shared/scheduling.cjs');
const seed = JSON.parse(readFileSync(new URL('../fixtures/seed.demo.json', import.meta.url), 'utf8'));

const settings = Object.fromEntries(seed.settings.map((s) => [s.key, s.value]));
const cfg = (overrides = {}, special = [], hours = seed.hours) => S.buildConfig({ ...settings, ...overrides }, hours, special);
const withBreak = (start, end) => seed.hours.map((h) => (h.closed ? h : { ...h, break_start: start, break_end: end }));

// 2026-09-23 is a Wednesday, 2026-09-26 Saturday, 2026-09-27 Sunday, 2026-09-30 the next Wednesday.
const at = (date, hm) => ({ date, minutes: S.parseHM(hm) });
const times = (day) => day.slots.map((s) => s.time);
const dayOf = (av, date) => av.days.find((d) => d.date === date);

describe('seed hours (Mon–Sat 09–01, delivery 10–00, Sunday closed), 30-minute slots', () => {
  test('before opening: nothing can be ordered, reopening today', () => {
    const snap = S.snapshot(at('2026-09-23', '08:30'), cfg());
    assert.equal(snap.open, false);
    assert.equal(snap.pickup.state, 'before_open');
    assert.equal(snap.pickup.next.label, 'danas u 09:00');
    assert.equal(snap.delivery.next.label, 'danas u 10:00');
    assert.equal(snap.next.label, 'danas u 09:00');
    assert.deepEqual(snap.pickup.days, [], 'no scheduling while closed');
  });

  test('ŠTO PRE shows the min–max estimate for both modes', () => {
    const snap = S.snapshot(at('2026-09-23', '14:23'), cfg());
    assert.deepEqual([snap.pickup.asap.etaMin, snap.pickup.asap.etaMax], [15, 30]);
    assert.deepEqual([snap.delivery.asap.etaMin, snap.delivery.asap.etaMax], [45, 60]);
    assert.equal(snap.pickup.asap.readyLabel, '14:40');
    assert.equal(snap.pickup.asap.readyMaxLabel, '14:55');
    assert.equal(snap.delivery.asap.readyLabel, '15:10');
    assert.equal(snap.delivery.asap.readyMaxLabel, '15:25');
  });

  test('today: slots every 30 min, never in the past, not before the longest estimate, not after delivery close', () => {
    const av = S.availability(at('2026-09-23', '14:23'), cfg(), 'delivery');
    const today = dayOf(av, '2026-09-23');
    assert.equal(today.label, 'Danas');
    assert.equal(today.slots[0].time, '15:30', '14:23 + 60 min = 15:23 → first full half hour');
    assert.equal(today.slots.at(-1).time, '23:30', 'delivery closes 00:00, last slot 15 min before');
    for (let i = 1; i < today.slots.length; i++) assert.equal(today.slots[i].minutes - today.slots[i - 1].minutes, 30);
    assert.equal(today.slots[0].value, '2026-09-23 15:30');
  });

  test('future days start after the kitchen opens + preparation; delivery window respected', () => {
    const av = S.availability(at('2026-09-23', '14:23'), cfg(), 'delivery');
    const thu = dayOf(av, '2026-09-24');
    assert.equal(thu.label, 'Sutra');
    assert.equal(thu.slots[0].time, '10:00');
    const pickupThu = dayOf(S.availability(at('2026-09-23', '14:23'), cfg(), 'pickup'), '2026-09-24');
    assert.equal(pickupThu.slots[0].time, '09:30', 'opens 09:00 + 15 min prep → 09:30');
    assert.equal(pickupThu.slots.at(-1).time, '00:30', 'pickup until 01:00 − 15 min');
    assert.equal(pickupThu.slots.at(-1).value, '2026-09-25 00:30', 'after midnight carries the calendar date');
    assert.equal(pickupThu.slots.at(-1).afterMidnight, true);
  });

  test('7 days ahead: next Wednesday until 14:23 is offered, 14:30 is not, Sunday never', () => {
    const av = S.availability(at('2026-09-23', '14:23'), cfg(), 'delivery');
    assert.deepEqual(
      av.days.map((d) => d.date),
      ['2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-28', '2026-09-29', '2026-09-30']
    );
    assert.equal(dayOf(av, '2026-09-30').slots.at(-1).time, '14:00');
    assert.ok(!av.slots.some((s) => s.value === '2026-09-30 14:30'));
    assert.equal(dayOf(av, '2026-09-26').label, 'Sub 26.09.');
  });

  test('preorder_days is owner-editable (1 = today and until the same time tomorrow)', () => {
    const av = S.availability(at('2026-09-23', '14:23'), cfg({ preorder_days: '1' }), 'delivery');
    assert.deepEqual(av.days.map((d) => d.date), ['2026-09-23', '2026-09-24']);
    assert.equal(dayOf(av, '2026-09-24').slots.at(-1).time, '14:00');
    const none = S.availability(at('2026-09-23', '14:23'), cfg({ preorder_days: '0' }), 'delivery');
    assert.deepEqual(none.days, [], '0 = only ŠTO PRE');
    assert.equal(none.canOrder, true);
  });

  test('near delivery close: 23:30 has ŠTO PRE, today has no slot, tomorrow does', () => {
    const av = S.availability(at('2026-09-23', '23:30'), cfg(), 'delivery');
    assert.equal(av.state, 'open');
    assert.equal(av.asap.available, true);
    assert.equal(dayOf(av, '2026-09-23'), undefined);
    assert.equal(av.days[0].date, '2026-09-24');
  });

  test('delivery cutoff: orders until 23:45 (23:44 ok), from 23:45 closed until tomorrow 10:00', () => {
    const last = S.availability(at('2026-09-23', '23:44'), cfg(), 'delivery');
    assert.equal(last.state, 'open');
    assert.equal(last.lastOrder, '23:45');
    const av = S.availability(at('2026-09-23', '23:45'), cfg(), 'delivery');
    assert.equal(av.state, 'closing');
    assert.equal(av.canOrder, false);
    assert.deepEqual(av.days, []);
    assert.equal(av.next.label, 'sutra u 10:00');
  });

  test('after midnight belongs to the previous business day (00:30 Thursday = Wednesday)', () => {
    const snap = S.snapshot(at('2026-09-24', '00:30'), cfg());
    assert.equal(snap.pickup.businessDate, '2026-09-23');
    assert.equal(snap.pickup.state, 'open');
    assert.equal(snap.pickup.asap.readyLabel, '00:45');
    assert.equal(snap.pickup.days[0].date, '2026-09-24', 'first scheduled day is Thursday');
    assert.equal(snap.pickup.days[0].label, 'Sutra');
    assert.equal(snap.delivery.state, 'closed');
    assert.equal(snap.delivery.next.label, 'ujutru u 10:00');
    assert.equal(S.slotLabel(at('2026-09-24', '00:30'), cfg(), '2026-09-24 18:00'), 'sutra u 18:00', 'evening slot after midnight is not "ujutru"');
    assert.equal(S.slotLabel(at('2026-09-24', '00:30'), cfg(), '2026-09-25 18:00'), 'u petak u 18:00', 'the day after is not "sutra" too');
  });

  test('exact closing 01:00 and after closing', () => {
    assert.equal(S.availability(at('2026-09-24', '01:00'), cfg(), 'pickup').state, 'closing');
    const after = S.snapshot(at('2026-09-24', '01:05'), cfg());
    assert.equal(after.open, false);
    assert.equal(after.pickup.state, 'closed');
    assert.equal(after.next.label, 'ujutru u 09:00');
  });

  test('Sunday is closed for ordering (menu stays visible, no scheduling either)', () => {
    const sunday = S.snapshot(at('2026-09-27', '12:00'), cfg());
    assert.equal(sunday.open, false);
    assert.equal(sunday.pickup.state, 'closed_day');
    assert.deepEqual(sunday.pickup.days, []);
    assert.equal(sunday.next.label, 'sutra u 09:00');
    assert.equal(S.availability(at('2026-09-26', '23:50'), cfg(), 'delivery').next.label, 'u ponedeljak u 10:00');
  });

  test('global pause blocks both modes; delivery or pickup can be switched off alone', () => {
    const paused = S.snapshot(at('2026-09-23', '14:00'), cfg({ ordering_enabled: 'FALSE' }));
    assert.equal(paused.open, false);
    assert.equal(paused.paused, true);
    assert.equal(paused.delivery.state, 'paused');
    const noDelivery = S.snapshot(at('2026-09-23', '14:00'), cfg({ delivery_enabled: 'FALSE' }));
    assert.equal(noDelivery.delivery.state, 'disabled');
    assert.equal(noDelivery.pickup.state, 'open');
    const noPickup = S.snapshot(at('2026-09-23', '14:00'), cfg({ pickup_enabled: 'FALSE' }));
    assert.equal(noPickup.pickup.state, 'disabled');
    assert.equal(noPickup.delivery.state, 'open');
  });

  test('busy mode (+15 min) moves every estimate and the first slot', () => {
    const snap = S.snapshot(at('2026-09-23', '14:23'), cfg({ extra_wait_min: '15' }));
    assert.deepEqual([snap.pickup.asap.etaMin, snap.pickup.asap.etaMax], [30, 45]);
    assert.equal(snap.delivery.asap.readyLabel, '15:25');
    assert.equal(snap.delivery.days[0].slots[0].time, '16:00', '14:23 + 75 = 15:38 → 16:00');
  });
});

describe('break (pauza) 15:00–16:00', () => {
  const c = () => cfg({}, [], withBreak('15:00', '16:00'));

  test('before the break: last ŠTO PRE is 14:45, today skips 15:00–16:00 and restarts after preparation', () => {
    const av = S.availability(at('2026-09-23', '14:10'), c(), 'pickup');
    assert.equal(av.state, 'open');
    assert.equal(av.lastOrder, '14:45');
    const today = times(dayOf(av, '2026-09-23'));
    assert.ok(!today.includes('15:00') && !today.includes('15:30') && !today.includes('16:00'), today.join(','));
    assert.equal(today[0], '16:30', 'kitchen resumes 16:00 + 15 min → 16:30');
    const thu = times(dayOf(av, '2026-09-24'));
    assert.ok(thu.includes('14:30') && !thu.includes('15:00') && !thu.includes('15:30') && !thu.includes('16:00') && thu.includes('16:30'), thu.join(','));
  });

  test('during the break ordering is closed and resumes automatically', () => {
    for (const hm of ['14:45', '15:00', '15:30', '15:59']) {
      const av = S.availability(at('2026-09-23', hm), c(), 'delivery');
      assert.equal(av.state, 'break', hm);
      assert.equal(av.canOrder, false, hm);
      assert.equal(av.next.label, 'danas u 16:00', hm);
    }
    const snap = S.snapshot(at('2026-09-23', '15:10'), c());
    assert.equal(snap.onBreak, true);
    assert.equal(snap.open, false);
    assert.equal(S.availability(at('2026-09-23', '16:00'), c(), 'delivery').state, 'open');
  });

  test('delivery slots also skip the break', () => {
    const av = S.availability(at('2026-09-23', '12:00'), c(), 'delivery');
    const today = times(dayOf(av, '2026-09-23'));
    assert.ok(today.includes('14:30') && !today.includes('15:00') && !today.includes('16:00') && !today.includes('16:30') && today.includes('17:00'), today.join(','));
  });

  test('weekly summary lists the break', () => {
    assert.equal(S.weeklySummary(c())[0].brk, '15:00–16:00');
  });
});

describe('special hours', () => {
  const special = [
    { date: '2026-12-31', label: 'Doček', open: '09:00', close: '18:00', delivery_open: '10:00', delivery_close: '17:00', closed: false, active: true },
    { date: '2027-01-01', label: 'Nova godina', closed: true, active: true },
    { date: '2026-10-05', label: 'Neaktivan primer', closed: true, active: false }
  ];

  test('shortened day: delivery closes at 17:00, pickup at 18:00', () => {
    const snap = S.snapshot(at('2026-12-31', '16:30'), cfg({}, special));
    assert.equal(snap.delivery.state, 'open');
    assert.equal(dayOf(snap.delivery, '2026-12-31'), undefined);
    const later = S.snapshot(at('2026-12-31', '17:30'), cfg({}, special));
    assert.equal(later.delivery.state, 'closed');
    assert.equal(later.pickup.state, 'open');
    assert.equal(later.pickup.window.closeLabel, '18:00');
  });

  test('holiday closure: next opening skips the closed day, scheduling skips it too', () => {
    const snap = S.snapshot(at('2026-12-31', '18:30'), cfg({}, special));
    assert.equal(snap.open, false);
    assert.equal(snap.pickup.next.label, 'u subotu u 09:00');
    const earlier = S.availability(at('2026-12-31', '12:00'), cfg({}, special), 'pickup');
    assert.ok(!earlier.days.some((d) => d.date === '2027-01-01'));
  });

  test('inactive rows are ignored (Monday 2026-10-05 stays open)', () => {
    assert.equal(S.availability(at('2026-10-05', '12:00'), cfg({}, special), 'pickup').state, 'open');
  });
});

describe('server-side time validation', () => {
  const now = at('2026-09-23', '14:23');

  test('ŠTO PRE accepted while open, rejected when closed or on break', () => {
    assert.equal(S.validateWhen(now, cfg(), 'delivery', 'asap').ok, true);
    const closed = S.validateWhen(at('2026-09-27', '12:00'), cfg(), 'delivery', 'asap');
    assert.equal(closed.code, 'CLOSED');
    assert.equal(closed.reason, 'closed_day');
    assert.equal(S.validateWhen(at('2026-09-23', '15:10'), cfg({}, [], withBreak('15:00', '16:00')), 'pickup', 'asap').reason, 'break');
  });

  test('offered slots accepted with their date; past / too early / >7 days / Sunday / break rejected', () => {
    const ok = S.validateWhen(now, cfg(), 'delivery', '2026-09-23 15:30');
    assert.equal(ok.ok, true);
    assert.equal(ok.scheduledDate, '2026-09-23');
    assert.equal(ok.scheduledTime, '15:30');
    assert.equal(S.validateWhen(now, cfg(), 'delivery', '2026-09-30 14:00').ok, true);
    assert.equal(S.validateWhen(now, cfg(), 'delivery', '2026-09-30 14:30').code, 'SLOT_UNAVAILABLE');
    assert.equal(S.validateWhen(now, cfg(), 'delivery', '2026-09-23 12:00').code, 'SLOT_UNAVAILABLE');
    assert.equal(S.validateWhen(now, cfg(), 'delivery', '2026-09-23 15:00').code, 'SLOT_UNAVAILABLE');
    assert.equal(S.validateWhen(now, cfg(), 'delivery', '2026-09-27 12:00').code, 'SLOT_UNAVAILABLE');
    assert.equal(S.validateWhen(now, cfg(), 'delivery', '2026-09-24 09:30').code, 'SLOT_UNAVAILABLE', 'delivery starts 10:00');
    assert.equal(S.validateWhen(now, cfg(), 'delivery', '2026-09-24 10:15').code, 'SLOT_UNAVAILABLE', 'not on the 30-minute grid');
    assert.equal(S.validateWhen(at('2026-09-23', '12:00'), cfg({}, [], withBreak('15:00', '16:00')), 'pickup', '2026-09-23 15:30').code, 'SLOT_UNAVAILABLE');
    assert.equal(S.validateWhen(now, cfg(), 'delivery', 'garbage').code, 'SLOT_UNAVAILABLE');
    assert.equal(S.validateWhen(now, cfg(), 'delivery', '15:30').code, 'SLOT_UNAVAILABLE', 'time without a date is not a slot');
  });

  test('a slot shown a few minutes ago is still accepted (10 min grace)', () => {
    assert.equal(S.validateWhen(at('2026-09-23', '14:33'), cfg(), 'delivery', '2026-09-23 15:30').ok, true);
    assert.equal(S.validateWhen(at('2026-09-23', '14:45'), cfg(), 'delivery', '2026-09-23 15:30').code, 'SLOT_UNAVAILABLE');
  });

  test('slot after midnight is read on the business day', () => {
    const r = S.validateWhen(at('2026-09-23', '22:45'), cfg(), 'pickup', '2026-09-24 00:30');
    assert.equal(r.ok, true);
    assert.equal(r.promisedMin, 1470);
    assert.equal(r.scheduledBusinessDate, '2026-09-23');
  });

  test('slot labels', () => {
    assert.equal(S.slotLabel(now, cfg(), '2026-09-23 18:30'), 'danas u 18:30');
    assert.equal(S.slotLabel(now, cfg(), '2026-09-24 12:00'), 'sutra u 12:00');
    assert.equal(S.slotLabel(now, cfg(), '2026-09-26 19:00'), 'u subotu u 19:00');
  });
});

describe('helpers', () => {
  test('weekly summary groups identical days and shows Sunday', () => {
    assert.deepEqual(
      S.weeklySummary(cfg()).map((r) => [r.days, r.closed, r.store, r.delivery, r.brk]),
      [
        ['Pon–Sub', false, '09:00–01:00', '10:00–00:00', ''],
        ['Nedelja', true, '', '', '']
      ]
    );
  });

  test('wall clock in Europe/Belgrade across DST', () => {
    assert.deepEqual(S.partsFromEpoch(Date.parse('2026-01-15T12:00:00Z')), { date: '2026-01-15', minutes: 13 * 60 });
    assert.deepEqual(S.partsFromEpoch(Date.parse('2026-07-15T12:00:00Z')), { date: '2026-07-15', minutes: 14 * 60 });
    assert.deepEqual(S.partsFromEpoch(Date.parse('2026-09-23T22:30:00Z')), { date: '2026-09-24', minutes: 30 });
  });

  test('parseHM / formatHM / parseSlot', () => {
    assert.equal(S.parseHM('9:00'), 540);
    assert.equal(S.parseHM('09.30'), 570);
    assert.equal(S.parseHM('24:00'), 1440);
    assert.equal(S.parseHM(''), null);
    assert.equal(S.parseHM('25:00'), null);
    assert.equal(S.formatHM(1500), '01:00');
    assert.deepEqual(S.parseSlot('2026-09-24 00:30', cfg()), { businessDate: '2026-09-23', minutes: 1470, calendarDate: '2026-09-24', time: '00:30' });
    assert.equal(S.parseSlot('2026-09-24', cfg()), null);
  });
});
