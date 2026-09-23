/**
 * Grčki Giros — time, ids and sheet helpers.
 */

var TIMEZONE = 'Europe/Belgrade';

/** Current time. The local test emulator can pin it through GG_NOW_OVERRIDE; that global never exists on Google. */
function now_() {
  if (typeof GG_NOW_OVERRIDE !== 'undefined' && GG_NOW_OVERRIDE) return new Date(GG_NOW_OVERRIDE);
  return new Date();
}

function fmt_(date, pattern) {
  return Utilities.formatDate(date, TIMEZONE, pattern);
}

/** Wall-clock parts in Europe/Belgrade: { date: 'YYYY-MM-DD', minutes }. */
function nowParts_(date) {
  var s = fmt_(date || now_(), 'yyyy-MM-dd HH:mm');
  return { date: s.slice(0, 10), minutes: parseInt(s.slice(11, 13), 10) * 60 + parseInt(s.slice(14, 16), 10) };
}

function isoLocal_(date) {
  return fmt_(date || now_(), "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function displayDateTime_(date) {
  return fmt_(date || now_(), 'dd.MM.yyyy. HH:mm');
}

function displayDate_(dateStr) {
  var p = String(dateStr).split('-');
  return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] + '.' : String(dateStr);
}

function rolloverHour_() {
  return toNum_(getSettings_().business_day_rollover_hour, 6);
}

/** Business date of a moment: 00:00–05:59 belongs to the previous day (the shop closes at 01:00). */
function businessDateOf_(date) {
  return GG_Scheduling.businessContext(nowParts_(date), { rolloverHour: rolloverHour_() }).date;
}

function hourOf_(date) {
  return parseInt(fmt_(date, 'H'), 10);
}

function addDays_(dateStr, days) {
  return GG_Scheduling.dateAdd(dateStr, days);
}

/** Monday of the ISO week containing dateStr. */
function weekStart_(dateStr) {
  return addDays_(dateStr, 1 - GG_Scheduling.dowOf(dateStr));
}

/** ISO week key, e.g. 2026-W39. */
function isoWeekKey_(dateStr) {
  var thursday = addDays_(weekStart_(dateStr), 3);
  var year = parseInt(thursday.slice(0, 4), 10);
  var jan4 = year + '-01-04';
  var week1Monday = weekStart_(jan4);
  var week = Math.floor(GG_Scheduling.daysBetween(week1Monday, weekStart_(dateStr)) / 7) + 1;
  return year + '-W' + (week < 10 ? '0' : '') + week;
}

function monthKey_(dateStr) {
  return String(dateStr).slice(0, 7);
}

function monthStart_(monthKey) {
  return monthKey + '-01';
}

function monthEnd_(monthKey) {
  var y = parseInt(monthKey.slice(0, 4), 10);
  var m = parseInt(monthKey.slice(5, 7), 10);
  var next = m === 12 ? y + 1 + '-01-01' : y + '-' + (m + 1 < 10 ? '0' : '') + (m + 1) + '-01';
  return addDays_(next, -1);
}

function prevMonthKey_(monthKey) {
  return monthKey_(addDays_(monthStart_(monthKey), -1));
}

function uuid_() {
  return Utilities.getUuid();
}

function randomHex_(length) {
  var s = '';
  while (s.length < length) s += Utilities.getUuid().replace(/-/g, '');
  return s.slice(0, length).toUpperCase();
}

function newRequestId_() {
  return 'rq_' + randomHex_(12).toLowerCase();
}

function toNum_(value, fallback) {
  if (value === '' || value === null || value === undefined) return fallback;
  var n = Number(value);
  return isFinite(n) ? n : fallback;
}

function toBool_(value, fallback) {
  return GG_Scheduling.toBool(value, fallback);
}

function splitList_(value) {
  return String(value === null || value === undefined ? '' : value)
    .split(/[,;\n]/)
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean);
}

function round_(n, digits) {
  var f = Math.pow(10, digits || 0);
  return Math.round(n * f) / f;
}

// ---------------------------------------------------------------------------
// Spreadsheet access. Columns are always addressed by header name.
// ---------------------------------------------------------------------------

var SS_MEMO_ = null;

function ss_() {
  if (SS_MEMO_) return SS_MEMO_;
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  SS_MEMO_ = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  return SS_MEMO_;
}

function sheet_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Sheet "' + name + '" is missing. Run Grčki Giros ▸ Prvo podešavanje.');
  return sh;
}

function headerIndex_(sh) {
  var width = sh.getLastColumn();
  var headers = width ? sh.getRange(1, 1, 1, width).getValues()[0].map(String) : [];
  var map = {};
  headers.forEach(function (h, i) {
    if (h) map[h] = i;
  });
  return { headers: headers, map: map, width: width };
}

/** Reads a whole table as objects ({ header: value, _row }). display=true returns what the owner sees (safe for times). */
function readTable_(name, opts) {
  var sh = sheet_(name);
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return { sheet: sh, headers: lastCol ? headerIndex_(sh).headers : [], rows: [] };
  var range = sh.getRange(1, 1, lastRow, lastCol);
  var values = opts && opts.display ? range.getDisplayValues() : range.getValues();
  var headers = values[0].map(String);
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    var empty = true;
    for (var c = 0; c < r.length; c++) {
      if (r[c] !== '' && r[c] !== null) {
        empty = false;
        break;
      }
    }
    if (empty) continue;
    var obj = { _row: i + 1 };
    for (var k = 0; k < headers.length; k++) if (headers[k]) obj[headers[k]] = r[k];
    rows.push(obj);
  }
  return { sheet: sh, headers: headers, rows: rows };
}

/** Last n data rows only (cheap duplicate checks). */
function readTail_(name, n) {
  var sh = sheet_(name);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  var hi = headerIndex_(sh);
  var start = Math.max(2, lastRow - n + 1);
  var values = sh.getRange(start, 1, lastRow - start + 1, hi.width).getValues();
  return values.map(function (r, i) {
    var obj = { _row: start + i };
    hi.headers.forEach(function (h, c) {
      if (h) obj[h] = r[c];
    });
    return obj;
  });
}

function cellValue_(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return GG_Validation.sheetSafe(value);
  return value;
}

function objectToRow_(hi, obj) {
  var row = [];
  for (var i = 0; i < hi.width; i++) row.push('');
  Object.keys(obj).forEach(function (k) {
    if (Object.prototype.hasOwnProperty.call(hi.map, k)) row[hi.map[k]] = cellValue_(obj[k]);
  });
  return row;
}

/** Appends objects in one write. Returns the first row number written. */
function appendObjects_(name, objects) {
  if (!objects.length) return 0;
  var sh = sheet_(name);
  var hi = headerIndex_(sh);
  var rows = objects.map(function (o) {
    return objectToRow_(hi, o);
  });
  var start = sh.getLastRow() + 1;
  sh.getRange(start, 1, rows.length, hi.width).setValues(rows);
  return start;
}

/** Updates named columns of one row. */
function updateRow_(name, rowNumber, patch, hiOpt) {
  var sh = sheet_(name);
  var hi = hiOpt || headerIndex_(sh);
  Object.keys(patch).forEach(function (k) {
    if (!Object.prototype.hasOwnProperty.call(hi.map, k)) return;
    sh.getRange(rowNumber, hi.map[k] + 1).setValue(cellValue_(patch[k]));
  });
}

/** Row numbers whose column equals value (exact match). */
function findRows_(name, header, value) {
  var sh = sheet_(name);
  var hi = headerIndex_(sh);
  if (!Object.prototype.hasOwnProperty.call(hi.map, header) || sh.getLastRow() < 2) return [];
  var col = hi.map[header] + 1;
  var matches = sh
    .getRange(2, col, sh.getLastRow() - 1, 1)
    .createTextFinder(String(value))
    .matchEntireCell(true)
    .findAll();
  return matches.map(function (r) {
    return r.getRow();
  });
}

function readRow_(name, rowNumber) {
  var sh = sheet_(name);
  var hi = headerIndex_(sh);
  var values = sh.getRange(rowNumber, 1, 1, hi.width).getValues()[0];
  var obj = { _row: rowNumber };
  hi.headers.forEach(function (h, i) {
    if (h) obj[h] = values[i];
  });
  return obj;
}
