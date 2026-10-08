/**
 * Grčki Giros — one-time setup, triggers and the owner's menu in Google Sheets.
 * Routine work (reports, dashboard, maintenance) runs on triggers; nothing needs to be run by hand.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Grčki Giros')
    .addItem('1. Prvo podešavanje (tabele + podaci)', 'menuSetup')
    .addItem('2. Instaliraj automatiku (izveštaji, dashboard)', 'menuInstallTriggers')
    .addItem('3. Postavi PIN za admin panel…', 'menuSetPanelPin')
    .addSeparator()
    .addItem('Osveži dashboard sada', 'refreshDashboard')
    .addItem('Pošalji test porudžbinu (email)', 'menuSendTestOrderEmail')
    .addItem('Pošalji dnevni izveštaj za juče', 'menuSendDailyReport')
    .addItem('Podesi sledeći broj porudžbine…', 'menuSetNextOrderNumber')
    .addItem('Vrati brojač na početak (samo pre puštanja)', 'menuResetOrderCounter')
    .addItem('Učitaj meni iz poslednje verzije sajta…', 'menuReloadCatalog')
    .addItem('Stanje sistema', 'menuSystemStatus')
    .addToUi();
}

// ---------------------------------------------------------------------------
// Menu handlers (thin wrappers with dialogs)
// ---------------------------------------------------------------------------

function menuSetup() {
  var summary = setup();
  SpreadsheetApp.getUi().alert('Podešavanje završeno', summary, SpreadsheetApp.getUi().ButtonSet.OK);
}

function menuReloadCatalog() {
  var ui = SpreadsheetApp.getUi();
  var ok = ui.alert('Učitaj meni iz sajta', 'Listovi CATEGORIES, OPTION_GROUPS, OPTIONS i PRODUCTS biće zamenjeni menijem iz poslednje verzije sajta (data/seed.json). Ručne izmene u ta četiri lista se gube. Nastaviti?', ui.ButtonSet.YES_NO);
  if (ok !== ui.Button.YES) return;
  ui.alert('Meni je učitan', reloadCatalogFromSeed_().join('\n'), ui.ButtonSet.OK);
}

function menuInstallTriggers() {
  var list = installTriggers();
  SpreadsheetApp.getUi().alert('Automatika je uključena', list.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
}

function menuSetPanelPin() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt('PIN za admin panel', 'Unesite novi PIN (6 do 8 cifara). Unosi se na adresi /admin/ (tablet, telefon ili računar u lokalu).', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  setPanelPin_(res.getResponseText());
  ui.alert('PIN je sačuvan.');
}

function menuSetNextOrderNumber() {
  var ui = SpreadsheetApp.getUi();
  var state = counterState_();
  var res = ui.prompt('Sledeći broj porudžbine', 'Poslednji dodeljen broj: ' + state.lastPublic + '. Koji broj da dobije sledeća porudžbina?', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  setNextOrderNumber_(res.getResponseText());
  ui.alert('Sledeća porudžbina dobija broj ' + res.getResponseText().trim() + '.');
}

function menuResetOrderCounter() {
  var ui = SpreadsheetApp.getUi();
  try {
    var next = resetOrderCounter_();
    ui.alert('Brojač je vraćen. Sledeća porudžbina dobija broj ' + next + '.');
  } catch (err) {
    ui.alert(err.message);
  }
}

function menuSendTestOrderEmail() {
  var settings = getSettings_();
  var sample = sampleOrder_(settings);
  var t = kitchenTicket_(sample, settings);
  var staff = notificationRecipients_(settings);
  var res = deliverEmail_(staff, t.subject, t.html, t.text, { priorityFirst: true });
  SpreadsheetApp.getUi().alert('Test email', emailStatusOf_(res, staff.length) + (res.test ? '\n(test režim: poslato samo test primaocu)' : ''), SpreadsheetApp.getUi().ButtonSet.OK);
}

function menuSendDailyReport() {
  var res = dailyReport_({ force: true });
  SpreadsheetApp.getUi().alert('Dnevni izveštaj za ' + res.date + ': ' + res.stats.orders + ' porudžbina, ' + GG_Money.formatRSD(res.stats.revenue));
}

function menuSystemStatus() {
  SpreadsheetApp.getUi().alert('Stanje sistema', systemStatus_().join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
}

function systemStatus_() {
  var settings = getSettings_();
  var props = PropertiesService.getScriptProperties();
  var counter = counterState_();
  var triggers = ScriptApp.getProjectTriggers().map(function (t) {
    return t.getHandlerFunction();
  });
  var quota = '?';
  try {
    quota = MailApp.getRemainingDailyQuota();
  } catch (ignored) {}
  return [
    'Poslednji broj porudžbine: ' + counter.lastPublic + ' (ukupno porudžbina: ' + counter.seq + ')',
    'Porudžbine: ' + (toBool_(settings.ordering_enabled, true) ? 'UKLJUČENE' : 'PAUZIRANE'),
    'Test režim emailova: ' + (toBool_(settings.test_mode, true) ? 'DA (emailovi idu samo test primaocu)' : 'NE'),
    'Preostala email kvota danas: ' + quota,
    'PIN za admin panel: ' + (props.getProperty('PANEL_PIN_HASH') ? 'podešen' : 'NIJE podešen'),
    'Okidači: ' + (triggers.length ? triggers.join(', ') : 'NISU instalirani'),
    'Poslednji dnevni izveštaj: ' + (props.getProperty('LAST_DAILY_REPORT') || '—')
  ];
}

// ---------------------------------------------------------------------------
// Setup: sheets, headers, formats, seed data
// ---------------------------------------------------------------------------

function seedRowsFor_(key) {
  var s = SEED;
  var c = s.catalog;
  function yes(b) {
    return b !== false;
  }
  switch (key) {
    case 'SETTINGS':
      return s.settings.map(function (r) {
        return { key: r.key, value: r.value, note: r.note };
      });
    case 'REPORT_CONFIG':
      return s.reportConfig.map(function (r) {
        return { key: r.key, value: r.value, note: r.note };
      });
    case 'HOURS':
      return s.hours.map(function (h) {
        return { dow: h.dow, day: h.day, open: h.open, close: h.close, delivery_open: h.delivery_open, delivery_close: h.delivery_close, break_start: h.break_start || '', break_end: h.break_end || '', closed: !!h.closed };
      });
    case 'SPECIAL_HOURS':
      return s.specialHours.map(function (h) {
        return { date: h.date, label: h.label, open: h.open, close: h.close, delivery_open: h.delivery_open, delivery_close: h.delivery_close, closed: !!h.closed, active: !!h.active, note: h.note };
      });
    case 'ZONES':
      return s.zones.map(function (z) {
        return { id: z.id, name: z.name, areas: z.areas, fee: z.fee, min_order: z.min_order, active: yes(z.active), sort: z.sort, note: z.note };
      });
    case 'CATEGORIES':
      return c.categories.map(function (x) {
        return { id: x.id, name: x.name, description: x.description, sort: x.sort, active: yes(x.active) };
      });
    case 'OPTION_GROUPS':
      return c.groups.map(function (g) {
        return { id: g.id, name: g.name, type: g.type, required: !!g.required, min: g.min, max: g.max, display: g.display, hint: g.hint, sort: g.sort };
      });
    case 'OPTIONS':
      return c.options.map(function (o) {
        return { id: o.id, group_id: o.groupId, name: o.name, price: o.price, available: yes(o.available), sort: o.sort };
      });
    case 'PRODUCTS':
      return c.products.map(function (p) {
        return {
          id: p.id,
          category_id: p.categoryId,
          name: p.name,
          description: p.description,
          price: p.price,
          compare_price: p.comparePrice || '',
          available: yes(p.available),
          delivery: yes(p.delivery),
          pickup: yes(p.pickup),
          tags: (p.tags || []).join(', '),
          badge: p.badge || '',
          groups: (p.groups || []).join(', '),
          defaults: (p.defaults || []).join(', '),
          pairs: (p.pairs || []).join(', '),
          bundle_hint: p.bundleHint || '',
          includes: p.includes || '',
          kind: p.kind || 'item',
          image: p.image || '',
          art: p.art || '',
          sort: p.sort,
          active: true,
          demo: !!p.demo
        };
      });
    default:
      return [];
  }
}

var CHECKBOX_COLUMNS_ = {
  PRODUCTS: ['available', 'delivery', 'pickup', 'active', 'demo'],
  CATEGORIES: ['active'],
  OPTIONS: ['available'],
  OPTION_GROUPS: ['required'],
  HOURS: ['closed'],
  SPECIAL_HOURS: ['closed', 'active'],
  ZONES: ['active']
};

var TAB_COLORS_ = {
  DASHBOARD: '#1B4F8C', ORDERS: '#F5A623', ORDER_ITEMS: '#F5A623', CUSTOMERS: '#F5A623',
  PRODUCTS: '#4C7A3A', CATEGORIES: '#4C7A3A', OPTION_GROUPS: '#4C7A3A', OPTIONS: '#4C7A3A',
  SETTINGS: '#16202E', HOURS: '#16202E', SPECIAL_HOURS: '#16202E', ZONES: '#16202E', REPORT_CONFIG: '#16202E',
  FEEDBACK: '#F5A623', SYSTEM_LOG: '#999999', ERROR_LOG: '#D1432B'
};

function ensureSheet_(key) {
  var ss = ss_();
  var name = SHEETS[key];
  var sh = ss.getSheetByName(name);
  var created = false;
  if (!sh) {
    sh = ss.insertSheet(name);
    created = true;
  }
  if (key === 'DASHBOARD') return { sheet: sh, created: created };
  var headers = COLUMNS[key];
  var hi = headerIndex_(sh);
  if (!hi.width) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    // Add columns introduced by newer versions without touching the owner's order.
    var missing = headers.filter(function (h) {
      return !(h in hi.map);
    });
    if (missing.length) sh.getRange(1, hi.width + 1, 1, missing.length).setValues([missing]);
  }
  var width = sh.getLastColumn();
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, width).setFontWeight('bold').setBackground('#16202E').setFontColor('#FFFFFF');
  (TEXT_COLUMNS[key] || []).forEach(function (h) {
    var idx = headerIndex_(sh).map[h];
    if (idx !== undefined) sh.getRange(2, idx + 1, Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat('@');
  });
  if (TAB_COLORS_[key]) sh.setTabColor(TAB_COLORS_[key]);
  return { sheet: sh, created: created };
}

function applyValidation_(key) {
  var sh = sheet_(SHEETS[key]);
  var hi = headerIndex_(sh);
  var rows = Math.max(sh.getMaxRows() - 1, 1);
  (CHECKBOX_COLUMNS_[key] || []).forEach(function (h) {
    if (h in hi.map) sh.getRange(2, hi.map[h] + 1, rows, 1).insertCheckboxes();
  });
  if (key === 'ORDERS' && 'Status' in hi.map) {
    var rule = SpreadsheetApp.newDataValidation().requireValueInList(STATUS_LIST, true).setAllowInvalid(false).build();
    sh.getRange(2, hi.map.Status + 1, rows, 1).setDataValidation(rule);
  }
}

/** Creates everything that is missing. Safe to run again: existing data is never overwritten. */
function setup() {
  var log = [];
  var ss = ss_();
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  try {
    ss.setSpreadsheetTimeZone(TIMEZONE);
  } catch (ignored) {}
  SHEET_ORDER.forEach(function (key) {
    var res = ensureSheet_(key);
    if (res.created) log.push('+ ' + SHEETS[key]);
    var seed = seedRowsFor_(key);
    if (seed.length && res.sheet.getLastRow() < 2) {
      appendObjects_(SHEETS[key], seed);
      log.push('  podaci: ' + SHEETS[key] + ' (' + seed.length + ')');
    }
    if (key !== 'DASHBOARD') applyValidation_(key);
  });
  SHEET_ORDER.forEach(function (key, i) {
    var sh = ss.getSheetByName(SHEETS[key]);
    ss.setActiveSheet(sh);
    ss.moveActiveSheet(i + 1);
  });
  // The empty first tab of a new spreadsheet, in English, Serbian Latin and Serbian Cyrillic Sheets. Never one with data.
  ['Sheet1', 'List1', 'Лист1'].forEach(function (name) {
    var defaultSheet = ss.getSheetByName(name);
    if (defaultSheet && defaultSheet.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(defaultSheet);
  });
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('ORDER_SEQ')) props.setProperties({ ORDER_SEQ: '0', PUBLIC_NO: '0' });
  secret_('TOKEN_SECRET');
  invalidateConfigCache_();
  writeDashboard_(loadStatsData_(true));
  buildDashboardChart_();
  ss.setActiveSheet(ss.getSheetByName(SHEETS.DASHBOARD));
  log_('INFO', 'setup', 'OK', 'Podešavanje: ' + (log.length ? log.join(' ') : 'sve je već postojalo'));
  return log.length ? log.join('\n') : 'Sve tabele su već postojale. Ništa nije prepisano.';
}

/**
 * Replaces the four menu sheets with the menu that shipped with the last deploy (SEED = data/seed.json).
 * Contents only: headers, formats and validation stay. Nothing else (SETTINGS, orders, jobs) is touched.
 */
function reloadCatalogFromSeed_() {
  var out = [];
  ['CATEGORIES', 'OPTION_GROUPS', 'OPTIONS', 'PRODUCTS'].forEach(function (key) {
    var sh = sheet_(SHEETS[key]);
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
    var rows = seedRowsFor_(key);
    appendObjects_(SHEETS[key], rows);
    out.push(SHEETS[key] + ': ' + rows.length);
  });
  invalidateConfigCache_();
  log_('INFO', 'catalog.reload', 'OK', out.join(', '));
  return out;
}

function buildDashboardChart_() {
  var sh = sheet_(SHEETS.DASHBOARD);
  if (sh.getCharts().length) return;
  var chart = sh
    .newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(sh.getRange('A21:A35'))
    .addRange(sh.getRange('D21:D35'))
    .setNumHeaders(1)
    .setPosition(3, 9, 0, 0)
    .setOption('title', 'Prihod po danu (RSD), poslednjih 14 dana')
    .setOption('legend', { position: 'none' })
    .setOption('colors', ['#1B4F8C'])
    .build();
  sh.insertChart(chart);
}

// ---------------------------------------------------------------------------
// Triggers
// ---------------------------------------------------------------------------

var TRIGGER_HANDLERS_ = ['runDailyReport', 'runWeeklyReport', 'runMonthlyReport', 'refreshDashboard', 'runMaintenance'];

function triggerSignature_() {
  var c = getReportConfig_();
  return [c.daily_hour, c.weekly_day, c.weekly_hour, c.monthly_day, c.monthly_hour, c.dashboard_refresh_min].join('|');
}

function installTriggers() {
  var c = getReportConfig_();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (TRIGGER_HANDLERS_.indexOf(t.getHandlerFunction()) !== -1) ScriptApp.deleteTrigger(t);
  });
  var dailyHour = Math.min(23, Math.max(0, toNum_(c.daily_hour, 1)));
  var weeklyHour = Math.min(23, Math.max(0, toNum_(c.weekly_hour, 2)));
  var monthlyHour = Math.min(23, Math.max(0, toNum_(c.monthly_hour, 3)));
  var monthlyDay = Math.min(28, Math.max(1, toNum_(c.monthly_day, 1)));
  var weekday = String(c.weekly_day || 'MONDAY').toUpperCase();
  if (!ScriptApp.WeekDay[weekday]) weekday = 'MONDAY';
  var refresh = [1, 5, 10, 15, 30].indexOf(toNum_(c.dashboard_refresh_min, 10)) !== -1 ? toNum_(c.dashboard_refresh_min, 10) : 10;

  ScriptApp.newTrigger('runDailyReport').timeBased().everyDays(1).atHour(dailyHour).nearMinute(15).create();
  ScriptApp.newTrigger('runWeeklyReport').timeBased().onWeekDay(ScriptApp.WeekDay[weekday]).atHour(weeklyHour).nearMinute(15).create();
  ScriptApp.newTrigger('runMonthlyReport').timeBased().onMonthDay(monthlyDay).atHour(monthlyHour).nearMinute(15).create();
  ScriptApp.newTrigger('refreshDashboard').timeBased().everyMinutes(refresh).create();
  ScriptApp.newTrigger('runMaintenance').timeBased().everyDays(1).atHour(4).nearMinute(30).create();
  PropertiesService.getScriptProperties().setProperty('TRIGGERS_SIGNATURE', triggerSignature_());
  log_('INFO', 'installTriggers', 'OK', 'Okidači instalirani');
  return [
    'Dnevni izveštaj: svaki dan oko ' + dailyHour + ':00–' + dailyHour + ':30',
    'Nedeljni izveštaj: ' + weekday + ' oko ' + weeklyHour + ':00',
    'Mesečni izveštaj: ' + monthlyDay + '. u mesecu oko ' + monthlyHour + ':00',
    'Dashboard: na svakih ' + refresh + ' min',
    'Održavanje (rollup, CRM, preporuke, logovi): svake noći oko 04:30'
  ];
}

/** Maintenance keeps triggers in line with REPORT_CONFIG, so the owner never re-runs setup after editing hours. */
function reconcileTriggers_() {
  var props = PropertiesService.getScriptProperties();
  var installed = ScriptApp.getProjectTriggers().map(function (t) {
    return t.getHandlerFunction();
  });
  var complete = TRIGGER_HANDLERS_.every(function (h) {
    return installed.indexOf(h) !== -1;
  });
  if (complete && props.getProperty('TRIGGERS_SIGNATURE') === triggerSignature_()) return 'ok';
  installTriggers();
  return 'reinstalled';
}

// ---------------------------------------------------------------------------
// Sample order for the test email
// ---------------------------------------------------------------------------

function sampleOrder_(settings) {
  var created = now_();
  return {
    id: 'GG-' + fmt_(created, 'yyyyMMdd') + '-1042-TEST',
    publicNumber: 1042,
    businessDate: businessDateOf_(created),
    createdAt: created,
    createdIso: isoLocal_(created),
    acceptByIso: isoLocal_(new Date(created.getTime() + 5 * 60000)),
    mode: 'delivery',
    type: 'DELIVERY',
    status: 'NEW',
    customer: { name: 'Test Kupac', phone: '+381641234567', phoneDisplay: '064 123 4567', email: '' },
    address: { street: 'Bulevar oslobođenja', number: '12a', apt: '4', floor: '2', note: 'Interfon ne radi, pozvati.', zoneId: 'ns-grad', zoneName: 'Novi Sad — grad' },
    note: 'Bez luka u oba.',
    lines: [
      { name: 'Klasik', qty: 2, lineTotal: 1240, summary: 'Pileće · Tzatziki · Paradajz · Origano', removedSummary: 'BEZ: ljubičasti luk', note: '' },
      { name: 'Coca-Cola 0.33 l', qty: 1, lineTotal: 200, summary: '', removedSummary: '', note: '' }
    ],
    itemCount: 3,
    subtotal: 1440,
    deliveryFee: 250,
    total: 1690,
    cash: 2000,
    change: 310,
    when: 'asap',
    scheduledDate: '',
    scheduledTime: '',
    promisedLabel: fmt_(new Date(created.getTime() + 60 * 60000), 'HH:mm'),
    statusToken: 'test',
    channel: 'test',
    locationId: settings.location_id
  };
}
