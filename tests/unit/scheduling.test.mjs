import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const S = require('../../src/scripts/shared/scheduling.cjs');
const seed = JSON.parse(readFileSync(new URL('../../data/seed.json', import.meta.url), 'utf8'));

const settings = Object.fromEntries(seed.settings.map((s) => [s.key, s.value]));
const cfg = (overrides = {}, special = []) => S.buildConfig({ ...settings, ...overrides }, seed.hours, special);

// 2026-09-23 is a Wednesday, 2026-09-26 Saturday, 2026-09-27 Sunday.
const at = (date, hm) => ({ date, minutes: S.parseHM(hm) });
const slotValues = (av) => av.slots.map((s) => s.value);

describe('config from PDF (Mon–Sat 09–01, delivery 10–00, Sunday closed)', () => {
  test('before opening: nothing can be ordered, reopening today', () => {
    const snap = S.snapshot(at('2026-09-23', '08:30'), cfg());
    assert.equal(snap.open, false);
    assert.equal(snap.pickup.state, 'before_open');
    assert.equal(snap.pickup.next.label, 'danas u 09:00');
    assert.equal(snap.delivery.next.label, 'danas u 10:00');
    assert.equal(snap.next.label, 'danas u 09:00');
  });

  test('exact opening 09:00: pickup opens, delivery waits for 10:00', () => {
    const snap = S.snapshot(at('2026-09-23', '09:00'), cfg());
    assert.equal(snap.pickup.state, 'open');
    assert.equal(snap.pickup.asap.readyLabel, '09:15');
    assert.deepEqual(slotValues(snap.pickup), ['10:00', '10:30', '11:00']);
    assert.equal(snap.delivery.state, 'before_open');
    assert.equal(snap.delivery.next.label, 'danas u 10:00');
  });

  test('exact delivery opening 10:00', () => {
    const av = S.availability(at('2026-09-23', '10:00'), cfg(), 'delivery');
    assert.equal(av.state, 'open');
    assert.equal(av.asap.readyLabel, '11:00');
    assert.deepEqual(slotValues(av), ['11:00', '11:30', '12:00']);
  });

  for (const [hm, expected] of [
    ['11:00', ['12:00', '12:30', '13:00']],
    ['12:00', ['13:00', '13:30', '14:00']],
    ['14:23', ['15:30', '16:00', '16:30']],
    ['20:30', ['21:30', '22:00', '22:30']],
    ['21:00', ['22:00', '22:30', '23:00']],
    ['21:30', ['22:30', '23:00', '23:30']],
    ['21:59', ['23:00', '23:30', '00:00']],
    ['22:00', ['23:00', '23:30', '00:00']]
  ]) {
    test(`delivery at ${hm}: ŠTO PRE + slots ${expected.join(', ')}, never after 00:00`, () => {
      const av = S.availability(at('2026-09-23', hm), cfg(), 'delivery');
      assert.equal(av.state, 'open');
      assert.equal(av.asap.available, true);
      assert.deepEqual(slotValues(av), expected);
      for (const s of av.slots) assert.ok(s.minutes <= 1440, `slot ${s.value} after delivery close`);
    });
  }

  test('14:23 ŠTO PRE estimate: delivery ~15:25, pickup ~14:40', () => {
    const snap = S.snapshot(at('2026-09-23', '14:23'), cfg());
    assert.equal(snap.delivery.asap.readyLabel, '15:25');
    assert.equal(snap.pickup.asap.readyLabel, '14:40');
    assert.equal(snap.pickup.asap.etaMin, 15);
    assert.equal(snap.pickup.asap.etaMax, 30);
  });

  test('near delivery close: 23:30 has ŠTO PRE but no slot (every slot would be after 00:00)', () => {
    const av = S.availability(at('2026-09-23', '23:30'), cfg(), 'delivery');
    assert.equal(av.state, 'open');
    assert.equal(av.asap.available, true);
    assert.deepEqual(av.slots, []);
  });

  test('delivery cutoff: orders until 23:45 (23:44 ok), from 23:45 closed until tomorrow 10:00', () => {
    const last = S.availability(at('2026-09-23', '23:44'), cfg(), 'delivery');
    assert.equal(last.state, 'open');
    assert.equal(last.lastOrder, '23:45');
    const av = S.availability(at('2026-09-23', '23:45'), cfg(), 'delivery');
    assert.equal(av.state, 'closing');
    assert.equal(av.canOrder, false);
    assert.equal(av.next.label, 'sutra u 10:00');
  });

  test('after midnight belongs to the previous business day (00:30 Thursday = Wednesday)', () => {
    const snap = S.snapshot(at('2026-09-24', '00:30'), cfg());
    assert.equal(snap.pickup.businessDate, '2026-09-23');
    assert.equal(snap.pickup.state, 'open');
    assert.equal(snap.pickup.asap.readyLabel, '00:45');
    assert.deepEqual(snap.pickup.slots, []);
    assert.equal(snap.delivery.state, 'closed');
    assert.equal(snap.delivery.next.label, 'ujutru u 10:00');
  });

  test('exact closing 01:00 and after closing', () => {
    const closing = S.availability(at('2026-09-24', '01:00'), cfg(), 'pickup');
    assert.equal(closing.state, 'closing');
    assert.equal(closing.canOrder, false);
    const after = S.snapshot(at('2026-09-24', '01:05'), cfg());
    assert.equal(after.open, false);
    assert.equal(after.pickup.state, 'closed');
    assert.equal(after.next.label, 'ujutru u 09:00');
  });

  test('Sunday is closed; Saturday night still runs until 01:00 Sunday', () => {
    const satNight = S.availability(at('2026-09-27', '00:30'), cfg(), 'pickup');
    assert.equal(satNight.businessDate, '2026-09-26');
    assert.equal(satNight.state, 'open');
    const sunday = S.snapshot(at('2026-09-27', '12:00'), cfg());
    assert.equal(sunday.open, false);
    assert.equal(sunday.pickup.state, 'closed_day');
    assert.equal(sunday.next.label, 'sutra u 09:00');
    const satAfterCutoff = S.availability(at('2026-09-27', '00:50'), cfg(), 'pickup');
    assert.equal(satAfterCutoff.next.label, 'sutra u 09:00');
    const satEvening = S.availability(at('2026-09-26', '23:50'), cfg(), 'delivery');
    assert.equal(satEvening.next.label, 'u ponedeljak u 10:00');
  });

  test('temporary closure (ordering_enabled = FALSE) blocks both modes', () => {
    const snap = S.snapshot(at('2026-09-23', '14:00'), cfg({ ordering_enabled: 'FALSE' }));
    assert.equal(snap.open, false);
    assert.equal(snap.paused, true);
    assert.equal(snap.delivery.state, 'paused');
    assert.equal(snap.pickup.state, 'paused');
  });

  test('delivery can be switched off while pickup keeps working', () => {
    const snap = S.snapshot(at('2026-09-23', '14:00'), cfg({ delivery_enabled: 'FALSE' }));
    assert.equal(snap.delivery.state, 'disabled');
    assert.equal(snap.pickup.state, 'open');
    assert.equal(snap.open, true);
  });

  test('busy mode (+15 min) moves every estimate and the first slot', () => {
    const snap = S.snapshot(at('2026-09-23', '14:23'), cfg({ extra_wait_min: '15' }));
    assert.equal(snap.pickup.asap.etaMin, 30);
    assert.equal(snap.pickup.asap.etaMax, 45);
    assert.equal(snap.delivery.asap.readyLabel, '15:40');
    assert.equal(snap.delivery.slots[0].value, '15:45');
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
    assert.deepEqual(slotValues(snap.delivery), []);
    const later = S.snapshot(at('2026-12-31', '17:30'), cfg({}, special));
    assert.equal(later.delivery.state, 'closed');
    assert.equal(later.pickup.state, 'open');
    assert.equal(later.pickup.window.closeLabel, '18:00');
  });

  test('holiday closure: next opening skips the closed day', () => {
    const snap = S.snapshot(at('2026-12-31', '18:30'), cfg({}, special));
    assert.equal(snap.open, false);
    assert.equal(snap.pickup.next.date, '2027-01-02');
    assert.equal(snap.pickup.next.label, 'u subotu u 09:00');
  });

  test('inactive rows are ignored (Monday 2026-10-05 stays open)', () => {
    assert.equal(S.availability(at('2026-10-05', '12:00'), cfg({}, special), 'pickup').state, 'open');
  });

  test('exceptional opening on a Sunday', () => {
    const extra = [{ date: '2026-09-27', open: '12:00', close: '20:00', delivery_open: '12:00', delivery_close: '19:00', closed: false, active: true }];
    const av = S.availability(at('2026-09-27', '13:00'), cfg({}, extra), 'delivery');
    assert.equal(av.state, 'open');
    assert.deepEqual(slotValues(av), ['14:00', '14:30', '15:00']);
  });
});

describe('the prompt example (10:00–22:00, hourly slots, no 2 h limit)', () => {
  const hours = [1, 2, 3, 4, 5, 6, 7].map((dow) => ({ dow, open: '10:00', close: '22:00', delivery_open: '10:00', delivery_close: '22:00', closed: false }));
  const promptCfg = (extra = {}) =>
    S.buildConfig(
      { ...settings, slot_interval_min: '60', slot_round_min: '1', preorder_max_ahead_min: '1440', asap_cutoff_min: '30', ...extra },
      hours,
      []
    );

  test('14:23 → ŠTO PRE, 15:23 … 21:23 and never 22:23', () => {
    const av = S.availability(at('2026-09-23', '14:23'), promptCfg(), 'delivery');
    assert.deepEqual(slotValues(av), ['15:23', '16:23', '17:23', '18:23', '19:23', '20:23', '21:23']);
    assert.ok(!slotValues(av).includes('22:23'));
  });

  test('21:30 with a 30 minute minimum: nothing is offered', () => {
    const av = S.availability(at('2026-09-23', '21:30'), promptCfg(), 'delivery');
    assert.equal(av.state, 'closing');
    assert.equal(av.canOrder, false);
    assert.deepEqual(av.slots, []);
  });

  test('22:00 exact closing and 11:00/12:00 mid-day', () => {
    assert.equal(S.availability(at('2026-09-23', '22:00'), promptCfg(), 'delivery').state, 'closing');
    assert.deepEqual(slotValues(S.availability(at('2026-09-23', '11:00'), promptCfg(), 'delivery')).slice(0, 2), ['12:00', '13:00']);
    assert.equal(S.availability(at('2026-09-23', '20:30'), promptCfg(), 'delivery').slots.at(-1).value, '21:30');
    assert.deepEqual(slotValues(S.availability(at('2026-09-23', '21:00'), promptCfg(), 'delivery')), ['22:00'], 'last slot is the closing time itself');
    assert.equal(S.availability(at('2026-09-23', '21:29'), promptCfg(), 'delivery').state, 'open');
  });
});

describe('server-side time validation', () => {
  const now = at('2026-09-23', '14:23');

  test('ŠTO PRE accepted while open, rejected when closed', () => {
    assert.equal(S.validateWhen(now, cfg(), 'delivery', 'asap').ok, true);
    const closed = S.validateWhen(at('2026-09-27', '12:00'), cfg(), 'delivery', 'asap');
    assert.equal(closed.ok, false);
    assert.equal(closed.code, 'CLOSED');
  });

  test('offered slots accepted, too early / too far / after close rejected', () => {
    assert.equal(S.validateWhen(now, cfg(), 'delivery', '15:30').ok, true);
    assert.equal(S.validateWhen(now, cfg(), 'delivery', '15:15').ok, true, 'within 10 min grace of a slot computed a moment earlier');
    assert.equal(S.validateWhen(now, cfg(), 'delivery', '15:00').code, 'SLOT_UNAVAILABLE');
    assert.equal(S.validateWhen(now, cfg(), 'delivery', '17:00').code, 'SLOT_UNAVAILABLE');
    assert.equal(S.validateWhen(at('2026-09-23', '22:30'), cfg(), 'delivery', '00:30').code, 'SLOT_UNAVAILABLE');
    assert.equal(S.validateWhen(now, cfg(), 'delivery', 'garbage').code, 'SLOT_UNAVAILABLE');
  });

  test('slot after midnight is read on the business day', () => {
    const r = S.validateWhen(at('2026-09-23', '22:45'), cfg(), 'pickup', '00:00');
    assert.equal(r.ok, true);
    assert.equal(r.promisedMin, 1440);
  });
});

describe('helpers', () => {
  test('weekly summary groups identical days and shows Sunday', () => {
    const rows = S.weeklySummary(cfg());
    assert.deepEqual(
      rows.map((r) => [r.days, r.closed, r.store, r.delivery]),
      [
        ['Pon–Sub', false, '09:00–01:00', '10:00–00:00'],
        ['Nedelja', true, '', '']
      ]
    );
  });

  test('wall clock in Europe/Belgrade across DST', () => {
    assert.deepEqual(S.partsFromEpoch(Date.parse('2026-01-15T12:00:00Z')), { date: '2026-01-15', minutes: 13 * 60 });
    assert.deepEqual(S.partsFromEpoch(Date.parse('2026-07-15T12:00:00Z')), { date: '2026-07-15', minutes: 14 * 60 });
    assert.deepEqual(S.partsFromEpoch(Date.parse('2026-09-23T22:30:00Z')), { date: '2026-09-24', minutes: 30 });
  });

  test('parseHM / formatHM', () => {
    assert.equal(S.parseHM('9:00'), 540);
    assert.equal(S.parseHM('09.30'), 570);
    assert.equal(S.parseHM('24:00'), 1440);
    assert.equal(S.parseHM(''), null);
    assert.equal(S.parseHM('25:00'), null);
    assert.equal(S.formatHM(1500), '01:00');
    assert.equal(S.formatHM(1440), '00:00');
  });
});
