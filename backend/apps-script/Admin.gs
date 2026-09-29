/**
 * Grčki Giros — admin API (/admin/ on the shop's tablet, phone or PC).
 * One shop account: PIN → signed token (12 h). The PIN hash, its salt and the HMAC key live in
 * Script Properties only. Every admin.* action except login goes through requireAdmin_.
 */

var ADMIN_TOKEN_HOURS = 12;
var ADMIN_MAX_FAILS = 8;

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function setPanelPin_(pin) {
  var p = String(pin || '').trim();
  if (!/^\d{6,8}$/.test(p)) throw new Error('PIN mora imati 6 do 8 cifara.');
  var salt = randomHex_(16);
  PropertiesService.getScriptProperties().setProperties({ PANEL_PIN_SALT: salt, PANEL_PIN_HASH: sha256Hex_(salt + ':' + p) });
  log_('INFO', 'setPanelPin', 'OK', 'PIN za admin panel je promenjen');
}

function pinMatches_(pin) {
  var props = PropertiesService.getScriptProperties();
  var hash = props.getProperty('PANEL_PIN_HASH');
  var salt = props.getProperty('PANEL_PIN_SALT');
  if (!hash || !salt) throw apiError_('UNAUTHORIZED', 'PIN za admin panel još nije podešen (Sheets meni Grčki Giros ▸ Postavi PIN).');
  return /^\d{4,8}$/.test(String(pin || '')) && safeEqual_(sha256Hex_(salt + ':' + pin), hash);
}

/** One counter for every wrong PIN, whether typed at login or in "change PIN". */
function pinFailures_() {
  return toNum_(CacheService.getScriptCache().get('panel:fails'), 0);
}

function recordPinFailure_(where) {
  var fails = pinFailures_() + 1;
  CacheService.getScriptCache().put('panel:fails', String(fails), 600);
  log_('WARN', where, 'REJECTED', 'Pogrešan PIN (' + fails + '/' + ADMIN_MAX_FAILS + ')');
}

function assertNotLockedOut_() {
  if (pinFailures_() >= ADMIN_MAX_FAILS) throw apiError_('RATE_LIMITED', 'Previše pogrešnih pokušaja. Sačekajte 10 minuta.');
}

/**
 * Tokens are signed together with the PIN's salt: a new PIN (new salt) invalidates every token issued
 * before it, so "promeni PIN" also logs out a lost or stolen device.
 */
function adminSignature_(body) {
  var salt = PropertiesService.getScriptProperties().getProperty('PANEL_PIN_SALT') || '';
  return hmacB64_(body + '|' + salt, secret_('TOKEN_SECRET'));
}

function issueAdminToken_() {
  var exp = now_().getTime() + ADMIN_TOKEN_HOURS * 3600 * 1000;
  var body = 'admin.' + exp;
  return { token: body + '.' + adminSignature_(body), expiresAt: exp };
}

function adminLogin_(payload) {
  assertNotLockedOut_();
  var pin = payload && typeof payload.pin === 'string' ? payload.pin : '';
  if (!pinMatches_(pin)) {
    recordPinFailure_('admin.login');
    throw apiError_('UNAUTHORIZED', 'Pogrešan PIN.');
  }
  CacheService.getScriptCache().remove('panel:fails');
  var session = issueAdminToken_();
  log_('INFO', 'admin.login', 'OK', 'Prijava na admin panel');
  return { token: session.token, expiresAt: session.expiresAt, pollSeconds: toNum_(getSettings_().panel_poll_seconds, 10) };
}

/** Returns the token's expiry (ms) or throws UNAUTHORIZED. */
function requireAdmin_(token) {
  var parts = typeof token === 'string' ? token.split('.') : [];
  if (parts.length !== 3 || parts[0] !== 'admin' || !/^\d{13}$/.test(parts[1])) throw apiError_('UNAUTHORIZED', 'Prijavite se PIN-om.');
  if (!safeEqual_(adminSignature_(parts[0] + '.' + parts[1]), parts[2])) throw apiError_('UNAUTHORIZED', 'Prijavite se PIN-om.');
  var exp = Number(parts[1]);
  if (exp < now_().getTime()) throw apiError_('UNAUTHORIZED', 'Sesija je istekla. Unesite PIN ponovo.');
  return exp;
}

/** A fresh token once the current one is past half its life (the panel polls every few seconds). Never throws. */
function adminRenewal_(token) {
  try {
    var exp = requireAdmin_(token);
    if (exp - now_().getTime() > (ADMIN_TOKEN_HOURS / 2) * 3600 * 1000) return null;
    return issueAdminToken_();
  } catch (ignored) {
    return null;
  }
}

function adminChangePin_(p) {
  assertNotLockedOut_();
  var current = typeof p.currentPin === 'string' ? p.currentPin : '';
  if (!pinMatches_(current)) {
    recordPinFailure_('admin.pin.change');
    throw apiError_('VALIDATION', 'Trenutni PIN nije tačan.', { field: 'currentPin' });
  }
  if (!/^\d{6,8}$/.test(typeof p.newPin === 'string' ? p.newPin : '')) throw apiError_('VALIDATION', 'Novi PIN mora imati 6 do 8 cifara.', { field: 'newPin' });
  setPanelPin_(p.newPin);
  var session = issueAdminToken_();
  return { changed: true, token: session.token, expiresAt: session.expiresAt };
}

/** Serializes admin writes (the shop may have the panel open on two devices). */
function withAdminLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw apiError_('BUSY', 'Sistem je trenutno zauzet, pokušajte ponovo za nekoliko sekundi.');
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

function adminOrderDto_(o, nowMs) {
  return {
    id: o.id,
    publicNumber: o.publicNumber,
    status: o.status,
    statusLabel: STATUS_LABEL[o.status] || o.status,
    mode: o.mode,
    businessDate: o.businessDate,
    createdAt: o.createdIso,
    createdLabel: fmt_(o.createdAt, 'HH:mm'),
    createdDate: fmt_(o.createdAt, 'dd.MM.yyyy.'),
    acceptBy: o.acceptByIso,
    overdue: isOverdue_(o, nowMs),
    when: o.when,
    whenText: whenText_(o),
    scheduledDate: o.scheduledDate,
    scheduledTime: o.scheduledTime,
    promisedTime: o.promisedLabel,
    customer: o.customer,
    address: o.mode === 'delivery' ? { line: o.address.street, apt: o.address.apt, floor: o.address.floor, aptFloor: aptFloorText_(o.address), zone: o.address.zoneName, note: o.address.note } : null,
    note: o.note,
    items: o.lines,
    itemCount: o.itemCount,
    subtotal: o.subtotal,
    deliveryFee: o.deliveryFee,
    total: o.total,
    cash: o.cash,
    change: o.change,
    emailStatus: o.emailStatus,
    confirmedAt: o.confirmedAt,
    readyAt: o.readyAt,
    completedAt: o.completedAt,
    rejectedAt: o.rejectedAt,
    updatedAt: o.updatedAt,
    next: STATUS_TRANSITIONS[o.status] || []
  };
}

/** Today's numbers for the dashboard (business day, rejected orders excluded from value). */
function dashboardFor_(orders, businessDate, nowMs) {
  var d = { businessDate: businessDate, orders: 0, value: 0, delivery: 0, pickup: 0, completed: 0, rejected: 0, active: 0, overdue: 0, newCount: 0 };
  orders.forEach(function (o) {
    if (o.businessDate === businessDate) {
      d.orders++;
      if (o.mode === 'delivery') d.delivery++;
      else d.pickup++;
      if (o.status === STATUS.COMPLETED) d.completed++;
      if (o.status === STATUS.REJECTED) d.rejected++;
      else d.value += o.total;
    }
    if (STATUS_FINAL.indexOf(o.status) === -1) d.active++;
    if (o.status === STATUS.NEW) d.newCount++;
    if (isOverdue_(o, nowMs)) d.overdue++;
  });
  return d;
}

function adminSettingsSnapshot_(settings) {
  return {
    orderingEnabled: toBool_(settings.ordering_enabled, true),
    deliveryEnabled: toBool_(settings.delivery_enabled, true),
    pickupEnabled: toBool_(settings.pickup_enabled, true),
    extraWaitMin: toNum_(settings.extra_wait_min, 0),
    acceptTimeoutMin: toNum_(settings.accept_timeout_min, 5),
    // Left on after go-live, the kitchen would silently get no order emails: the board says so.
    testMode: toBool_(settings.test_mode, true),
    emailQuota: emailQuota_()
  };
}

/** Emails left today (cached for 5 min, the panel polls every few seconds). -1 when unknown. */
function emailQuota_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('mail:quota');
  if (hit !== null && hit !== undefined) return toNum_(hit, -1);
  var left = -1;
  try {
    left = MailApp.getRemainingDailyQuota();
  } catch (ignored) {}
  cache.put('mail:quota', String(left), 300);
  return left;
}

/** The live board: every open order (whatever its date) + everything from today. */
function adminBoard_(p) {
  var nowMs = now_().getTime();
  var today = businessDateOf_(now_());
  var all = readTail_(SHEETS.ORDERS, 600).map(orderFromRow_);
  var orders = all
    .filter(function (o) {
      return o.businessDate === today || STATUS_FINAL.indexOf(o.status) === -1;
    })
    .sort(function (a, b) {
      return b.createdAt.getTime() - a.createdAt.getTime() || b.publicNumber - a.publicNumber;
    })
    .map(function (o) {
      return adminOrderDto_(o, nowMs);
    });
  var settings = getSettings_();
  var sched = GG_Scheduling.snapshot(nowParts_(), schedulingConfig_());
  return {
    serverNow: nowMs,
    businessDate: today,
    orders: orders,
    dashboard: dashboardFor_(all, today, nowMs),
    settings: adminSettingsSnapshot_(settings),
    shop: { open: sched.open, onBreak: sched.onBreak, paused: sched.paused, delivery: sched.delivery.state, pickup: sched.pickup.state, next: sched.next ? sched.next.label : '' }
  };
}

/** Row number of an order by its internal id; anything that is not a real id is "not found". */
function orderRowById_(orderId) {
  if (typeof orderId !== 'string' || !ORDER_ID_PATTERN.test(orderId)) throw apiError_('BAD_REQUEST', 'Porudžbina nije pronađena.');
  var rows = findRows_(SHEETS.ORDERS, 'Internal Order ID', orderId);
  if (!rows.length) throw apiError_('BAD_REQUEST', 'Porudžbina nije pronađena.');
  return rows[0];
}

function adminOrder_(p) {
  return adminOrderDto_(orderFromRow_(readRow_(SHEETS.ORDERS, orderRowById_(p.orderId))), now_().getTime());
}

function adminStatus_(p) {
  var status = typeof p.status === 'string' ? p.status : '';
  if (STATUS_LIST.indexOf(status) === -1) throw apiError_('BAD_REQUEST', 'Nepoznat status.');
  var settings = getSettings_();
  var result = withAdminLock_(function () {
    var rows = [orderRowById_(p.orderId)];
    var row = readRow_(SHEETS.ORDERS, rows[0]);
    var from = String(row.Status);
    if (from === status) return { order: orderFromRow_(row), changed: false };
    // Two devices (kitchen tablet + owner's phone): a button pressed on a stale screen must not
    // overwrite what the other device already decided (e.g. "Odbij" on an order just accepted).
    var seen = typeof p.from === 'string' ? p.from : '';
    if (seen && seen !== from) {
      throw apiError_('CONFLICT', 'Porudžbina #' + row['Public Order Number'] + ' je u međuvremenu promenjena u „' + (STATUS_LABEL[from] || from) + '“ (na drugom uređaju). Proverite je pa pokušajte ponovo.', {
        data: { status: from }
      });
    }
    if ((STATUS_TRANSITIONS[from] || []).indexOf(status) === -1) {
      throw apiError_('BAD_REQUEST', 'Porudžbina #' + row['Public Order Number'] + ' je ' + (STATUS_LABEL[from] || from) + ' i ne može da pređe u ' + (STATUS_LABEL[status] || status) + '.');
    }
    var stamp = isoLocal_();
    var patch = { Status: status, 'Updated At': stamp };
    var stampCol = STATUS_STAMP_COLUMN[status];
    var firstTime = !!stampCol && !row[stampCol];
    if (firstTime) patch[stampCol] = stamp;
    writeRowObject_(SHEETS.ORDERS, rows[0], patch);
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
    log_('INFO', 'admin.status', 'OK', '#' + row['Public Order Number'] + ': ' + from + ' → ' + status, { orderId: row['Internal Order ID'] });
    return { order: orderFromRow_(readRow_(SHEETS.ORDERS, rows[0])), changed: true, from: from, firstTime: firstTime };
  });
  // The guest email goes out after the lock: a slow mail server never blocks the next status change.
  if (result.changed) {
    try {
      var mail = sendStatusEmail_(result.order, result.from, settings, result.firstTime);
      if (mail) updateRow_(SHEETS.ORDERS, result.order.row, { 'Email Status': result.order.emailStatus + ' · ' + mail });
    } catch (mailErr) {
      logError_('email.status', mailErr, { orderId: result.order.id, severity: 'WARN' });
    }
  }
  return adminOrderDto_(result.order, now_().getTime());
}

/** History search: number, name, phone, date, status. Newest first, 30 per page. */
function adminHistory_(p) {
  var q = GG_Validation.clean(p.q, 60).toLowerCase();
  var digits = q.replace(/\D/g, '');
  var number = /^#?\d{1,7}$/.test(q) ? Number(digits) : 0;
  var date = /^\d{4}-\d{2}-\d{2}$/.test(String(p.date || '')) ? String(p.date) : '';
  var status = STATUS_LIST.indexOf(String(p.status || '')) !== -1 ? String(p.status) : '';
  var pageSize = 30;
  var page = Math.max(0, Math.floor(toNum_(p.page, 0)));
  var nowMs = now_().getTime();
  var matches = readTable_(SHEETS.ORDERS)
    .rows.map(orderFromRow_)
    .filter(function (o) {
      if (date && o.businessDate !== date) return false;
      if (status && o.status !== status) return false;
      if (!q) return true;
      if (number && o.publicNumber === number) return true;
      if (o.customer.name.toLowerCase().indexOf(q) !== -1) return true;
      if (digits.length >= 3) {
        var phone = o.customer.phone.replace(/\D/g, '');
        var local = phone.indexOf('381') === 0 ? '0' + phone.slice(3) : phone;
        if (phone.indexOf(digits) !== -1 || local.indexOf(digits) !== -1) return true;
      }
      return false;
    })
    .sort(function (a, b) {
      return b.createdAt.getTime() - a.createdAt.getTime() || b.publicNumber - a.publicNumber;
    });
  return {
    total: matches.length,
    page: page,
    pageSize: pageSize,
    orders: matches.slice(page * pageSize, page * pageSize + pageSize).map(function (o) {
      return adminOrderDto_(o, nowMs);
    })
  };
}

// ---------------------------------------------------------------------------
// Catalog (everything, including hidden rows)
// ---------------------------------------------------------------------------

function rowsOf_(name) {
  return readTable_(name).rows;
}

function adminCatalog_() {
  var categories = rowsOf_(SHEETS.CATEGORIES).map(function (r) {
    return { id: String(r.id), name: String(r.name || ''), description: String(r.description || ''), sort: toNum_(r.sort, 0), active: toBool_(r.active, true) };
  });
  var groups = rowsOf_(SHEETS.OPTION_GROUPS).map(function (r) {
    return {
      id: String(r.id),
      name: String(r.name || ''),
      type: String(r.type || 'multi') === 'single' ? 'single' : 'multi',
      required: toBool_(r.required, false),
      min: toNum_(r.min, 0),
      max: toNum_(r.max, 0),
      display: String(r.display || 'chips'),
      hint: String(r.hint || ''),
      sort: toNum_(r.sort, 0)
    };
  });
  var options = rowsOf_(SHEETS.OPTIONS).map(function (r) {
    return { id: String(r.id), groupId: String(r.group_id || ''), name: String(r.name || ''), price: toNum_(r.price, 0), available: toBool_(r.available, true), sort: toNum_(r.sort, 0) };
  });
  var products = rowsOf_(SHEETS.PRODUCTS).map(function (r) {
    return {
      id: String(r.id),
      categoryId: String(r.category_id || ''),
      name: String(r.name || ''),
      description: String(r.description || ''),
      price: toNum_(r.price, 0),
      comparePrice: toNum_(r.compare_price, 0),
      available: toBool_(r.available, true),
      delivery: toBool_(r.delivery, true),
      pickup: toBool_(r.pickup, true),
      tags: splitList_(r.tags),
      badge: String(r.badge || ''),
      groups: splitList_(r.groups),
      defaults: splitList_(r.defaults),
      includes: String(r.includes || ''),
      kind: String(r.kind || 'item') === 'bundle' ? 'bundle' : 'item',
      image: String(r.image || ''),
      art: String(r.art || ''),
      sort: toNum_(r.sort, 0),
      active: toBool_(r.active, true),
      demo: toBool_(r.demo, false)
    };
  });
  var sortFn = function (a, b) {
    return a.sort - b.sort;
  };
  return { categories: categories.sort(sortFn), groups: groups.sort(sortFn), options: options.sort(sortFn), products: products.sort(sortFn) };
}

function requireText_(value, field, label, min, max) {
  var s = GG_Validation.clean(value, max + 50);
  if (s.length < min) throw apiError_('VALIDATION', label + ': obavezno polje.', { field: field });
  if (s.length > max) throw apiError_('VALIDATION', label + ': najviše ' + max + ' znakova.', { field: field });
  return s;
}

function requireInt_(value, field, label, min, max) {
  var n = Number(String(value === undefined || value === null ? '' : value).replace(/[\s.]/g, '').replace(',', '.'));
  if (!(isFinite(n) && Math.floor(n) === n && n >= min && n <= max)) {
    throw apiError_('VALIDATION', label + ': unesite ceo broj od ' + min + ' do ' + GG_Money.formatNumber(max) + '.', { field: field });
  }
  return n;
}

function findRowById_(sheetName, id) {
  var rows = findRows_(sheetName, 'id', String(id || ''));
  return rows.length ? rows[0] : 0;
}

function nextSort_(items, filterFn) {
  return (
    items.filter(filterFn || function () {
      return true;
    }).reduce(function (m, x) {
      return Math.max(m, x.sort || 0);
    }, 0) + 1
  );
}

var KNOWN_TAGS_ = ['popular', 'recommended', 'new', 'spicy', 'vegetarian', 'promo', 'family', 'value'];

function imageUrlOk_(url) {
  return !url || /^https:\/\/[^\s"'<>]+$/i.test(url) || /^http:\/\/localhost(:\d+)?\/[^\s"'<>]*$/i.test(url);
}

function adminSaveProduct_(p) {
  var input = p.product || {};
  return withAdminLock_(function () {
    var cat = adminCatalog_();
    var existing = input.id ? cat.products.filter(function (x) {
      return x.id === input.id;
    })[0] : null;
    if (input.id && !existing) throw apiError_('BAD_REQUEST', 'Proizvod ne postoji.');
    var name = requireText_(input.name, 'name', 'Naziv', 2, 60);
    var categoryId = String(input.categoryId || '');
    if (!cat.categories.some(function (c) { return c.id === categoryId; })) throw apiError_('VALIDATION', 'Izaberite kategoriju.', { field: 'categoryId' });
    var price = requireInt_(input.price, 'price', 'Cena', 0, 100000);
    var compare = input.comparePrice === '' || input.comparePrice === undefined || input.comparePrice === null ? 0 : requireInt_(input.comparePrice, 'comparePrice', 'Stara cena', 0, 100000);
    var description = GG_Validation.clean(input.description, 400, false);
    if (description.length > 300) throw apiError_('VALIDATION', 'Opis: najviše 300 znakova.', { field: 'description' });
    var image = String(input.image || '').trim();
    if (!imageUrlOk_(image)) throw apiError_('VALIDATION', 'Adresa slike mora počinjati sa https://', { field: 'image' });
    var groupIds = (Array.isArray(input.groups) ? input.groups : []).map(String).filter(function (g) {
      return cat.groups.some(function (x) { return x.id === g; });
    });
    var defaults = (Array.isArray(input.defaults) ? input.defaults : []).map(String).filter(function (o) {
      return cat.options.some(function (x) { return x.id === o && groupIds.indexOf(x.groupId) !== -1; });
    });
    var tags = (Array.isArray(input.tags) ? input.tags : []).map(String).filter(function (t) {
      return KNOWN_TAGS_.indexOf(t) !== -1;
    });
    var row = {
      category_id: categoryId,
      name: name,
      description: description,
      price: price,
      compare_price: compare || '',
      available: input.available !== false,
      delivery: input.delivery !== false,
      pickup: input.pickup !== false,
      tags: tags.join(', '),
      badge: GG_Validation.clean(input.badge, 20),
      groups: groupIds.join(', '),
      defaults: defaults.join(', '),
      includes: GG_Validation.clean(input.includes, 80),
      kind: input.kind === 'bundle' ? 'bundle' : 'item',
      image: image,
      art: GG_Validation.clean(input.art, 40),
      active: input.active !== false,
      demo: false
    };
    var id;
    if (existing) {
      id = existing.id;
      if (existing.categoryId !== categoryId) row.sort = nextSort_(cat.products, function (x) { return x.categoryId === categoryId; });
      writeRowObject_(SHEETS.PRODUCTS, findRowById_(SHEETS.PRODUCTS, id), row);
    } else {
      id = uniqueId_(name, cat.products.map(function (x) { return x.id; }), 'proizvod');
      row.id = id;
      row.sort = nextSort_(cat.products, function (x) { return x.categoryId === categoryId; });
      row.pairs = '';
      row.bundle_hint = '';
      appendObjects_(SHEETS.PRODUCTS, [row]);
    }
    invalidateConfigCache_();
    log_('INFO', 'admin.product.save', 'OK', (existing ? 'Izmenjen' : 'Dodat') + ' proizvod ' + id + ' (' + price + ' RSD)');
    return { id: id, catalog: adminCatalog_() };
  });
}

/** Moves an item one place up/down among its siblings and renumbers them 1…n. */
function moveInSheet_(sheetName, items, id, dir, sameGroup) {
  var item = items.filter(function (x) { return x.id === id; })[0];
  if (!item) throw apiError_('BAD_REQUEST', 'Stavka ne postoji.');
  var siblings = items.filter(function (x) { return sameGroup(x, item); }).sort(function (a, b) { return a.sort - b.sort; });
  var i = siblings.indexOf(item);
  var j = dir === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= siblings.length) return false;
  siblings.splice(i, 1);
  siblings.splice(j, 0, item);
  var hi = headerIndex_(sheet_(sheetName));
  siblings.forEach(function (x, k) {
    if (x.sort !== k + 1) updateRow_(sheetName, findRowById_(sheetName, x.id), { sort: k + 1 }, hi);
  });
  return true;
}

function adminMoveProduct_(p) {
  return withAdminLock_(function () {
    var cat = adminCatalog_();
    moveInSheet_(SHEETS.PRODUCTS, cat.products, String(p.id || ''), p.dir, function (a, b) { return a.categoryId === b.categoryId; });
    invalidateConfigCache_();
    return { catalog: adminCatalog_() };
  });
}

function adminProductFlag_(p) {
  var field = { available: 'available', active: 'active' }[p.field];
  if (!field) throw apiError_('BAD_REQUEST', 'Nepoznata izmena.');
  return withAdminLock_(function () {
    var row = findRowById_(SHEETS.PRODUCTS, p.id);
    if (!row) throw apiError_('BAD_REQUEST', 'Proizvod ne postoji.');
    var patch = {};
    patch[field] = !!p.value;
    writeRowObject_(SHEETS.PRODUCTS, row, patch);
    invalidateConfigCache_();
    log_('INFO', 'admin.product.flag', 'OK', p.id + ' ' + field + ' → ' + !!p.value);
    return { id: p.id, field: field, value: !!p.value };
  });
}

function adminSaveCategory_(p) {
  var input = p.category || {};
  return withAdminLock_(function () {
    var cat = adminCatalog_();
    var existing = input.id ? cat.categories.filter(function (x) { return x.id === input.id; })[0] : null;
    if (input.id && !existing) throw apiError_('BAD_REQUEST', 'Kategorija ne postoji.');
    var row = {
      name: requireText_(input.name, 'name', 'Naziv', 2, 40),
      description: GG_Validation.clean(input.description, 200),
      active: input.active !== false
    };
    var id;
    if (existing) {
      id = existing.id;
      writeRowObject_(SHEETS.CATEGORIES, findRowById_(SHEETS.CATEGORIES, id), row);
    } else {
      id = uniqueId_(row.name, cat.categories.map(function (x) { return x.id; }), 'kategorija');
      row.id = id;
      row.sort = nextSort_(cat.categories);
      appendObjects_(SHEETS.CATEGORIES, [row]);
    }
    invalidateConfigCache_();
    log_('INFO', 'admin.category.save', 'OK', id + ' ' + (row.active ? 'aktivna' : 'isključena'));
    return { id: id, catalog: adminCatalog_() };
  });
}

function adminMoveCategory_(p) {
  return withAdminLock_(function () {
    var cat = adminCatalog_();
    moveInSheet_(SHEETS.CATEGORIES, cat.categories, String(p.id || ''), p.dir, function () { return true; });
    invalidateConfigCache_();
    return { catalog: adminCatalog_() };
  });
}

var GROUP_DISPLAYS_ = ['chips', 'cards', 'toggle', 'info'];

function adminSaveGroup_(p) {
  var input = p.group || {};
  return withAdminLock_(function () {
    var cat = adminCatalog_();
    var existing = input.id ? cat.groups.filter(function (x) { return x.id === input.id; })[0] : null;
    if (input.id && !existing) throw apiError_('BAD_REQUEST', 'Grupa dodataka ne postoji.');
    var type = input.type === 'single' ? 'single' : 'multi';
    var max = type === 'single' ? 1 : requireInt_(input.max === '' || input.max === undefined ? 0 : input.max, 'max', 'Najviše izbora', 0, 50);
    var required = !!input.required;
    var row = {
      name: requireText_(input.name, 'name', 'Naziv grupe', 2, 40),
      type: type,
      required: required,
      min: type === 'single' ? (required ? 1 : 0) : required ? Math.max(1, Math.min(max || 1, requireInt_(input.min || 1, 'min', 'Najmanje izbora', 0, 50))) : 0,
      max: max,
      display: GROUP_DISPLAYS_.indexOf(input.display) !== -1 ? input.display : 'chips',
      hint: GG_Validation.clean(input.hint, 120)
    };
    var id;
    if (existing) {
      id = existing.id;
      writeRowObject_(SHEETS.OPTION_GROUPS, findRowById_(SHEETS.OPTION_GROUPS, id), row);
    } else {
      id = uniqueId_(row.name, cat.groups.map(function (x) { return x.id; }), 'grupa');
      row.id = id;
      row.sort = nextSort_(cat.groups);
      appendObjects_(SHEETS.OPTION_GROUPS, [row]);
    }
    invalidateConfigCache_();
    log_('INFO', 'admin.group.save', 'OK', id);
    return { id: id, catalog: adminCatalog_() };
  });
}

function adminSaveOption_(p) {
  var input = p.option || {};
  return withAdminLock_(function () {
    var cat = adminCatalog_();
    var existing = input.id ? cat.options.filter(function (x) { return x.id === input.id; })[0] : null;
    if (input.id && !existing) throw apiError_('BAD_REQUEST', 'Dodatak ne postoji.');
    var groupId = existing ? existing.groupId : String(input.groupId || '');
    if (!cat.groups.some(function (g) { return g.id === groupId; })) throw apiError_('VALIDATION', 'Izaberite grupu dodataka.', { field: 'groupId' });
    var row = {
      group_id: groupId,
      name: requireText_(input.name, 'name', 'Naziv dodatka', 1, 40),
      price: requireInt_(input.price === '' || input.price === undefined ? 0 : input.price, 'price', 'Doplata', 0, 20000),
      available: input.available !== false
    };
    var id;
    if (existing) {
      id = existing.id;
      writeRowObject_(SHEETS.OPTIONS, findRowById_(SHEETS.OPTIONS, id), row);
    } else {
      id = uniqueId_(groupId + ' ' + row.name, cat.options.map(function (x) { return x.id; }), 'opcija');
      row.id = id;
      row.sort = nextSort_(cat.options, function (x) { return x.groupId === groupId; });
      appendObjects_(SHEETS.OPTIONS, [row]);
    }
    invalidateConfigCache_();
    log_('INFO', 'admin.option.save', 'OK', id + ' (' + row.price + ' RSD)');
    return { id: id, catalog: adminCatalog_() };
  });
}

function adminMoveOption_(p) {
  return withAdminLock_(function () {
    var cat = adminCatalog_();
    moveInSheet_(SHEETS.OPTIONS, cat.options, String(p.id || ''), p.dir, function (a, b) { return a.groupId === b.groupId; });
    invalidateConfigCache_();
    return { catalog: adminCatalog_() };
  });
}

// ---------------------------------------------------------------------------
// Images (Google Drive, public link)
// ---------------------------------------------------------------------------

var IMAGE_TYPES_ = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
var IMAGE_MAX_BYTES_ = 2 * 1024 * 1024;

function imageFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('IMAGE_FOLDER_ID');
  if (id) {
    try {
      return DriveApp.getFolderById(id);
    } catch (ignored) {}
  }
  var folder = DriveApp.createFolder('Grčki Giros — slike menija');
  props.setProperty('IMAGE_FOLDER_ID', folder.getId());
  return folder;
}

function adminUploadImage_(p) {
  var type = String(p.type || '');
  var ext = IMAGE_TYPES_[type];
  if (!ext) throw apiError_('VALIDATION', 'Slika mora biti JPG, PNG ili WEBP.', { field: 'image' });
  var bytes;
  try {
    bytes = Utilities.base64Decode(String(p.data || '').replace(/^data:[^,]+,/, ''));
  } catch (err) {
    throw apiError_('VALIDATION', 'Slika nije ispravna.', { field: 'image' });
  }
  if (!bytes.length || bytes.length > IMAGE_MAX_BYTES_) throw apiError_('VALIDATION', 'Slika mora biti manja od 2 MB.', { field: 'image' });
  var name = (slugify_(p.name) || 'proizvod') + '-' + fmt_(now_(), 'yyyyMMdd-HHmmss') + '.' + ext;
  var file = imageFolder_().createFile(Utilities.newBlob(bytes, type, name));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var template = getSettings_().image_url_template || DEFAULT_SETTINGS.image_url_template;
  var url = String(template).replace('{id}', file.getId());
  log_('INFO', 'admin.image.upload', 'OK', name + ' (' + Math.round(bytes.length / 1024) + ' KB)');
  return { url: url, fileId: file.getId() };
}

// ---------------------------------------------------------------------------
// Zones, hours, settings
// ---------------------------------------------------------------------------

function adminZones_() {
  var settings = getSettings_();
  return {
    zonesEnabled: toBool_(settings.zones_enabled, false),
    defaultMin: toNum_(settings.min_order_delivery, 0),
    zones: readTable_(SHEETS.ZONES, { display: true })
      .rows.map(zoneFromRow_)
      .filter(function (z) { return z.id; })
      .sort(function (a, b) { return a.sort - b.sort; })
      .map(function (z) {
        return { id: z.id, name: z.name, areas: z.areas.join(', '), fee: z.fee, minOrder: z.minOrder === null ? '' : z.minOrder, active: z.active, sort: z.sort };
      })
  };
}

function adminSaveZone_(p) {
  var input = p.zone || {};
  return withAdminLock_(function () {
    var list = adminZones_().zones;
    var existing = input.id ? list.filter(function (z) { return z.id === input.id; })[0] : null;
    if (input.id && !existing) throw apiError_('BAD_REQUEST', 'Zona ne postoji.');
    var areas = splitList_(GG_Validation.clean(input.areas, 1500));
    var row = {
      name: requireText_(input.name, 'name', 'Naziv zone', 2, 60),
      areas: (areas.length ? areas : [GG_Validation.clean(input.name, 60)]).join(', '),
      fee: requireInt_(input.fee, 'fee', 'Cena dostave', 0, 20000),
      min_order: input.minOrder === '' || input.minOrder === undefined || input.minOrder === null ? 500 : requireInt_(input.minOrder, 'minOrder', 'Minimalna porudžbina', 0, 100000),
      active: input.active !== false
    };
    var id;
    if (existing) {
      id = existing.id;
      writeRowObject_(SHEETS.ZONES, findRowById_(SHEETS.ZONES, id), row);
    } else {
      id = uniqueId_(row.name, list.map(function (z) { return z.id; }), 'zona');
      row.id = id;
      row.sort = nextSort_(list);
      row.note = '';
      appendObjects_(SHEETS.ZONES, [row]);
    }
    invalidateConfigCache_();
    log_('INFO', 'admin.zone.save', 'OK', id + ': ' + row.fee + ' RSD, min ' + row.min_order + ', ' + (row.active ? 'aktivna' : 'isključena'));
    return { id: id, zones: adminZones_() };
  });
}

function adminMoveZone_(p) {
  return withAdminLock_(function () {
    moveInSheet_(SHEETS.ZONES, adminZones_().zones, String(p.id || ''), p.dir, function () { return true; });
    invalidateConfigCache_();
    return { zones: adminZones_() };
  });
}

function adminHours_() {
  return { hours: getHours_(), special: getSpecial_() };
}

function hmOrEmpty_(value, field, label) {
  var s = String(value || '').trim();
  if (!s) return '';
  var m = GG_Scheduling.parseHM(s);
  if (m === null) throw apiError_('VALIDATION', label + ': vreme u obliku 09:00.', { field: field });
  return GG_Scheduling.formatHM(m);
}

function adminSaveHours_(p) {
  var input = Array.isArray(p.hours) ? p.hours : [];
  if (input.length !== 7) throw apiError_('BAD_REQUEST', 'Radno vreme mora imati svih 7 dana.');
  var clean = input.map(function (h) {
    var dow = toNum_(h.dow, 0);
    if (dow < 1 || dow > 7) throw apiError_('BAD_REQUEST', 'Nepoznat dan.');
    var day = GG_Scheduling.DAY_NAMES[dow];
    var f = 'd' + dow + '.';
    var row = {
      dow: dow,
      day: day,
      closed: !!h.closed,
      open: hmOrEmpty_(h.open, f + 'open', day + ', otvaranje'),
      close: hmOrEmpty_(h.close, f + 'close', day + ', zatvaranje'),
      delivery_open: hmOrEmpty_(h.delivery_open, f + 'delivery_open', day + ', dostava od'),
      delivery_close: hmOrEmpty_(h.delivery_close, f + 'delivery_close', day + ', dostava do'),
      break_start: hmOrEmpty_(h.break_start, f + 'break_start', day + ', pauza od'),
      break_end: hmOrEmpty_(h.break_end, f + 'break_end', day + ', pauza do')
    };
    if (row.closed) return row;
    if (!row.open || !row.close) throw apiError_('VALIDATION', day + ': unesite vreme otvaranja i zatvaranja ili označite da ne radite.', { field: f + 'open' });
    if (!!row.break_start !== !!row.break_end) throw apiError_('VALIDATION', day + ': pauza mora imati i početak i kraj.', { field: f + 'break_start' });
    if (!!row.delivery_open !== !!row.delivery_close) throw apiError_('VALIDATION', day + ': dostava mora imati i početak i kraj (ili oba prazna = bez dostave).', { field: f + 'delivery_open' });
    // 2026-01-05 is a Monday, so 2026-01-(04 + dow) is the right weekday for this row.
    var dd = 4 + dow;
    var test = GG_Scheduling.windowsFor('2026-01-' + (dd < 10 ? '0' : '') + dd, GG_Scheduling.buildConfig({}, [row], []));
    if (row.break_start && !test.brk) throw apiError_('VALIDATION', day + ': pauza mora biti unutar radnog vremena.', { field: f + 'break_start' });
    return row;
  });
  return withAdminLock_(function () {
    ensureColumns_(SHEETS.HOURS, COLUMNS.HOURS);
    var existing = readTable_(SHEETS.HOURS).rows;
    clean.forEach(function (row) {
      var found = existing.filter(function (r) { return toNum_(r.dow, 0) === row.dow; })[0];
      if (found) writeRowObject_(SHEETS.HOURS, found._row, row);
      else appendObjects_(SHEETS.HOURS, [row]);
    });
    invalidateConfigCache_();
    log_('INFO', 'admin.hours.save', 'OK', clean.map(function (r) { return r.day.slice(0, 3) + ' ' + (r.closed ? 'ne radi' : r.open + '–' + r.close + (r.break_start ? ' pauza ' + r.break_start + '–' + r.break_end : '')); }).join('; '));
    return adminHours_();
  });
}

/** What the shop may change from the panel, with a validator per key. */
var ADMIN_SETTINGS_ = {
  ordering_enabled: 'bool',
  delivery_enabled: 'bool',
  pickup_enabled: 'bool',
  pause_message: 'text:160',
  extra_wait_min: 'int:0:120',
  pickup_eta_min: 'int:1:240',
  pickup_eta_max: 'int:1:240',
  delivery_eta_min: 'int:1:240',
  delivery_eta_max: 'int:1:240',
  accept_timeout_min: 'int:1:60',
  preorder_days: 'int:0:14',
  min_order_delivery: 'int:0:100000',
  business_name: 'text:60',
  phone_display: 'text:30',
  phone_e164: 'phone',
  address_street: 'text:80',
  address_city: 'text:40',
  email_public: 'email',
  order_email_recipients: 'emails',
  customer_confirmation_enabled: 'bool',
  customer_status_emails: 'bool'
};

var SETTING_LABELS_ = {
  pickup_eta_min: 'Preuzimanje od',
  pickup_eta_max: 'Preuzimanje do',
  delivery_eta_min: 'Dostava od',
  delivery_eta_max: 'Dostava do',
  extra_wait_min: 'Dodatno vreme (gužva)',
  accept_timeout_min: 'Rok za prihvatanje',
  preorder_days: 'Zakazivanje unapred',
  min_order_delivery: 'Minimalna porudžbina za dostavu',
  business_name: 'Naziv lokala',
  phone_display: 'Telefon',
  phone_e164: 'Telefon za poziv',
  address_street: 'Adresa',
  address_city: 'Grad',
  email_public: 'Javni email',
  order_email_recipients: 'Primaoci porudžbina',
  pause_message: 'Poruka tokom pauze'
};

function adminSettings_() {
  var s = getSettings_();
  var out = {};
  Object.keys(ADMIN_SETTINGS_).forEach(function (k) {
    out[k] = s[k] === undefined ? '' : s[k];
  });
  out.test_mode = s.test_mode;
  out.zones_enabled = s.zones_enabled;
  return out;
}

function cleanSetting_(key, value) {
  var rule = ADMIN_SETTINGS_[key].split(':');
  var label = SETTING_LABELS_[key] || key;
  switch (rule[0]) {
    case 'bool':
      return value === true || String(value).toUpperCase() === 'TRUE' ? 'TRUE' : 'FALSE';
    case 'int':
      return String(requireInt_(value, key, label, Number(rule[1]), Number(rule[2])));
    case 'text':
      return GG_Validation.clean(value, Number(rule[1]));
    case 'phone': {
      var ph = GG_Validation.normalizePhone(value, { allowLandline: true });
      if (!ph.ok) throw apiError_('VALIDATION', label + ': broj nije ispravan.', { field: key });
      return ph.e164;
    }
    case 'email': {
      var em = GG_Validation.validateEmail(value, false);
      if (!em.ok) throw apiError_('VALIDATION', label + ': ' + em.message, { field: key });
      return em.value;
    }
    case 'emails': {
      var list = splitList_(value);
      var bad = list.filter(function (a) { return !GG_Validation.validateEmail(a, true).ok; });
      if (bad.length) throw apiError_('VALIDATION', label + ': neispravna adresa ' + bad[0] + '.', { field: key });
      if (!list.length) throw apiError_('VALIDATION', label + ': unesite bar jednu adresu.', { field: key });
      return list.join(', ');
    }
    default:
      throw apiError_('BAD_REQUEST', 'Nepoznato podešavanje.');
  }
}

function adminSaveSettings_(p) {
  var changes = p.changes || {};
  var keys = Object.keys(changes).filter(function (k) {
    return Object.prototype.hasOwnProperty.call(ADMIN_SETTINGS_, k);
  });
  if (!keys.length) throw apiError_('BAD_REQUEST', 'Nema izmena.');
  var clean = {};
  keys.forEach(function (k) {
    clean[k] = cleanSetting_(k, changes[k]);
  });
  var merged = adminSettings_();
  Object.keys(clean).forEach(function (k) {
    merged[k] = clean[k];
  });
  [['pickup_eta_min', 'pickup_eta_max', 'preuzimanje'], ['delivery_eta_min', 'delivery_eta_max', 'dostavu']].forEach(function (pair) {
    if (toNum_(merged[pair[0]], 0) > toNum_(merged[pair[1]], 0)) {
      throw apiError_('VALIDATION', 'Procena za ' + pair[2] + ': „od“ ne može biti veće od „do“.', { field: pair[0] });
    }
  });
  return withAdminLock_(function () {
    keys.forEach(function (k) {
      setSetting_(k, clean[k]);
    });
    invalidateConfigCache_();
    log_('INFO', 'admin.settings.save', 'OK', JSON.stringify(clean).slice(0, 400));
    return { settings: adminSettings_(), changed: clean };
  });
}

function setSetting_(key, value) {
  var rows = findRows_(SHEETS.SETTINGS, 'key', key);
  if (rows.length) updateRow_(SHEETS.SETTINGS, rows[0], { value: String(value) });
  else appendObjects_(SHEETS.SETTINGS, [{ key: key, value: String(value), note: '' }]);
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

function adminFeedback_(p) {
  var page = Math.max(0, Math.floor(toNum_(p.page, 0)));
  var rows = readTable_(SHEETS.FEEDBACK).rows.sort(function (a, b) {
    return String(b['Created At']).localeCompare(String(a['Created At']));
  });
  var sum = 0;
  var dist = [0, 0, 0, 0, 0];
  rows.forEach(function (r) {
    var n = toNum_(r.Rating, 0);
    sum += n;
    if (n >= 1 && n <= 5) dist[n - 1]++;
  });
  var labels = function (list, dict) {
    return splitList_(list).map(function (k) { return dict[k] || k; });
  };
  return {
    count: rows.length,
    average: rows.length ? round_(sum / rows.length, 2) : 0,
    distribution: dist,
    items: rows.slice(page * 30, page * 30 + 30).map(function (r) {
      return {
        orderNumber: toNum_(r['Order Number'], 0),
        orderId: String(r['Order ID'] || ''),
        rating: toNum_(r.Rating, 0),
        good: labels(r.Good, GG_Validation.FEEDBACK_GOOD),
        improve: labels(r.Improve, GG_Validation.FEEDBACK_IMPROVE),
        comment: String(r.Comment || ''),
        name: String(r['Customer Name'] || ''),
        mode: r['Order Type'] === 'DELIVERY' ? 'delivery' : 'pickup',
        createdAt: textCell_(r['Created At'])
      };
    })
  };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

var ADMIN_ROUTES = {
  'admin.board': adminBoard_,
  'admin.order': adminOrder_,
  'admin.status': adminStatus_,
  'admin.history': adminHistory_,
  'admin.catalog': adminCatalog_,
  'admin.product.save': adminSaveProduct_,
  'admin.product.move': adminMoveProduct_,
  'admin.product.flag': adminProductFlag_,
  'admin.category.save': adminSaveCategory_,
  'admin.category.move': adminMoveCategory_,
  'admin.group.save': adminSaveGroup_,
  'admin.option.save': adminSaveOption_,
  'admin.option.move': adminMoveOption_,
  'admin.image.upload': adminUploadImage_,
  'admin.zones': adminZones_,
  'admin.zone.save': adminSaveZone_,
  'admin.zone.move': adminMoveZone_,
  'admin.hours': adminHours_,
  'admin.hours.save': adminSaveHours_,
  'admin.settings': adminSettings_,
  'admin.settings.save': adminSaveSettings_,
  'admin.feedback': adminFeedback_,
  'admin.pin.change': adminChangePin_
};

function adminRoute_(action, payload) {
  var p = payload || {};
  requireAdmin_(p.token);
  return ADMIN_ROUTES[action](p);
}
