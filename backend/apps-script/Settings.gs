/**
 * Grčki Giros — configuration read from Sheets (SETTINGS, HOURS, SPECIAL_HOURS, ZONES, REPORT_CONFIG).
 * Cached for CACHE_TTL_SEC; onEdit() clears the cache so owner edits show up immediately.
 */

var MEMO_ = {};

function cached_(key, ttlSec, loader) {
  if (Object.prototype.hasOwnProperty.call(MEMO_, key)) return MEMO_[key];
  var cache = CacheService.getScriptCache();
  var hit = null;
  try {
    hit = cache.get('gg:' + key);
  } catch (ignored) {}
  if (hit) {
    MEMO_[key] = JSON.parse(hit);
    return MEMO_[key];
  }
  var value = loader();
  try {
    cache.put('gg:' + key, JSON.stringify(value), ttlSec);
  } catch (ignored) {
    // Values over 100 KB are simply not cached.
  }
  MEMO_[key] = value;
  return value;
}

var CONFIG_CACHE_KEYS = ['settings', 'hours', 'special', 'zones', 'catalog', 'reportcfg', 'recs', 'bootstrap'];

function invalidateConfigCache_() {
  MEMO_ = {};
  try {
    CacheService.getScriptCache().removeAll(
      CONFIG_CACHE_KEYS.map(function (k) {
        return 'gg:' + k;
      })
    );
  } catch (ignored) {}
}

function keyValueSheet_(name) {
  var out = {};
  readTable_(name, { display: true }).rows.forEach(function (r) {
    var key = String(r.key || '').trim();
    if (key) out[key] = String(r.value === undefined ? '' : r.value).trim();
  });
  return out;
}

function getSettings_() {
  return cached_('settings', CACHE_TTL_SEC, function () {
    var fromSheet = keyValueSheet_(SHEETS.SETTINGS);
    var merged = {};
    Object.keys(DEFAULT_SETTINGS).forEach(function (k) {
      merged[k] = DEFAULT_SETTINGS[k];
    });
    Object.keys(fromSheet).forEach(function (k) {
      if (fromSheet[k] !== '' || !(k in merged)) merged[k] = fromSheet[k];
    });
    return merged;
  });
}

function getReportConfig_() {
  return cached_('reportcfg', CACHE_TTL_SEC, function () {
    return keyValueSheet_(SHEETS.REPORT_CONFIG);
  });
}

function getHours_() {
  return cached_('hours', CACHE_TTL_SEC, function () {
    return readTable_(SHEETS.HOURS, { display: true }).rows.map(function (r) {
      return {
        dow: toNum_(r.dow, 0),
        day: String(r.day || ''),
        open: String(r.open || '').trim(),
        close: String(r.close || '').trim(),
        delivery_open: String(r.delivery_open || '').trim(),
        delivery_close: String(r.delivery_close || '').trim(),
        break_start: String(r.break_start || '').trim(),
        break_end: String(r.break_end || '').trim(),
        closed: toBool_(r.closed, false)
      };
    });
  });
}

/** Accepts 2026-12-31, 31.12.2026, 31.12.2026. and 1.1.2027 as typed by the owner. */
function normalizeDate_(value) {
  var s = String(value || '').trim();
  var iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return iso[1] + '-' + ('0' + iso[2]).slice(-2) + '-' + ('0' + iso[3]).slice(-2);
  var sr = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?$/);
  if (sr) return sr[3] + '-' + ('0' + sr[2]).slice(-2) + '-' + ('0' + sr[1]).slice(-2);
  return '';
}

function getSpecial_() {
  return cached_('special', CACHE_TTL_SEC, function () {
    var out = [];
    readTable_(SHEETS.SPECIAL_HOURS, { display: true }).rows.forEach(function (r) {
      var date = normalizeDate_(r.date);
      if (!date) return;
      out.push({
        date: date,
        label: String(r.label || ''),
        open: String(r.open || '').trim(),
        close: String(r.close || '').trim(),
        delivery_open: String(r.delivery_open || '').trim(),
        delivery_close: String(r.delivery_close || '').trim(),
        closed: toBool_(r.closed, false),
        active: toBool_(r.active, true)
      });
    });
    return out;
  });
}

function zoneFromRow_(r) {
  var min = String(r.min_order === undefined || r.min_order === null ? '' : r.min_order).replace(/[^\d.-]/g, '');
  return {
    id: String(r.id || '').trim(),
    name: String(r.name || '').trim(),
    areas: splitList_(r.areas),
    fee: toNum_(String(r.fee).replace(/[^\d.-]/g, ''), 0),
    // Blank = the global min_order_delivery applies; 0 = this zone has no minimum.
    minOrder: min === '' ? null : toNum_(min, null),
    active: toBool_(r.active, true),
    sort: toNum_(r.sort, 0),
    note: String(r.note || ''),
    _row: r._row
  };
}

/** Minimum food value for a delivery order into `zone` (the zone's own value wins, else the global setting). */
function deliveryMinimum_(zone, settings) {
  if (zone && zone.minOrder !== null && zone.minOrder !== undefined) return zone.minOrder;
  return toNum_(settings.min_order_delivery, 0);
}

/** Active zones for guests. */
function getZones_() {
  return cached_('zones', CACHE_TTL_SEC, function () {
    return readTable_(SHEETS.ZONES, { display: true })
      .rows.map(zoneFromRow_)
      .filter(function (z) {
        return z.id && z.active;
      })
      .sort(function (a, b) {
        return a.sort - b.sort;
      });
  });
}

function schedulingConfig_() {
  return GG_Scheduling.buildConfig(getSettings_(), getHours_(), getSpecial_());
}

var PUBLIC_SETTING_KEYS = [
  'business_name', 'address_street', 'address_city', 'postal_code', 'phone_display', 'phone_e164', 'email_public',
  'instagram_url', 'site_url', 'map_query', 'ordering_enabled', 'pause_message', 'delivery_enabled', 'pickup_enabled',
  'delivery_eta_min', 'delivery_eta_max', 'pickup_eta_min', 'pickup_eta_max', 'extra_wait_min', 'asap_cutoff_min',
  'slot_first_offset_min', 'slot_interval_min', 'slot_round_min', 'preorder_days', 'accept_timeout_min', 'business_day_rollover_hour', 'delivery_fee_mode',
  'delivery_fee_default', 'zones_enabled', 'free_delivery_threshold', 'min_order_delivery', 'min_order_pickup',
  'max_lines_per_order', 'max_qty_per_line', 'cash_max_over_total', 'job_active', 'job_title', 'job_salary',
  'customer_confirmation_enabled', 'address_note', 'hours_note', 'job_phone_display', 'job_phone_e164', 'second_location'
];

function publicSettings_() {
  var s = getSettings_();
  var out = {};
  PUBLIC_SETTING_KEYS.forEach(function (k) {
    if (k in s) out[k] = s[k];
  });
  return out;
}

/** Recipients from a comma separated SETTINGS value, validated. */
function recipients_(value) {
  return splitList_(value).filter(function (addr) {
    return GG_Validation.validateEmail(addr, true).ok;
  });
}

/** Simple trigger: config edits in the spreadsheet invalidate the cache at once. */
function onEdit(e) {
  try {
    var name = e && e.range ? e.range.getSheet().getName() : '';
    if ([SHEETS.SETTINGS, SHEETS.HOURS, SHEETS.SPECIAL_HOURS, SHEETS.ZONES, SHEETS.PRODUCTS, SHEETS.CATEGORIES, SHEETS.OPTION_GROUPS, SHEETS.OPTIONS, SHEETS.REPORT_CONFIG].indexOf(name) !== -1) {
      invalidateConfigCache_();
    }
  } catch (ignored) {}
}
