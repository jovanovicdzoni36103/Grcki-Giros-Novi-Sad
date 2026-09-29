/**
 * Grčki Giros — statistics engine. Pure functions over order/item records, so the same code
 * feeds the dashboard, the rollup sheets and the emailed reports (and is unit-tested locally).
 *
 * Revenue = food subtotal of orders that are not REJECTED (+ delivery if revenue_includes_delivery).
 */

var WEEKDAY_NAMES_ = ['', 'Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota', 'Nedelja'];

function textDate_(value) {
  if (value instanceof Date) return fmt_(value, 'yyyy-MM-dd');
  return String(value || '').slice(0, 10);
}

/** ORDERS rows → lean records. */
function orderRecords_(rows) {
  return rows
    .map(function (r) {
      var createdIso = String(r['Created At'] || '');
      var hour = /T(\d{2}):/.test(createdIso) ? parseInt(createdIso.match(/T(\d{2}):/)[1], 10) : r.Timestamp instanceof Date ? hourOf_(r.Timestamp) : 0;
      return {
        id: String(r['Internal Order ID'] || ''),
        businessDate: textDate_(r['Business Date']),
        hour: hour,
        status: String(r.Status || 'NEW'),
        type: String(r['Order Type'] || ''),
        subtotal: toNum_(r.Subtotal, 0),
        deliveryFee: toNum_(r['Delivery Cost'], 0),
        total: toNum_(r.Total, 0),
        requested: hmCell_(r['Requested Time']),
        phone: String(r.Phone || '')
      };
    })
    .filter(function (o) {
      return o.id && /^\d{4}-\d{2}-\d{2}$/.test(o.businessDate);
    });
}

/** ORDER_ITEMS rows → lean records. */
function itemRecords_(rows) {
  return rows.map(function (r) {
    return {
      orderId: String(r['Order ID'] || ''),
      productId: String(r['Product ID'] || ''),
      name: String(r.Product || ''),
      categoryId: String(r['Category ID'] || ''),
      category: String(r.Category || ''),
      kind: String(r.Kind || 'item'),
      qty: toNum_(r.Qty, 0),
      lineTotal: toNum_(r['Line Total'], 0)
    };
  });
}

function rankMap_(map, key) {
  return Object.keys(map)
    .map(function (k) {
      return map[k];
    })
    .sort(function (a, b) {
      return b[key] - a[key] || (b.revenue || 0) - (a.revenue || 0);
    });
}

function hourLabel_(h) {
  var a = (h < 10 ? '0' : '') + h;
  var b = ((h + 1) % 24 < 10 ? '0' : '') + ((h + 1) % 24);
  return a + ':00–' + b + ':00';
}

function slotLabel_(requested) {
  if (!requested || requested === 'ŠTO PRE') return 'ŠTO PRE';
  var h = parseInt(String(requested).slice(0, 2), 10);
  return isFinite(h) ? 'Zakazano ' + hourLabel_(h) : 'ŠTO PRE';
}

/**
 * Aggregates orders whose business date is within [from, to] (inclusive, YYYY-MM-DD strings).
 */
function aggregate_(orders, items, from, to, includeDelivery) {
  var inRange = orders.filter(function (o) {
    return o.businessDate >= from && o.businessDate <= to;
  });
  var statusById = {};
  inRange.forEach(function (o) {
    statusById[o.id] = o.status;
  });
  var valid = inRange.filter(function (o) {
    return STATUS_NOT_REVENUE.indexOf(o.status) === -1;
  });
  var cancelled = inRange.length - valid.length;

  var revenue = 0;
  var deliveryFees = 0;
  var delivery = 0;
  var byHour = {};
  var byWeekday = {};
  var slots = {};
  var phones = {};
  valid.forEach(function (o) {
    var r = o.subtotal + (includeDelivery ? o.deliveryFee : 0);
    revenue += r;
    deliveryFees += o.deliveryFee;
    if (o.type === 'DELIVERY') delivery++;
    var h = (byHour[o.hour] = byHour[o.hour] || { name: hourLabel_(o.hour), hour: o.hour, orders: 0, revenue: 0 });
    h.orders++;
    h.revenue += r;
    var dow = GG_Scheduling.dowOf(o.businessDate);
    var d = (byWeekday[dow] = byWeekday[dow] || { name: WEEKDAY_NAMES_[dow], dow: dow, orders: 0, revenue: 0 });
    d.orders++;
    d.revenue += r;
    var sl = slotLabel_(o.requested);
    slots[sl] = slots[sl] || { name: sl, orders: 0 };
    slots[sl].orders++;
    if (o.phone) phones[o.phone] = (phones[o.phone] || 0) + 1;
  });

  var products = {};
  var packages = {};
  var categories = {};
  var itemsSold = 0;
  items.forEach(function (it) {
    var st = statusById[it.orderId];
    if (st === undefined || STATUS_NOT_REVENUE.indexOf(st) !== -1) return;
    itemsSold += it.qty;
    var bucket = it.kind === 'bundle' ? packages : products;
    var p = (bucket[it.productId] = bucket[it.productId] || { id: it.productId, name: it.name, qty: 0, revenue: 0 });
    p.qty += it.qty;
    p.revenue += it.lineTotal;
    var c = (categories[it.categoryId] = categories[it.categoryId] || { id: it.categoryId, name: it.category || it.categoryId, qty: 0, revenue: 0 });
    c.qty += it.qty;
    c.revenue += it.lineTotal;
  });

  var orderCount = valid.length;
  // "Top" = what earns the most; a 200 RSD drink ordered with every giros would otherwise always win on quantity.
  var topProducts = rankMap_(products, 'revenue');
  var topPackages = rankMap_(packages, 'revenue');
  var topCategories = rankMap_(categories, 'revenue');
  var byHourList = rankMap_(byHour, 'orders');
  var byWeekdayList = rankMap_(byWeekday, 'orders');
  var topSlots = rankMap_(slots, 'orders');
  var dates = inRange.map(function (o) {
    return o.businessDate;
  }).sort();
  var phoneList = Object.keys(phones);

  return {
    from: from,
    to: to,
    orders: orderCount,
    cancelled: cancelled,
    revenue: revenue,
    deliveryFees: deliveryFees,
    aov: orderCount ? Math.round(revenue / orderCount) : 0,
    delivery: delivery,
    pickup: orderCount - delivery,
    deliveryPct: orderCount ? (delivery / orderCount) * 100 : 0,
    pickupPct: orderCount ? ((orderCount - delivery) / orderCount) * 100 : 0,
    cancelRate: inRange.length ? (cancelled / inRange.length) * 100 : 0,
    itemsSold: itemsSold,
    topProducts: topProducts,
    topPackages: topPackages,
    topCategories: topCategories,
    byHourList: byHourList,
    byWeekdayList: byWeekdayList,
    topSlots: topSlots,
    topProduct: topProducts[0] ? topProducts[0].name : '',
    topPackage: topPackages[0] ? topPackages[0].name : '',
    topCategory: topCategories[0] ? topCategories[0].name : '',
    busiestHour: byHourList[0] ? byHourList[0].name : '',
    busiestDay: byWeekdayList[0] ? byWeekdayList[0].name : '',
    topSlot: topSlots[0] ? topSlots[0].name : '',
    firstDate: dates[0] || '',
    lastDate: dates[dates.length - 1] || '',
    customers: phoneList.length,
    returningCustomers: phoneList.filter(function (p) {
      return phones[p] > 1;
    }).length
  };
}

function growthPct_(current, previous) {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

/** Co-occurrence: for each product, the products most often in the same (valid) order. */
function coOccurrence_(orders, items, sinceDate, limit) {
  var validIds = {};
  orders.forEach(function (o) {
    if (o.businessDate >= sinceDate && STATUS_NOT_REVENUE.indexOf(o.status) === -1) validIds[o.id] = true;
  });
  var byOrder = {};
  var names = {};
  items.forEach(function (it) {
    if (!validIds[it.orderId] || it.kind === 'bundle') return;
    names[it.productId] = it.name;
    (byOrder[it.orderId] = byOrder[it.orderId] || {})[it.productId] = true;
  });
  var pairs = {};
  var seen = {};
  Object.keys(byOrder).forEach(function (oid) {
    var ids = Object.keys(byOrder[oid]);
    ids.forEach(function (a) {
      seen[a] = (seen[a] || 0) + 1;
      ids.forEach(function (b) {
        if (a === b) return;
        pairs[a] = pairs[a] || {};
        pairs[a][b] = (pairs[a][b] || 0) + 1;
      });
    });
  });
  return Object.keys(pairs).map(function (a) {
    var top = Object.keys(pairs[a])
      .sort(function (x, y) {
        return pairs[a][y] - pairs[a][x];
      })
      .slice(0, limit || 3);
    return {
      productId: a,
      name: names[a] || a,
      ids: top,
      names: top.map(function (id) {
        return names[id] || id;
      }),
      seen: seen[a] || 0
    };
  });
}
