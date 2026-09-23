/**
 * Grčki Giros — shop panel API (tablet/phone in the shop).
 * PIN → signed token (12 h). The PIN hash, its salt and the HMAC key live in Script Properties only.
 */

var PANEL_TOKEN_HOURS = 12;
var PANEL_MAX_FAILS = 8;

function setPanelPin_(pin) {
  var p = String(pin || '').trim();
  if (!/^\d{6,8}$/.test(p)) throw new Error('PIN mora imati 6 do 8 cifara.');
  var salt = randomHex_(16);
  PropertiesService.getScriptProperties().setProperties({ PANEL_PIN_SALT: salt, PANEL_PIN_HASH: sha256Hex_(salt + ':' + p) });
  log_('INFO', 'setPanelPin', 'OK', 'PIN za panel je promenjen');
}

function panelLogin_(payload) {
  var cache = CacheService.getScriptCache();
  var fails = toNum_(cache.get('panel:fails'), 0);
  if (fails >= PANEL_MAX_FAILS) throw apiError_('RATE_LIMITED', 'Previše pogrešnih pokušaja. Sačekajte 10 minuta.');
  var props = PropertiesService.getScriptProperties();
  var hash = props.getProperty('PANEL_PIN_HASH');
  var salt = props.getProperty('PANEL_PIN_SALT');
  if (!hash || !salt) throw apiError_('UNAUTHORIZED', 'PIN za panel još nije podešen (Sheets meni Grčki Giros ▸ Postavi PIN za panel).');
  var pin = String((payload && payload.pin) || '');
  if (!/^\d{4,8}$/.test(pin) || !safeEqual_(sha256Hex_(salt + ':' + pin), hash)) {
    cache.put('panel:fails', String(fails + 1), 600);
    log_('WARN', 'panel.login', 'REJECTED', 'Pogrešan PIN (' + (fails + 1) + '/' + PANEL_MAX_FAILS + ')');
    throw apiError_('UNAUTHORIZED', 'Pogrešan PIN.');
  }
  cache.remove('panel:fails');
  var exp = now_().getTime() + PANEL_TOKEN_HOURS * 3600 * 1000;
  var body = 'panel.' + exp;
  log_('INFO', 'panel.login', 'OK', 'Prijava na panel');
  return { token: body + '.' + hmacB64_(body, secret_('TOKEN_SECRET')), expiresAt: exp, pollSeconds: toNum_(getSettings_().panel_poll_seconds, 10) };
}

function requirePanel_(token) {
  var parts = String(token || '').split('.');
  if (parts.length !== 3 || parts[0] !== 'panel') throw apiError_('UNAUTHORIZED', 'Prijavite se PIN-om.');
  var body = parts[0] + '.' + parts[1];
  if (!safeEqual_(hmacB64_(body, secret_('TOKEN_SECRET')), parts[2])) throw apiError_('UNAUTHORIZED', 'Prijavite se PIN-om.');
  if (toNum_(parts[1], 0) < now_().getTime()) throw apiError_('UNAUTHORIZED', 'Sesija je istekla. Unesite PIN ponovo.');
}

function panelOrderDto_(o) {
  return {
    id: o.id,
    publicNumber: o.publicNumber,
    status: o.status,
    mode: o.mode,
    businessDate: o.businessDate,
    createdAt: o.createdIso,
    createdLabel: fmt_(o.createdAt, 'HH:mm'),
    when: o.when,
    promisedTime: o.promisedLabel,
    customer: o.customer,
    address: o.mode === 'delivery' ? { line: o.address.street, apt: o.address.apt, zone: o.address.zoneName, note: o.address.note } : null,
    note: o.note,
    items: o.lines,
    subtotal: o.subtotal,
    deliveryFee: o.deliveryFee,
    total: o.total,
    cash: o.cash,
    change: o.change,
    emailStatus: o.emailStatus,
    updatedAt: o.updatedAt
  };
}

function panelOrders_(payload) {
  requirePanel_(payload && payload.token);
  var today = businessDateOf_(now_());
  var yesterday = addDays_(today, -1);
  var orders = readTail_(SHEETS.ORDERS, 400)
    .map(orderFromRow_)
    .filter(function (o) {
      if (o.businessDate === today) return true;
      return o.businessDate === yesterday && STATUS_FINAL.indexOf(o.status) === -1;
    })
    .sort(function (a, b) {
      return b.createdAt.getTime() - a.createdAt.getTime();
    })
    .map(panelOrderDto_);
  var settings = getSettings_();
  var catalog = getCatalog_();
  var cats = {};
  catalog.categories.forEach(function (c) {
    cats[c.id] = c;
  });
  return {
    serverNow: now_().getTime(),
    businessDate: today,
    orders: orders,
    settings: { orderingEnabled: toBool_(settings.ordering_enabled, true), extraWaitMin: toNum_(settings.extra_wait_min, 0) },
    products: catalog.products
      .slice()
      .sort(function (a, b) {
        return (cats[a.categoryId] ? cats[a.categoryId].sort : 0) - (cats[b.categoryId] ? cats[b.categoryId].sort : 0) || a.sort - b.sort;
      })
      .map(function (p) {
        return { id: p.id, name: p.name, category: cats[p.categoryId] ? cats[p.categoryId].name : '', available: p.available };
      })
  };
}

function panelStatus_(payload) {
  var p = payload || {};
  requirePanel_(p.token);
  var status = String(p.status || '');
  if (STATUS_LIST.indexOf(status) === -1) throw apiError_('BAD_REQUEST', 'Nepoznat status.');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw apiError_('BUSY', 'Sistem je trenutno zauzet, pokušajte ponovo.');
  try {
    var rows = findRows_(SHEETS.ORDERS, 'Internal Order ID', String(p.orderId || ''));
    if (!rows.length) throw apiError_('BAD_REQUEST', 'Porudžbina nije pronađena.');
    var row = readRow_(SHEETS.ORDERS, rows[0]);
    var from = String(row.Status);
    if (from === status) return panelOrderDto_(orderFromRow_(row));
    var stamp = isoLocal_();
    var patch = { Status: status, 'Updated At': stamp };
    if (status === STATUS.ACCEPTED && !row['Accepted At']) patch['Accepted At'] = stamp;
    if ((status === STATUS.READY || status === STATUS.OUT_FOR_DELIVERY) && !row['Actual Time']) patch['Actual Time'] = fmt_(now_(), 'HH:mm');
    if (STATUS_FINAL.indexOf(status) !== -1) patch['Completed At'] = stamp;
    updateRow_(SHEETS.ORDERS, rows[0], patch);
    var itemRows = findRows_(SHEETS.ORDER_ITEMS, 'Order ID', row['Internal Order ID']);
    if (itemRows.length) {
      var hi = headerIndex_(sheet_(SHEETS.ORDER_ITEMS));
      itemRows.forEach(function (r) {
        updateRow_(SHEETS.ORDER_ITEMS, r, { Status: status }, hi);
      });
    }
    try {
      adjustCustomerForStatus_(row, from, status);
    } catch (crmErr) {
      logError_('crm.adjust', crmErr, { orderId: row['Internal Order ID'], severity: 'WARN' });
    }
    CacheService.getScriptCache().remove('st:' + row['Internal Order ID']);
    log_('INFO', 'panel.status', 'OK', '#' + row['Public Order Number'] + ': ' + from + ' → ' + status, { orderId: row['Internal Order ID'] });
    return panelOrderDto_(orderFromRow_(readRow_(SHEETS.ORDERS, rows[0])));
  } finally {
    lock.releaseLock();
  }
}

function panelAvailability_(payload) {
  var p = payload || {};
  requirePanel_(p.token);
  setProductAvailability_(String(p.productId || ''), !!p.available);
  log_('INFO', 'panel.availability', 'OK', p.productId + ' → ' + (p.available ? 'dostupno' : 'rasprodato'));
  return { productId: p.productId, available: !!p.available };
}

function setSetting_(key, value) {
  var rows = findRows_(SHEETS.SETTINGS, 'key', key);
  if (rows.length) updateRow_(SHEETS.SETTINGS, rows[0], { value: String(value) });
  else appendObjects_(SHEETS.SETTINGS, [{ key: key, value: String(value), note: '' }]);
}

function panelSettings_(payload) {
  var p = payload || {};
  requirePanel_(p.token);
  var changed = {};
  if (p.orderingEnabled !== undefined) {
    setSetting_('ordering_enabled', p.orderingEnabled ? 'TRUE' : 'FALSE');
    changed.orderingEnabled = !!p.orderingEnabled;
  }
  if (p.extraWaitMin !== undefined) {
    var extra = Math.floor(Number(p.extraWaitMin));
    if (!(extra >= 0 && extra <= 90)) throw apiError_('BAD_REQUEST', 'Dodatno vreme mora biti između 0 i 90 minuta.');
    setSetting_('extra_wait_min', String(extra));
    changed.extraWaitMin = extra;
  }
  invalidateConfigCache_();
  log_('INFO', 'panel.settings', 'OK', JSON.stringify(changed));
  return changed;
}
