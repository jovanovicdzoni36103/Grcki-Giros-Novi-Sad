/**
 * Grčki Giros — lightweight CRM keyed by phone number (no accounts, no login).
 * Updated incrementally on each order and status change; rebuilt from ORDERS every night
 * so any drift (manual edits, failed writes) heals by itself.
 */

function parseCounts_(value) {
  try {
    var obj = JSON.parse(value || '{}');
    return obj && typeof obj === 'object' ? obj : {};
  } catch (ignored) {
    return {};
  }
}

function favoriteOf_(counts) {
  var best = '';
  var bestQty = 0;
  Object.keys(counts).forEach(function (name) {
    if (counts[name] > bestQty) {
      best = name;
      bestQty = counts[name];
    }
  });
  return best;
}

function upsertCustomer_(order) {
  var phone = order.customer.phone;
  if (!phone) return;
  var rows = findRows_(SHEETS.CUSTOMERS, 'Phone', phone);
  var existing = rows.length ? readRow_(SHEETS.CUSTOMERS, rows[0]) : null;
  var counts = parseCounts_(existing ? existing['Product Counts'] : '');
  order.lines.forEach(function (l) {
    counts[l.name] = (counts[l.name] || 0) + l.qty;
  });
  var orders = (existing ? toNum_(existing.Orders, 0) : 0) + 1;
  var spent = (existing ? toNum_(existing['Total Spent'], 0) : 0) + order.total;
  var record = {
    Phone: phone,
    Name: order.customer.name,
    Email: order.customer.email || (existing ? existing.Email : ''),
    'First Order At': existing ? existing['First Order At'] : order.createdIso,
    'Last Order At': order.createdIso,
    Orders: orders,
    'Total Spent': spent,
    'Average Order': Math.round(spent / orders),
    'Favorite Product': favoriteOf_(counts),
    'Last Address': order.mode === 'delivery' ? addressLine_(order) + (order.address.apt ? ', ' + order.address.apt : '') : existing ? existing['Last Address'] : '',
    'Delivery Orders': (existing ? toNum_(existing['Delivery Orders'], 0) : 0) + (order.mode === 'delivery' ? 1 : 0),
    'Pickup Orders': (existing ? toNum_(existing['Pickup Orders'], 0) : 0) + (order.mode === 'pickup' ? 1 : 0),
    'Cancelled Orders': existing ? toNum_(existing['Cancelled Orders'], 0) : 0,
    'Product Counts': JSON.stringify(counts)
  };
  if (existing) updateRow_(SHEETS.CUSTOMERS, existing._row, record);
  else appendObjects_(SHEETS.CUSTOMERS, [record]);
}

/** Status moved into or out of CANCELLED/FAILED: keep spend and counts honest. */
function adjustCustomerForStatus_(orderRow, fromStatus, toStatus) {
  var wasCounted = STATUS_NOT_REVENUE.indexOf(fromStatus) === -1;
  var isCounted = STATUS_NOT_REVENUE.indexOf(toStatus) === -1;
  if (wasCounted === isCounted) return;
  var phone = String(orderRow.Phone || '');
  var rows = findRows_(SHEETS.CUSTOMERS, 'Phone', phone);
  if (!rows.length) return;
  var c = readRow_(SHEETS.CUSTOMERS, rows[0]);
  var sign = isCounted ? 1 : -1;
  var orders = Math.max(0, toNum_(c.Orders, 0) + sign);
  var spent = Math.max(0, toNum_(c['Total Spent'], 0) + sign * toNum_(orderRow.Total, 0));
  updateRow_(SHEETS.CUSTOMERS, rows[0], {
    Orders: orders,
    'Total Spent': spent,
    'Average Order': orders ? Math.round(spent / orders) : 0,
    'Cancelled Orders': Math.max(0, toNum_(c['Cancelled Orders'], 0) - sign)
  });
}

/** Nightly: recompute every customer from ORDERS, keeping the owner's Notes column. */
function rebuildCustomers_() {
  var orders = readTable_(SHEETS.ORDERS).rows;
  var existing = readTable_(SHEETS.CUSTOMERS);
  var notes = {};
  existing.rows.forEach(function (r) {
    if (r.Notes) notes[String(r.Phone)] = r.Notes;
  });
  var byPhone = {};
  orders.forEach(function (r) {
    var phone = String(r.Phone || '');
    if (!phone) return;
    var c = (byPhone[phone] = byPhone[phone] || {
      Phone: phone,
      Name: '',
      Email: '',
      'First Order At': '',
      'Last Order At': '',
      Orders: 0,
      'Total Spent': 0,
      counts: {},
      'Last Address': '',
      'Delivery Orders': 0,
      'Pickup Orders': 0,
      'Cancelled Orders': 0
    });
    var created = String(r['Created At'] || '');
    if (!c['First Order At'] || created < c['First Order At']) c['First Order At'] = created;
    if (created >= c['Last Order At']) {
      c['Last Order At'] = created;
      c.Name = String(r['Customer Name'] || c.Name);
      if (r.Email) c.Email = String(r.Email);
      if (r['Order Type'] === 'DELIVERY') c['Last Address'] = String(r.Address || '') + (r['Apartment/Floor'] ? ', ' + r['Apartment/Floor'] : '');
    }
    if (STATUS_NOT_REVENUE.indexOf(String(r.Status)) !== -1) {
      c['Cancelled Orders'] += 1;
      return;
    }
    c.Orders += 1;
    c['Total Spent'] += toNum_(r.Total, 0);
    if (r['Order Type'] === 'DELIVERY') c['Delivery Orders'] += 1;
    else c['Pickup Orders'] += 1;
    try {
      JSON.parse(r['Items JSON'] || '[]').forEach(function (l) {
        c.counts[l.name] = (c.counts[l.name] || 0) + (l.qty || 0);
      });
    } catch (ignored) {}
  });
  var records = Object.keys(byPhone).map(function (phone) {
    var c = byPhone[phone];
    return {
      Phone: phone,
      Name: c.Name,
      Email: c.Email,
      'First Order At': c['First Order At'],
      'Last Order At': c['Last Order At'],
      Orders: c.Orders,
      'Total Spent': c['Total Spent'],
      'Average Order': c.Orders ? Math.round(c['Total Spent'] / c.Orders) : 0,
      'Favorite Product': favoriteOf_(c.counts),
      'Last Address': c['Last Address'],
      'Delivery Orders': c['Delivery Orders'],
      'Pickup Orders': c['Pickup Orders'],
      'Cancelled Orders': c['Cancelled Orders'],
      'Product Counts': JSON.stringify(c.counts),
      Notes: notes[phone] || ''
    };
  });
  records.sort(function (a, b) {
    return b['Total Spent'] - a['Total Spent'];
  });
  var sh = existing.sheet;
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
  if (records.length) appendObjects_(SHEETS.CUSTOMERS, records);
  return records.length;
}
