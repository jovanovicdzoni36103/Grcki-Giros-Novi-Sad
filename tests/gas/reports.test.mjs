import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { freshBackend, placeOrder, plain } from './helpers.mjs';

const KLASIK = ['meso-pilece', 'pita-atina', 'sos-tzatziki', 'sal-paradajz', 'sal-luk', 'zac-origano', 'pup-da'];
const ATINA = ['meso-mesano', 'pita-atina', 'sos-tzatziki', 'sal-paradajz', 'sal-krastavac', 'zac-origano', 'zac-so', 'pup-da'];
const GIROS_SOK = ['meso-svinjsko', 'pita-atina', 'sos-tzatziki', 'sal-paradajz', 'sal-luk', 'pup-da', 'sok-fanta'];
const DUO = ['d1-pilece', 'd2-svinjsko', 'pita-atina', 'sos-tzatziki', 'sal-paradajz', 'sal-luk', 'pup-da', 'ds1-cola', 'ds2-zero'];

const pickup = (items, clientTotal) => ({ mode: 'pickup', cash: undefined, address: {}, items, clientTotal });
const delivery = (items, subtotal) => ({ mode: 'delivery', items, clientTotal: subtotal + 250, cash: 5000 });

/** Places an order at a given Belgrade wall time. */
function at(emu, iso, overrides, phone) {
  emu.setNow(iso);
  const r = placeOrder(emu, { ...overrides, customer: { phone: phone || '0640000000', email: '' } });
  assert.equal(r.ok, true, `${iso}: ${JSON.stringify(r.error)}`);
  return r.data;
}

function cancel(emu, orderId) {
  const token = emu.doPost({ action: 'panel.login', payload: { pin: '482913' } }).data.token;
  const r = emu.doPost({ action: 'panel.status', payload: { token, orderId, status: 'CANCELLED' } });
  assert.equal(r.ok, true);
}

function buildHistory() {
  const emu = freshBackend({ settings: { rate_limit_phone_count: '1000' } });
  emu.run('setPanelPin_', '482913');
  const rc = emu.sheet('REPORT_CONFIG');
  rc.data.find((r) => r[0] === 'report_recipients')[1] = 'izvestaji@grckigiros.test, vlasnik@grckigiros.test';
  // Previous week: Wednesday 16.09.
  at(emu, '2026-09-16T13:00:00+02:00', pickup([{ productId: 'klasik', qty: 1, options: KLASIK }], 620), '0641111111');
  // Wednesday 23.09. (the reported day)
  at(emu, '2026-09-23T12:10:00+02:00', delivery([{ productId: 'klasik', qty: 1, options: KLASIK }, { productId: 'coca-cola', qty: 1 }], 820), '0642222222');
  at(emu, '2026-09-23T13:05:00+02:00', pickup([{ productId: 'giros-sok', qty: 1, options: GIROS_SOK }], 720), '0643333333');
  at(emu, '2026-09-23T19:40:00+02:00', delivery([{ productId: 'giros-duo', qty: 1, options: DUO }, { productId: 'tzatziki-100', qty: 1 }], 1810), '0642222222');
  const cancelled = at(emu, '2026-09-23T20:15:00+02:00', pickup([{ productId: 'atina', qty: 1, options: ATINA }], 660), '0644444444');
  cancel(emu, cancelled.orderId);
  at(emu, '2026-09-24T00:30:00+02:00', pickup([{ productId: 'klasik', qty: 1, options: KLASIK }, { productId: 'coca-cola', qty: 2 }], 1020), '0645555555');
  // Rest of the week and one September day in the week before.
  at(emu, '2026-09-25T18:00:00+02:00', delivery([{ productId: 'giros-max', qty: 2, options: KLASIK }], 1640), '0642222222');
  at(emu, '2026-09-19T21:00:00+02:00', delivery([{ productId: 'porodicni-box', qty: 1, options: ['fam-mix', 'pita-atina', 'sos-tzatziki', 'pup-da', 'fs-cola'] }], 3290), '0646666666');
  return emu;
}

describe('daily report at 01:15 for the previous business day', () => {
  const emu = buildHistory();
  emu.state.outbox.length = 0;
  emu.setNow('2026-09-24T01:15:00+02:00');
  const res = plain(emu.run('dailyReport_', {}));

  test('covers 23.09. including the 00:30 order, excludes the cancelled one', () => {
    assert.equal(res.date, '2026-09-23');
    assert.equal(res.stats.orders, 4);
    assert.equal(res.stats.cancelled, 1);
    assert.equal(res.stats.revenue, 820 + 720 + 1810 + 1020, 'food only, delivery fees excluded');
    assert.equal(res.stats.aov, Math.round(4370 / 4));
    assert.equal(res.stats.delivery, 2);
    assert.equal(res.stats.pickup, 2);
    assert.equal(res.stats.deliveryFees, 500);
    assert.equal(res.stats.topProduct, 'Klasik', 'ranked by revenue: Klasik 1.240 beats Coca-Cola 600 even though 3 cans were sold');
    assert.equal(res.stats.topPackage, 'Giros Duo');
    assert.deepEqual(res.stats.topProducts.map((p) => [p.name, p.qty, p.revenue]).slice(0, 2), [['Klasik', 2, 1240], ['Coca-Cola 0.33 l', 3, 600]]);
  });

  test('compared with the same day last week; lifetime included', () => {
    assert.equal(res.report.previous.revenue, 620);
    assert.equal(res.report.lifetime.firstDate, '2026-09-16');
    assert.equal(res.report.lifetime.orders, 7);
  });

  test('emailed to every report recipient', () => {
    assert.deepEqual(emu.state.outbox.map((m) => m.to).sort(), ['izvestaji@grckigiros.test', 'vlasnik@grckigiros.test']);
    const mail = emu.state.outbox[0];
    assert.equal(mail.subject, 'DNEVNI IZVEŠTAJ · Sreda, 23.09.2026. · 4.370 RSD');
    assert.match(mail.htmlBody, /Porudžbine/);
    assert.match(mail.body, /Porudžbine: 4\nPrihod: 4\.370 RSD\nDostava: 2\nPreuzimanje: 2\nProsečna porudžbina: 1\.093 RSD\nOtkazano: 1/);
  });

  test('written to DAILY_STATS and not sent twice', () => {
    const row = emu.rows('DAILY_STATS').find((r) => r.Date === '2026-09-23');
    assert.equal(row.Orders, 4);
    assert.equal(row.Revenue, 4370);
    assert.equal(row.Weekday, 'Sreda');
    const again = plain(emu.run('dailyReport_', {}));
    assert.equal(again.skipped, 'already_sent');
    assert.equal(emu.state.outbox.length, 2);
  });
});

describe('weekly and monthly reports', () => {
  const emu = buildHistory();

  test('weekly: Monday 28.09. reports 21.–27.09. and compares with the week before', () => {
    emu.setNow('2026-09-28T02:15:00+02:00');
    const r = plain(emu.run('weeklyReport_', {}));
    assert.equal(r.week, '2026-W39');
    assert.equal(r.stats.orders, 5);
    assert.equal(r.stats.revenue, 4370 + 1640);
    assert.equal(r.report.previous.revenue, 620 + 3290);
    assert.equal(r.stats.busiestDay, 'Sreda');
    assert.ok(r.stats.byHourList.length > 0);
    const row = emu.rows('WEEKLY_STATS').find((w) => w.Week === '2026-W39');
    assert.equal(row['Revenue vs Prev %'], Math.round(((6010 - 3910) / 3910) * 1000) / 10);
    assert.match(emu.state.outbox.at(-1).subject, /^NEDELJNI IZVEŠTAJ · Nedelja 39 · 21\.09\.–27\.09\.2026\. · 6\.010 RSD$/);
  });

  test('monthly: 1.10. reports September with categories, packages and times', () => {
    emu.setNow('2026-10-01T03:15:00+02:00');
    const r = plain(emu.run('monthlyReport_', {}));
    assert.equal(r.month, '2026-09');
    assert.equal(r.stats.orders, 7);
    assert.equal(r.stats.revenue, 620 + 4370 + 1640 + 3290);
    assert.equal(r.stats.cancelled, 1);
    assert.equal(Math.round(r.stats.cancelRate * 10) / 10, 12.5);
    assert.equal(r.stats.topCategory, 'Paketi');
    assert.ok(r.stats.topSlots.some((s) => s.name === 'ŠTO PRE'));
    assert.match(emu.state.outbox.at(-1).subject, /^MESEČNI IZVEŠTAJ · Septembar 2026/);
    assert.equal(emu.rows('MONTHLY_STATS')[0].Month, '2026-09');
  });
});

describe('dashboard, lifetime, maintenance, triggers', () => {
  const emu = buildHistory();

  test('dashboard shows today / week / month / year / lifetime', () => {
    emu.setNow('2026-09-25T20:00:00+02:00');
    const res = plain(emu.run('refreshDashboard'));
    const [today, week, month, year, all] = res.stats;
    assert.equal(today.orders, 1);
    assert.equal(week.orders, 5);
    assert.equal(month.orders, 7);
    assert.equal(year.revenue, all.revenue);
    assert.equal(all.revenue, 9920);
    const grid = emu.sheet('DASHBOARD').data;
    assert.equal(grid[0][0], 'GRČKI GIROS — DASHBOARD');
    assert.equal(grid[7][0], 'Ukupno od prvog dana');
    assert.equal(grid[7][2], 9920);
    assert.equal(grid[20][0], 'POSLEDNJIH 14 DANA', 'row 21 is the chart header row');
  });

  test('nightly maintenance runs every step without errors', () => {
    emu.setNow('2026-09-26T04:30:00+02:00');
    const r = plain(emu.run('runMaintenance'));
    for (const [step, value] of Object.entries(r)) assert.ok(!String(value).startsWith('ERROR'), `${step}: ${value}`);
    const lifetime = Object.fromEntries(emu.rows('LIFETIME_STATS').map((x) => [x.Metric, x.Value]));
    assert.equal(lifetime['Website Generated Revenue (RSD)'], 9920);
    assert.equal(lifetime['Total Orders'], 7);
    assert.equal(lifetime['First Order Date'], '2026-09-16');
    assert.equal(lifetime['Returning Customers'], 1);
    const customer = emu.rows('CUSTOMERS').find((c) => c.Phone === '+381642222222');
    assert.equal(customer.Orders, 3);
    assert.equal(customer['Total Spent'], 820 + 250 + 1810 + 250 + 1640 + 250);
  });

  test('ORDER_ITEMS self-heal from Items JSON', () => {
    const items = emu.sheet('ORDER_ITEMS');
    const before = emu.rows('ORDER_ITEMS').length;
    const victim = emu.rows('ORDERS')[1]['Internal Order ID'];
    items.data = items.data.filter((r, i) => i === 0 || r[0] !== victim);
    assert.equal(emu.rows('ORDER_ITEMS').length, before - 2);
    const repaired = emu.run('repairOrderItems_');
    assert.equal(repaired, 2);
    assert.equal(emu.rows('ORDER_ITEMS').length, before);
  });

  test('data-driven recommendations need at least 3 orders per product', () => {
    const recs = emu.rows('RECS_AUTO');
    assert.ok(recs.every((r) => r['Orders Seen'] >= 3));
  });

  test('installTriggers creates the five schedules; config change is reconciled automatically', () => {
    const list = plain(emu.run('installTriggers'));
    assert.equal(list.length, 5);
    const t = emu.state.triggers;
    assert.deepEqual(t.map((x) => x.handler).sort(), ['refreshDashboard', 'runDailyReport', 'runMaintenance', 'runMonthlyReport', 'runWeeklyReport']);
    const daily = t.find((x) => x.handler === 'runDailyReport');
    assert.equal(daily.atHour, 1);
    assert.equal(t.find((x) => x.handler === 'runWeeklyReport').onWeekDay, 'MONDAY');
    assert.equal(t.find((x) => x.handler === 'runMonthlyReport').onMonthDay, 1);
    assert.equal(t.find((x) => x.handler === 'refreshDashboard').everyMinutes, 10);
    assert.equal(emu.run('reconcileTriggers_'), 'ok');
    emu.sheet('REPORT_CONFIG').data.find((r) => r[0] === 'daily_hour')[1] = '2';
    emu.state.cache.clear();
    assert.equal(emu.run('reconcileTriggers_'), 'reinstalled');
    assert.equal(emu.state.triggers.find((x) => x.handler === 'runDailyReport').atHour, 2);
    assert.equal(emu.state.triggers.length, 5, 'old triggers are removed, never duplicated');
  });

  test('empty period report is still a clear email', () => {
    emu.setNow('2026-09-28T01:20:00+02:00');
    const r = plain(emu.run('dailyReport_', {}));
    assert.equal(r.stats.orders, 0);
    assert.match(emu.state.outbox.at(-1).htmlBody, /nije bilo porudžbina/);
  });
});
