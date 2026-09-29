/**
 * Grčki Giros — order pipeline.
 *   validate → idempotency → time → zone → prices → cash → rate limit →
 *   [lock: number, write ORDERS + ORDER_ITEMS, CRM] → emails → log → response
 * Anything after the write can fail without losing the order: it is already saved and numbered.
 * A new order is NEW until the shop confirms or rejects it (accept_timeout_min, default 5 min).
 */

var CLOSED_LEAD_ = 'Trenutno ne primamo porudžbine.';

function closedMessage_(reason, mode, availability, settings, parts, cfg) {
  if (reason === 'paused') return (settings.pause_message || 'Trenutno ne primamo porudžbine preko sajta.') + ' Pozovite nas: ' + settings.phone_display + '.';
  if (reason === 'disabled') {
    return mode === 'delivery' ? 'Dostava je trenutno isključena. Izaberite preuzimanje u lokalu.' : 'Preuzimanje u lokalu je trenutno isključeno. Izaberite dostavu.';
  }
  var next = availability.next ? availability.next.label : 'uskoro';
  if (reason === 'break') return CLOSED_LEAD_ + ' Pauza je u toku, poručivanje ponovo ' + next + '.';
  if (mode === 'delivery') {
    var pickup = GG_Scheduling.availability(parts, cfg, 'pickup');
    if (pickup.canOrder) return 'Dostava trenutno ne radi. Preuzimanje u lokalu je moguće do ' + pickup.lastOrder + '.';
  }
  return CLOSED_LEAD_ + ' Poručivanje ponovo ' + next + '.';
}

/** Cart lines exactly as typed values; anything of the wrong type becomes a value the price check refuses. */
function normalizeItems_(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 60).map(function (it) {
    var i = it && typeof it === 'object' && !Array.isArray(it) ? it : {};
    return {
      productId: typeof i.productId === 'string' ? i.productId.slice(0, 60) : '',
      qty: typeof i.qty === 'number' || typeof i.qty === 'string' ? Number(i.qty) : NaN,
      options: Array.isArray(i.options)
        ? i.options.slice(0, 40).map(function (o) {
            return typeof o === 'string' ? o.slice(0, 60) : '';
          })
        : [],
      note: GG_Validation.clean(i.note, GG_Validation.LIMITS.lineNote)
    };
  });
}

function detectChannel_(meta) {
  var c = String((meta && meta.channel) || '').toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 30);
  return c || 'direct';
}

/** 'četvrtak 24.09. u 18:30' — absolute, so it stays true in emails read the next day. */
function scheduledText_(dateIso, time) {
  if (!dateIso) return '';
  return GG_Scheduling.DAY_NAMES[GG_Scheduling.dowOf(dateIso)].toLowerCase() + ' ' + GG_Scheduling.formatDateShort(dateIso) + ' u ' + time;
}

function createOrder_(payload, ctx) {
  var started = (ctx && ctx.started) || Date.now();
  var p = payload || {};
  var settings = getSettings_();

  if (!validRequestId_(p.requestId)) throw apiError_('BAD_REQUEST', 'Zahtev nije ispravan. Osvežite stranicu i pokušajte ponovo.');
  checkBot_(p.meta);

  var prior = idempotencyGet_(p.requestId);
  if (prior) {
    log_('INFO', 'order.create', 'DUPLICATE', 'Ponovljen zahtev, vraćena ista porudžbina #' + prior.publicNumber, { orderId: prior.orderId });
    prior.duplicate = true;
    return prior;
  }

  try {
    return createNewOrder_(p, settings, started);
  } catch (err) {
    // A retry whose first answer was lost (and the cache evicted) must get that order back, not
    // "closed", "rate limited" or "price changed" because something moved in the meantime.
    if (err && err.expected && err.code !== 'BUSY') {
      var saved = null;
      try {
        saved = findResponseByRequestId_(p.requestId, settings);
      } catch (ignored) {}
      if (saved) {
        log_('INFO', 'order.create', 'DUPLICATE', 'Ponovljen zahtev (iz tabele), vraćena ista porudžbina #' + saved.publicNumber, { orderId: saved.orderId });
        saved.duplicate = true;
        return saved;
      }
    }
    throw err;
  }
}

function createNewOrder_(p, settings, started) {
  var contact = GG_Validation.validateOrderContact(p);
  if (!contact.ok) {
    var firstField = Object.keys(contact.errors)[0];
    throw apiError_('VALIDATION', contact.errors[firstField], { field: firstField, fields: contact.errors });
  }
  var v = contact.value;

  // Time: always the server's clock and the owner's current config.
  var cfg = schedulingConfig_();
  var parts = nowParts_();
  var when = p.when === 'asap' ? 'asap' : typeof p.when === 'string' ? p.when : '';
  var wv = GG_Scheduling.validateWhen(parts, cfg, v.mode, when, 10);
  if (!wv.ok) {
    if (wv.code === 'CLOSED') throw apiError_('CLOSED', closedMessage_(wv.reason, v.mode, wv.availability, settings, parts, cfg));
    throw apiError_('SLOT_UNAVAILABLE', 'Izabrani termin više nije dostupan. Izaberite novi termin.', { field: 'when' });
  }

  // Zone: the guest picks a neighbourhood from the owner's list; anything else is not delivered to.
  var zone = null;
  if (v.mode === 'delivery' && toBool_(settings.zones_enabled, false)) {
    if (!v.zone) throw apiError_('VALIDATION', 'Izaberite naselje za dostavu.', { field: 'address.zone' });
    zone = getZones_().filter(function (z) {
      return z.id === v.zone;
    })[0];
    if (!zone) {
      throw apiError_('ZONE_UNAVAILABLE', 'Dostava u izabrano naselje trenutno nije dostupna. Izaberite drugo naselje ili preuzimanje u lokalu.', { field: 'address.zone' });
    }
  }

  // Prices come from the sheet, never from the browser.
  var index = catalogIndex_();
  var minOrder = v.mode === 'delivery' ? deliveryMinimum_(zone, settings) : toNum_(settings.min_order_pickup, 0);
  var cart = GG_Pricing.computeCart(index, normalizeItems_(p.items), {
    mode: v.mode,
    feeMode: settings.delivery_fee_mode,
    defaultFee: toNum_(settings.delivery_fee_default, 0),
    zoneFee: zone ? zone.fee : undefined,
    freeThreshold: toNum_(settings.free_delivery_threshold, 0),
    minOrder: minOrder,
    maxLines: toNum_(settings.max_lines_per_order, 30),
    maxQty: toNum_(settings.max_qty_per_line, 20)
  });
  if (!cart.ok) {
    var first = cart.errors[0];
    if (first.code === 'ITEM_UNAVAILABLE') {
      throw apiError_('ITEM_UNAVAILABLE', first.message + ' Uklonite ga iz korpe i pošaljite ponovo.', { data: { productId: first.productId } });
    }
    if (first.shortfall) throw apiError_('MIN_ORDER', first.message, { field: 'items', data: { minOrder: minOrder, shortfall: first.shortfall } });
    throw apiError_('VALIDATION', first.message, { field: first.field || 'items' });
  }
  if (toNum_(p.clientTotal, -1) !== cart.total) {
    throw apiError_('PRICE_CHANGED', 'Cene ili dostava su se u međuvremenu promenile. Novi iznos je ' + GG_Money.formatRSD(cart.total) + '. Proverite korpu i potvrdite ponovo.', {
      data: { subtotal: cart.subtotal, deliveryFee: cart.deliveryFee, total: cart.total }
    });
  }

  var cash = '';
  var change = '';
  if (v.mode === 'delivery') {
    var cv = GG_Validation.validateCash(p.cash, cart.total, toNum_(settings.cash_max_over_total, 20000));
    if (!cv.ok) throw apiError_('VALIDATION', cv.message, { field: 'cash' });
    cash = cv.value;
    change = cv.change;
  }

  // Counted only once everything else is valid, so honest corrections don't burn the limit.
  enforceOrderRateLimits_(v.phone, settings);

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_MS)) {
    throw apiError_('BUSY', 'Trenutno primamo mnogo porudžbina odjednom. Pokušajte ponovo za nekoliko sekundi ili nas pozovite na ' + settings.phone_display + '.');
  }
  var order;
  var response;
  try {
    var again = idempotencyGet_(p.requestId) || findResponseByRequestId_(p.requestId, settings);
    if (again) {
      again.duplicate = true;
      return again;
    }
    var counterBefore = counterState_();
    var num = nextOrderNumber_(lock, toNum_(settings.order_number_start, 1001));
    var created = now_();
    var businessDate = wv.availability.businessDate;
    var acceptMin = Math.max(1, toNum_(settings.accept_timeout_min, 5));
    order = {
      id: buildOrderId_(businessDate, num.publicNumber, num.seq),
      publicNumber: num.publicNumber,
      seq: num.seq,
      businessDate: businessDate,
      createdAt: created,
      createdIso: isoLocal_(created),
      acceptByIso: isoLocal_(new Date(created.getTime() + acceptMin * 60000)),
      mode: v.mode,
      type: ORDER_TYPE[v.mode],
      status: STATUS.NEW,
      customer: { name: v.name, phone: v.phone, phoneDisplay: v.phoneDisplay, email: v.email },
      address: {
        street: v.address.street,
        number: v.address.number,
        apt: v.address.apt,
        floor: v.address.floor,
        note: v.address.note,
        zoneId: zone ? zone.id : '',
        zoneName: zone ? zone.name : ''
      },
      note: v.note,
      lines: cart.lines.map(function (l) {
        var cat = index.categories[l.product.categoryId] || {};
        return {
          productId: l.productId,
          name: l.product.name,
          categoryId: l.product.categoryId,
          categoryName: cat.name || '',
          kind: l.product.kind || 'item',
          qty: l.qty,
          basePrice: Number(l.product.price) || 0,
          optionsPrice: l.optionsTotal,
          unitPrice: l.unitPrice,
          lineTotal: l.lineTotal,
          options: l.options,
          summary: l.summary,
          removedSummary: l.removedSummary,
          note: l.note
        };
      }),
      itemCount: cart.itemCount,
      subtotal: cart.subtotal,
      deliveryFee: cart.deliveryFee,
      deliveryExternal: cart.deliveryExternal,
      total: cart.total,
      cash: cash,
      change: change,
      when: wv.asap ? 'asap' : 'scheduled',
      scheduledDate: wv.scheduledDate || '',
      scheduledTime: wv.scheduledTime || '',
      promisedLabel: wv.promisedLabel,
      etaMin: wv.availability.asap.etaMin,
      etaMax: wv.availability.asap.etaMax,
      requestId: p.requestId,
      statusToken: randomHex_(20).toLowerCase(),
      channel: detectChannel_(p.meta),
      locationId: settings.location_id || 'GG-01'
    };
    try {
      order.row = writeOrder_(order);
    } catch (writeErr) {
      // Nothing was saved: give the number back so the sequence has no gap, then fail loudly.
      PropertiesService.getScriptProperties().setProperties({ ORDER_SEQ: String(counterBefore.seq), PUBLIC_NO: String(counterBefore.lastPublic) });
      throw writeErr;
    }
    SpreadsheetApp.flush();
    response = orderResponse_(order, settings);
    idempotencyPut_(p.requestId, response);
    try {
      upsertCustomer_(order);
    } catch (crmErr) {
      logError_('crm.upsert', crmErr, { orderId: order.id, severity: 'WARN' });
    }
  } finally {
    lock.releaseLock();
  }

  var emailStatus = 'SKIPPED';
  try {
    emailStatus = sendOrderEmails_(order, settings);
  } catch (mailErr) {
    emailStatus = 'FAILED';
    logError_('email.order', mailErr, { orderId: order.id });
  }
  try {
    updateRow_(SHEETS.ORDERS, order.row, { 'Email Status': emailStatus });
  } catch (ignored) {}

  log_('INFO', 'order.create', 'OK', '#' + order.publicNumber + ' ' + order.type + ' ' + order.total + ' RSD, email ' + emailStatus, {
    orderId: order.id,
    durationMs: Date.now() - started
  });
  return response;
}

/** ORDERS "Requested Time": ŠTO PRE or HH:MM (the date lives in its own column). */
function whenLabel_(order) {
  return order.when === 'asap' ? 'ŠTO PRE' : order.scheduledTime;
}

/** Full human sentence: 'ŠTO PRE' or 'ZAKAZANO četvrtak 24.09. u 18:30'. */
function whenText_(order) {
  return order.when === 'asap' ? 'ŠTO PRE' : 'ZAKAZANO ' + scheduledText_(order.scheduledDate, order.scheduledTime);
}

function addressLine_(order) {
  if (order.mode !== 'delivery') return '';
  var a = order.address;
  return (a.street + ' ' + a.number).trim();
}

/** 'stan 12, 3. sprat' from the two optional fields. */
function aptFloorText_(address) {
  var parts = [];
  if (address.apt) parts.push(/^\d/.test(address.apt) ? 'stan ' + address.apt : address.apt);
  if (address.floor) parts.push(/^\d+$/.test(address.floor) ? address.floor + '. sprat' : 'sprat ' + address.floor);
  return parts.join(', ');
}

function itemsText_(lines) {
  return lines
    .map(function (l) {
      var parts = [l.qty + '× ' + l.name];
      if (l.summary) parts.push(l.summary);
      if (l.removedSummary) parts.push(l.removedSummary);
      if (l.note) parts.push('napomena: ' + l.note);
      return parts.join(' — ');
    })
    .join('\n');
}

function writeOrder_(order) {
  var row = appendObjects_(SHEETS.ORDERS, [
    {
      Timestamp: order.createdAt,
      'Business Date': order.businessDate,
      'Internal Order ID': order.id,
      'Public Order Number': order.publicNumber,
      'Order Type': order.type,
      Status: order.status,
      'Customer Name': order.customer.name,
      Phone: order.customer.phone,
      Email: order.customer.email,
      Address: addressLine_(order),
      Apartment: order.address.apt,
      Floor: order.address.floor,
      Zone: order.address.zoneName,
      'Delivery Note': order.address.note,
      'Order Note': order.note,
      'Order Items': itemsText_(order.lines),
      'Items Count': order.itemCount,
      Subtotal: order.subtotal,
      'Delivery Cost': order.deliveryFee,
      Total: order.total,
      'Cash Provided': order.cash,
      'Change Required': order.change,
      'Requested Time': whenLabel_(order),
      'Scheduled Date': order.scheduledDate,
      'Scheduled Time': order.scheduledTime,
      'Promised Time': order.promisedLabel,
      'Accept By': order.acceptByIso,
      Source: 'website',
      Channel: order.channel,
      'Request ID': order.requestId,
      'Status Token': order.statusToken,
      'Created At': order.createdIso,
      'Updated At': order.createdIso,
      'Items JSON': JSON.stringify(order.lines),
      'Email Status': 'PENDING',
      'Location ID': order.locationId
    }
  ]);
  // The order itself is saved at this point; line items feed statistics and self-heal nightly.
  try {
    appendObjects_(SHEETS.ORDER_ITEMS, itemRowsFor_(order.id, order.businessDate, order.publicNumber, order.type, order.status, order.createdIso, order.lines));
  } catch (itemsErr) {
    logError_('order.items', itemsErr, { orderId: order.id, severity: 'WARN' });
  }
  return row;
}

function itemRowsFor_(orderId, businessDate, publicNumber, type, status, createdIso, lines) {
  return lines.map(function (l, i) {
    return {
      'Order ID': orderId,
      'Business Date': businessDate,
      'Public Number': publicNumber,
      Line: i + 1,
      'Product ID': l.productId,
      Product: l.name,
      'Category ID': l.categoryId,
      Category: l.categoryName,
      Kind: l.kind,
      Qty: l.qty,
      'Base Price': l.basePrice === undefined ? '' : l.basePrice,
      'Options Price': l.optionsPrice === undefined ? '' : l.optionsPrice,
      'Unit Price': l.unitPrice,
      'Line Total': l.lineTotal,
      Options: l.summary,
      'Option IDs': (l.options || []).join(', '),
      Removed: l.removedSummary,
      Note: l.note,
      'Order Type': type,
      Status: status,
      'Created At': createdIso
    };
  });
}

/** Maintenance: re-creates ORDER_ITEMS rows for orders whose items were not written (from Items JSON). */
function repairOrderItems_() {
  var have = {};
  readTable_(SHEETS.ORDER_ITEMS).rows.forEach(function (r) {
    have[String(r['Order ID'])] = true;
  });
  var missing = [];
  readTable_(SHEETS.ORDERS).rows.forEach(function (r) {
    var id = String(r['Internal Order ID'] || '');
    if (!id || have[id]) return;
    var lines = [];
    try {
      lines = JSON.parse(r['Items JSON'] || '[]');
    } catch (ignored) {}
    if (!lines.length) return;
    missing = missing.concat(itemRowsFor_(id, textDate_(r['Business Date']), r['Public Order Number'], r['Order Type'], r.Status, String(r['Created At'] || ''), lines));
  });
  if (missing.length) appendObjects_(SHEETS.ORDER_ITEMS, missing);
  return missing.length;
}

function statusUrl_(order, settings) {
  var site = String(settings.site_url || '').replace(/\/$/, '');
  return site + '/porudzbina/?id=' + encodeURIComponent(order.id) + '&t=' + encodeURIComponent(order.statusToken);
}

/** What the browser gets back (also cached for idempotent retries). */
function orderResponse_(order, settings) {
  return {
    publicNumber: order.publicNumber,
    orderId: order.id,
    statusToken: order.statusToken,
    status: order.status,
    businessDate: order.businessDate,
    createdAt: order.createdIso,
    acceptBy: order.acceptByIso,
    mode: order.mode,
    when: order.when,
    whenLabel: whenLabel_(order),
    whenText: whenText_(order),
    scheduledDate: order.scheduledDate,
    scheduledTime: order.scheduledTime,
    promisedTime: order.promisedLabel,
    etaMin: order.etaMin,
    etaMax: order.etaMax,
    customer: { name: order.customer.name, phoneDisplay: order.customer.phoneDisplay || order.customer.phone, email: order.customer.email },
    address:
      order.mode === 'delivery'
        ? { line: addressLine_(order), apt: order.address.apt, floor: order.address.floor, aptFloor: aptFloorText_(order.address), zone: order.address.zoneName, note: order.address.note }
        : null,
    note: order.note,
    items: order.lines.map(function (l) {
      return { name: l.name, qty: l.qty, lineTotal: l.lineTotal, summary: l.summary, removedSummary: l.removedSummary, note: l.note };
    }),
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    deliveryExternal: !!order.deliveryExternal,
    total: order.total,
    cash: order.cash === '' ? null : order.cash,
    change: order.change === '' ? null : order.change,
    location: {
      name: settings.business_name,
      address: [settings.address_street, settings.address_city].filter(Boolean).join(', '),
      phone: settings.phone_display,
      phoneE164: settings.phone_e164
    }
  };
}

function textCell_(value) {
  if (value instanceof Date) return isoLocal_(value);
  return String(value === null || value === undefined ? '' : value);
}

/** Rebuilds an order object from its ORDERS row (idempotency fallback, admin, emails). */
function orderFromRow_(r) {
  var lines = [];
  try {
    lines = JSON.parse(r['Items JSON'] || '[]');
  } catch (ignored) {}
  var mode = r['Order Type'] === 'DELIVERY' ? 'delivery' : 'pickup';
  var addressLine = String(r.Address || '');
  var created = r.Timestamp instanceof Date ? r.Timestamp : new Date(r['Created At'] || now_());
  var requested = String(r['Requested Time'] || '');
  var phone = String(r.Phone || '');
  var phoneNorm = GG_Validation.normalizePhone(phone);
  var scheduledDate = r['Scheduled Date'] instanceof Date ? fmt_(r['Scheduled Date'], 'yyyy-MM-dd') : String(r['Scheduled Date'] || '');
  return {
    row: r._row,
    id: String(r['Internal Order ID']),
    publicNumber: toNum_(r['Public Order Number'], 0),
    businessDate: textDate_(r['Business Date']),
    createdAt: created,
    createdIso: String(r['Created At'] || isoLocal_(created)),
    acceptByIso: textCell_(r['Accept By']),
    mode: mode,
    type: String(r['Order Type']),
    status: String(r.Status || STATUS.NEW),
    customer: { name: String(r['Customer Name'] || ''), phone: phone, phoneDisplay: phoneNorm.ok ? phoneNorm.display : phone, email: String(r.Email || '') },
    address: {
      street: addressLine,
      number: '',
      apt: String(r.Apartment || ''),
      floor: String(r.Floor || ''),
      note: String(r['Delivery Note'] || ''),
      zoneId: '',
      zoneName: String(r.Zone || '')
    },
    note: String(r['Order Note'] || ''),
    lines: lines,
    itemCount: toNum_(r['Items Count'], 0),
    subtotal: toNum_(r.Subtotal, 0),
    deliveryFee: toNum_(r['Delivery Cost'], 0),
    total: toNum_(r.Total, 0),
    cash: r['Cash Provided'] === '' ? '' : toNum_(r['Cash Provided'], ''),
    change: r['Change Required'] === '' ? '' : toNum_(r['Change Required'], ''),
    when: requested === 'ŠTO PRE' || !scheduledDate ? 'asap' : 'scheduled',
    scheduledDate: scheduledDate,
    scheduledTime: String(r['Scheduled Time'] || ''),
    promisedLabel: String(r['Promised Time'] || ''),
    requestId: String(r['Request ID'] || ''),
    statusToken: String(r['Status Token'] || ''),
    channel: String(r.Channel || ''),
    emailStatus: String(r['Email Status'] || ''),
    confirmedAt: textCell_(r['Confirmed At']),
    preparingAt: textCell_(r['Preparing At']),
    readyAt: textCell_(r['Ready At']),
    completedAt: textCell_(r['Completed At']),
    rejectedAt: textCell_(r['Rejected At']),
    updatedAt: textCell_(r['Updated At']),
    locationId: String(r['Location ID'] || '')
  };
}

/**
 * "Did my earlier attempt arrive?" — asked by the checkout after a send whose answer never came
 * (lost connection, page refreshed mid-send). Never creates anything. The request id is a random
 * UUID only that browser knows, so it works as the key to its own order.
 */
function lookupOrder_(payload) {
  var p = payload || {};
  if (!validRequestId_(p.requestId)) throw apiError_('BAD_REQUEST', 'Zahtev nije ispravan.');
  var hit = idempotencyGet_(p.requestId);
  if (hit) return { found: true, order: hit };
  // An attempt being written right now holds the script lock: wait for it to finish before reading.
  var lock = LockService.getScriptLock();
  if (lock.tryLock(8000)) lock.releaseLock();
  var saved = findResponseByRequestId_(p.requestId, getSettings_(), 400);
  return saved ? { found: true, order: saved } : { found: false };
}

function findResponseByRequestId_(requestId, settings, depth) {
  var tail = readTail_(SHEETS.ORDERS, depth || 80);
  for (var i = tail.length - 1; i >= 0; i--) {
    if (String(tail[i]['Request ID']) === requestId) {
      var response = orderResponse_(orderFromRow_(tail[i]), settings);
      idempotencyPut_(requestId, response);
      return response;
    }
  }
  return null;
}

/** True when a NEW order has waited longer than accept_timeout_min. */
function isOverdue_(order, nowMs) {
  if (order.status !== STATUS.NEW || !order.acceptByIso) return false;
  var deadline = Date.parse(order.acceptByIso);
  return isFinite(deadline) && (nowMs || now_().getTime()) > deadline;
}

/** Guest polling: needs the order id and its random status token. */
function orderStatus_(params) {
  var id = String((params && params.id) || '').slice(0, 40);
  var token = String((params && params.t) || '').slice(0, 64);
  if (!ORDER_ID_PATTERN.test(id) || !token) throw apiError_('BAD_REQUEST', 'Nepoznata porudžbina.');
  var cache = CacheService.getScriptCache();
  var hit = cache.get('st:' + id);
  var info = hit ? JSON.parse(hit) : null;
  if (!info) {
    var rows = findRows_(SHEETS.ORDERS, 'Internal Order ID', id);
    if (!rows.length) throw apiError_('BAD_REQUEST', 'Nepoznata porudžbina.');
    var o = orderFromRow_(readRow_(SHEETS.ORDERS, rows[0]));
    info = {
      token: o.statusToken,
      status: o.status,
      publicNumber: o.publicNumber,
      mode: o.mode,
      when: o.when,
      whenText: whenText_(o),
      promisedTime: o.promisedLabel,
      acceptBy: o.acceptByIso,
      createdAt: o.createdIso,
      confirmedAt: o.confirmedAt,
      readyAt: o.readyAt,
      completedAt: o.completedAt,
      rejectedAt: o.rejectedAt,
      updatedAt: o.updatedAt,
      total: o.total,
      feedbackGiven: o.status === STATUS.COMPLETED ? feedbackExists_(o.id) : false
    };
    cache.put('st:' + id, JSON.stringify(info), 15);
  }
  if (!safeEqual_(info.token, token)) throw apiError_('BAD_REQUEST', 'Nepoznata porudžbina.');
  var nowMs = now_().getTime();
  var out = {};
  Object.keys(info).forEach(function (k) {
    if (k !== 'token') out[k] = info[k];
  });
  out.overdue = isOverdue_({ status: info.status, acceptByIso: info.acceptBy }, nowMs);
  out.feedbackAllowed = info.status === STATUS.COMPLETED && !info.feedbackGiven;
  out.serverNow = nowMs;
  return out;
}
