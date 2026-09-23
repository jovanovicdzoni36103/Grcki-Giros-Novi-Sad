/**
 * Grčki Giros — scheduled jobs: daily/weekly/monthly reports, rollup sheets, dashboard, maintenance.
 * Public (no underscore) functions are trigger handlers installed by installTriggers().
 */

var MONTH_NAMES_ = ['', 'Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun', 'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];

var STATS_DATA_ = null;

function loadStatsData_(reload) {
  if (STATS_DATA_ && !reload) return STATS_DATA_;
  STATS_DATA_ = {
    orders: orderRecords_(readTable_(SHEETS.ORDERS).rows),
    items: itemRecords_(readTable_(SHEETS.ORDER_ITEMS).rows)
  };
  return STATS_DATA_;
}

function includeDelivery_() {
  return toBool_(getSettings_().revenue_includes_delivery, false);
}

function lifetime_(data) {
  var s = aggregate_(data.orders, data.items, '0000-01-01', '9999-12-31', includeDelivery_());
  return { firstDate: s.firstDate, revenue: s.revenue, orders: s.orders, aov: s.aov, stats: s };
}

function reportRecipients_() {
  return recipients_(getReportConfig_().report_recipients);
}

function sendReport_(kind, report) {
  var settings = getSettings_();
  var mail = reportEmail_(report, settings);
  var res = deliverEmail_(reportRecipients_(), mail.subject, mail.html, mail.text, { priorityFirst: true });
  log_(res.sent.length ? 'INFO' : 'ERROR', 'report.' + kind, res.sent.length ? 'OK' : 'FAIL', report.periodLabel + ' → ' + emailStatusOf_(res, reportRecipients_().length));
  return res;
}

// ---------------------------------------------------------------------------
// Daily
// ---------------------------------------------------------------------------

function runDailyReport() {
  return dailyReport_({});
}

/** opts: { date: 'YYYY-MM-DD', force: true } */
function dailyReport_(opts) {
  var o = opts || {};
  var started = Date.now();
  var cfg = getReportConfig_();
  if (!o.force && !toBool_(cfg.daily_enabled, true)) return { skipped: 'disabled' };
  var target = o.date || addDays_(nowParts_().date, -1);
  var props = PropertiesService.getScriptProperties();
  if (!o.force && props.getProperty('LAST_DAILY_REPORT') === target) return { skipped: 'already_sent', date: target };
  try {
    var data = loadStatsData_(true);
    var inc = includeDelivery_();
    var stats = aggregate_(data.orders, data.items, target, target, inc);
    var prevDate = addDays_(target, -7);
    var previous = aggregate_(data.orders, data.items, prevDate, prevDate, inc);
    upsertDailyStats_(target, stats);
    var report = {
      kind: 'daily',
      title: 'DNEVNI IZVEŠTAJ',
      periodLabel: WEEKDAY_NAMES_[GG_Scheduling.dowOf(target)] + ', ' + displayDate_(target),
      stats: stats,
      previous: previous,
      compareLabel: 'isti dan prošle nedelje',
      lifetime: lifetime_(data)
    };
    var res = sendReport_('daily', report);
    if (res.sent.length) props.setProperty('LAST_DAILY_REPORT', target);
    log_('INFO', 'runDailyReport', 'OK', target + ': ' + stats.orders + ' porudžbina, ' + stats.revenue + ' RSD', { durationMs: Date.now() - started });
    return { date: target, stats: stats, email: res, report: report };
  } catch (err) {
    logError_('runDailyReport', err, { context: { target: target } });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Weekly
// ---------------------------------------------------------------------------

function runWeeklyReport() {
  return weeklyReport_({});
}

function weeklyReport_(opts) {
  var o = opts || {};
  var cfg = getReportConfig_();
  if (!o.force && !toBool_(cfg.weekly_enabled, true)) return { skipped: 'disabled' };
  var from = o.from || addDays_(weekStart_(nowParts_().date), -7);
  var to = addDays_(from, 6);
  var key = isoWeekKey_(from);
  var props = PropertiesService.getScriptProperties();
  if (!o.force && props.getProperty('LAST_WEEKLY_REPORT') === key) return { skipped: 'already_sent', week: key };
  try {
    var data = loadStatsData_(true);
    var inc = includeDelivery_();
    var stats = aggregate_(data.orders, data.items, from, to, inc);
    var previous = aggregate_(data.orders, data.items, addDays_(from, -7), addDays_(to, -7), inc);
    upsertWeeklyStats_(key, from, to, stats, previous);
    var report = {
      kind: 'weekly',
      title: 'NEDELJNI IZVEŠTAJ',
      periodLabel: 'Nedelja ' + key.slice(-2) + ' · ' + displayDate_(from).slice(0, 6) + '–' + displayDate_(to),
      stats: stats,
      previous: previous,
      compareLabel: 'prethodna nedelja',
      lifetime: lifetime_(data)
    };
    var res = sendReport_('weekly', report);
    if (res.sent.length) props.setProperty('LAST_WEEKLY_REPORT', key);
    return { week: key, stats: stats, email: res, report: report };
  } catch (err) {
    logError_('runWeeklyReport', err, { context: { from: from } });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Monthly
// ---------------------------------------------------------------------------

function runMonthlyReport() {
  return monthlyReport_({});
}

function monthlyReport_(opts) {
  var o = opts || {};
  var cfg = getReportConfig_();
  if (!o.force && !toBool_(cfg.monthly_enabled, true)) return { skipped: 'disabled' };
  var key = o.month || prevMonthKey_(monthKey_(nowParts_().date));
  var props = PropertiesService.getScriptProperties();
  if (!o.force && props.getProperty('LAST_MONTHLY_REPORT') === key) return { skipped: 'already_sent', month: key };
  try {
    var data = loadStatsData_(true);
    var inc = includeDelivery_();
    var stats = aggregate_(data.orders, data.items, monthStart_(key), monthEnd_(key), inc);
    var prevKey = prevMonthKey_(key);
    var previous = aggregate_(data.orders, data.items, monthStart_(prevKey), monthEnd_(prevKey), inc);
    upsertMonthlyStats_(key, stats, previous);
    var report = {
      kind: 'monthly',
      title: 'MESEČNI IZVEŠTAJ',
      periodLabel: MONTH_NAMES_[parseInt(key.slice(5, 7), 10)] + ' ' + key.slice(0, 4),
      stats: stats,
      previous: previous,
      compareLabel: 'prethodni mesec',
      lifetime: lifetime_(data)
    };
    var res = sendReport_('monthly', report);
    if (res.sent.length) props.setProperty('LAST_MONTHLY_REPORT', key);
    return { month: key, stats: stats, email: res, report: report };
  } catch (err) {
    logError_('runMonthlyReport', err, { context: { month: key } });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Rollup sheets
// ---------------------------------------------------------------------------

function upsertByKey_(sheetName, keyHeader, key, record) {
  var rows = findRows_(sheetName, keyHeader, key);
  if (rows.length) updateRow_(sheetName, rows[0], record);
  else appendObjects_(sheetName, [record]);
}

function upsertDailyStats_(date, s) {
  upsertByKey_(SHEETS.DAILY_STATS, 'Date', date, {
    Date: date,
    Weekday: WEEKDAY_NAMES_[GG_Scheduling.dowOf(date)],
    Orders: s.orders,
    Revenue: s.revenue,
    'Delivery Orders': s.delivery,
    'Pickup Orders': s.pickup,
    Cancelled: s.cancelled,
    'Average Order': s.aov,
    'Delivery Fees': s.deliveryFees,
    'Items Sold': s.itemsSold,
    'Top Product': s.topProduct,
    'Busiest Hour': s.busiestHour,
    'Updated At': isoLocal_()
  });
}

function upsertWeeklyStats_(key, from, to, s, prev) {
  upsertByKey_(SHEETS.WEEKLY_STATS, 'Week', key, {
    Week: key,
    From: from,
    To: to,
    Orders: s.orders,
    Revenue: s.revenue,
    'Average Order': s.aov,
    'Delivery Orders': s.delivery,
    'Pickup Orders': s.pickup,
    Cancelled: s.cancelled,
    'Cancellation %': round_(s.cancelRate, 1),
    'Top Product': s.topProduct,
    'Top Package': s.topPackage,
    'Busiest Day': s.busiestDay,
    'Busiest Hour': s.busiestHour,
    'Revenue vs Prev %': prev ? pctOrBlank_(growthPct_(s.revenue, prev.revenue)) : '',
    'Orders vs Prev %': prev ? pctOrBlank_(growthPct_(s.orders, prev.orders)) : '',
    'Updated At': isoLocal_()
  });
}

function upsertMonthlyStats_(key, s, prev) {
  upsertByKey_(SHEETS.MONTHLY_STATS, 'Month', key, {
    Month: key,
    Orders: s.orders,
    Revenue: s.revenue,
    'Average Order': s.aov,
    'Delivery Orders': s.delivery,
    'Pickup Orders': s.pickup,
    Cancelled: s.cancelled,
    'Cancellation %': round_(s.cancelRate, 1),
    'Top Product': s.topProduct,
    'Top Category': s.topCategory,
    'Top Package': s.topPackage,
    'Top Time': s.topSlot,
    'Busiest Day': s.busiestDay,
    'Busiest Hour': s.busiestHour,
    'Growth vs Prev %': prev ? pctOrBlank_(growthPct_(s.revenue, prev.revenue)) : '',
    'Updated At': isoLocal_()
  });
}

function pctOrBlank_(v) {
  return v === null || !isFinite(v) ? '' : round_(v, 1);
}

function writeLifetimeStats_(data) {
  var today = businessDateOf_(now_());
  var inc = includeDelivery_();
  var all = aggregate_(data.orders, data.items, '0000-01-01', '9999-12-31', inc);
  var year = aggregate_(data.orders, data.items, today.slice(0, 4) + '-01-01', today, inc);
  var stamp = isoLocal_();
  var rows = [
    ['Website Generated Revenue (RSD)', all.revenue],
    ['Total Orders', all.orders],
    ['Average Order (RSD)', all.aov],
    ['First Order Date', all.firstDate],
    ['Revenue This Year (RSD)', year.revenue],
    ['Orders This Year', year.orders],
    ['Delivery %', round_(all.deliveryPct, 1)],
    ['Pickup %', round_(all.pickupPct, 1)],
    ['Cancellation %', round_(all.cancelRate, 1)],
    ['Cancelled Orders', all.cancelled],
    ['Delivery Fees (RSD)', all.deliveryFees],
    ['Items Sold', all.itemsSold],
    ['Top Product', all.topProduct],
    ['Top Category', all.topCategory],
    ['Top Package', all.topPackage],
    ['Busiest Hour', all.busiestHour],
    ['Busiest Weekday', all.busiestDay],
    ['Most Requested Time', all.topSlot],
    ['Unique Customers', all.customers],
    ['Returning Customers', all.returningCustomers],
    ['Returning Customers %', all.customers ? round_((all.returningCustomers / all.customers) * 100, 1) : 0]
  ];
  var sh = sheet_(SHEETS.LIFETIME_STATS);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
  appendObjects_(
    SHEETS.LIFETIME_STATS,
    rows.map(function (r) {
      return { Metric: r[0], Value: r[1], 'Updated At': stamp };
    })
  );
  return all;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

function refreshDashboard() {
  var started = Date.now();
  try {
    var result = writeDashboard_(loadStatsData_(true));
    log_('DEBUG', 'refreshDashboard', 'OK', 'Dashboard osvežen', { durationMs: Date.now() - started });
    return result;
  } catch (err) {
    logError_('refreshDashboard', err);
    throw err;
  }
}

function writeDashboard_(data) {
  var sh = sheet_(SHEETS.DASHBOARD);
  var today = businessDateOf_(now_());
  var inc = includeDelivery_();
  var month = monthKey_(today);
  var periods = [
    ['Danas (' + displayDate_(today) + ')', today, today],
    ['Ove nedelje', weekStart_(today), today],
    ['Ovog meseca', monthStart_(month), today],
    ['Ove godine', today.slice(0, 4) + '-01-01', today],
    ['Ukupno od prvog dana', '0000-01-01', '9999-12-31']
  ];
  var stats = periods.map(function (p) {
    return aggregate_(data.orders, data.items, p[1], p[2], inc);
  });
  var all = stats[4];
  var monthStats = stats[2];

  var grid = [];
  grid.push(['GRČKI GIROS — DASHBOARD', '', '', '', '', '', 'Osveženo: ' + displayDateTime_(now_())]);
  grid.push(['Prihod sajta = hrana iz porudžbina koje nisu otkazane' + (inc ? ' (sa dostavom)' : ' (bez dostave)'), '', '', '', '', '', all.firstDate ? 'Prva porudžbina: ' + displayDate_(all.firstDate) : 'Još nema porudžbina']);
  grid.push(['PERIOD', 'PORUDŽBINE', 'PRIHOD (RSD)', 'PROSEČNA (RSD)', 'DOSTAVA', 'PREUZIMANJE', 'OTKAZANO']);
  periods.forEach(function (p, i) {
    var s = stats[i];
    grid.push([p[0], s.orders, s.revenue, s.aov, s.delivery, s.pickup, s.cancelled]);
  });
  grid.push(['', '', '', '', '', '', '']);
  grid.push(['NAJBOLJE', 'OVAJ MESEC', '', 'UKUPNO', '', '', '']);
  [
    ['Top proizvod', monthStats.topProduct, all.topProduct],
    ['Top kategorija', monthStats.topCategory, all.topCategory],
    ['Top paket', monthStats.topPackage, all.topPackage],
    ['Najprometniji sat', monthStats.busiestHour, all.busiestHour],
    ['Najprometniji dan', monthStats.busiestDay, all.busiestDay],
    ['Najčešće vreme', monthStats.topSlot, all.topSlot],
    ['Dostava / preuzimanje', round_(monthStats.deliveryPct, 0) + '% / ' + round_(monthStats.pickupPct, 0) + '%', round_(all.deliveryPct, 0) + '% / ' + round_(all.pickupPct, 0) + '%'],
    ['Otkazano', round_(monthStats.cancelRate, 1) + '%', round_(all.cancelRate, 1) + '%'],
    ['Kupci (povratni)', monthStats.customers + ' (' + monthStats.returningCustomers + ')', all.customers + ' (' + all.returningCustomers + ')']
  ].forEach(function (r) {
    grid.push([r[0], r[1] || '—', '', r[2] || '—', '', '', '']);
  });
  grid.push(['', '', '', '', '', '', '']);
  grid.push(['POSLEDNJIH 14 DANA', 'DAN', 'PORUDŽBINE', 'PRIHOD (RSD)', 'DOSTAVA', 'PREUZIMANJE', 'OTKAZANO']);
  for (var i = 13; i >= 0; i--) {
    var d = addDays_(today, -i);
    var s = aggregate_(data.orders, data.items, d, d, inc);
    grid.push([displayDate_(d), WEEKDAY_NAMES_[GG_Scheduling.dowOf(d)], s.orders, s.revenue, s.delivery, s.pickup, s.cancelled]);
  }

  var width = 7;
  sh.getRange(1, 1, Math.max(sh.getMaxRows ? sh.getMaxRows() : grid.length, grid.length), width).clearContent();
  sh.getRange(1, 1, grid.length, width).setValues(grid);
  return { today: today, stats: stats, rows: grid.length };
}

// ---------------------------------------------------------------------------
// Maintenance (nightly)
// ---------------------------------------------------------------------------

function runMaintenance() {
  var started = Date.now();
  var results = {};
  var data = loadStatsData_(true);
  var inc = includeDelivery_();
  var today = businessDateOf_(now_());
  var steps = [
    ['items.repair', function () {
      var repaired = repairOrderItems_();
      if (repaired) data = loadStatsData_(true);
      return repaired;
    }],
    ['rollup.daily', function () {
      var dates = {};
      data.orders.forEach(function (o) {
        if (o.businessDate >= addDays_(today, -35)) dates[o.businessDate] = true;
      });
      Object.keys(dates).forEach(function (d) {
        upsertDailyStats_(d, aggregate_(data.orders, data.items, d, d, inc));
      });
      return Object.keys(dates).length;
    }],
    ['rollup.weekly', function () {
      [addDays_(weekStart_(today), -7), weekStart_(today)].forEach(function (from) {
        var to = addDays_(from, 6);
        var prev = aggregate_(data.orders, data.items, addDays_(from, -7), addDays_(to, -7), inc);
        upsertWeeklyStats_(isoWeekKey_(from), from, to, aggregate_(data.orders, data.items, from, to, inc), prev);
      });
      return 2;
    }],
    ['rollup.monthly', function () {
      [prevMonthKey_(monthKey_(today)), monthKey_(today)].forEach(function (key) {
        var pk = prevMonthKey_(key);
        upsertMonthlyStats_(key, aggregate_(data.orders, data.items, monthStart_(key), monthEnd_(key), inc), aggregate_(data.orders, data.items, monthStart_(pk), monthEnd_(pk), inc));
      });
      return 2;
    }],
    ['lifetime', function () {
      return writeLifetimeStats_(data).orders;
    }],
    ['recs', function () {
      return writeRecsAuto_(data);
    }],
    ['crm.rebuild', function () {
      var lock = LockService.getScriptLock();
      if (!lock.tryLock(LOCK_WAIT_MS)) return 'skipped (busy)';
      try {
        return rebuildCustomers_();
      } finally {
        lock.releaseLock();
      }
    }],
    ['dashboard', function () {
      return writeDashboard_(data).rows;
    }],
    ['logs.trim', function () {
      trimLogs_();
      return 'ok';
    }],
    ['triggers', function () {
      return reconcileTriggers_();
    }]
  ];
  steps.forEach(function (step) {
    try {
      results[step[0]] = step[1]();
    } catch (err) {
      results[step[0]] = 'ERROR: ' + err.message;
      logError_('maintenance.' + step[0], err);
    }
  });
  log_('INFO', 'runMaintenance', 'OK', 'Noćno održavanje završeno', { durationMs: Date.now() - started, details: results });
  return results;
}

function writeRecsAuto_(data) {
  var since = addDays_(businessDateOf_(now_()), -180);
  var recs = coOccurrence_(data.orders, data.items, since, 3);
  var sh = sheet_(SHEETS.RECS_AUTO);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
  var stamp = isoLocal_();
  appendObjects_(
    SHEETS.RECS_AUTO,
    recs
      .filter(function (r) {
        return r.seen >= 3;
      })
      .map(function (r) {
        return { 'Product ID': r.productId, Product: r.name, 'Often With (IDs)': r.ids.join(', '), 'Often With': r.names.join(', '), 'Orders Seen': r.seen, 'Updated At': stamp };
      })
  );
  invalidateConfigCache_();
  return recs.length;
}
