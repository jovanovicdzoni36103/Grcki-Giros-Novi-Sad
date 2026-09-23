/**
 * Grčki Giros — emails.
 * The kitchen email is an operational ticket, not marketing: number, type, time, cash/change first.
 * Every recipient is sent separately, so one bad address never blocks the others.
 * test_mode=TRUE redirects everything to the test recipient with a [TEST] subject.
 */

var C_ = {
  blue: '#1B4F8C',
  blueDeep: '#123A6B',
  gold: '#F5A623',
  goldTint: '#FDF0D8',
  ink: '#16202E',
  ink2: '#4A5261',
  line: '#E6E0D2',
  paper: '#FAF7F0',
  tomato: '#D1432B',
  olive: '#4C7A3A'
};

function esc_(value) {
  return GG_Validation.escapeHtml(value);
}

function rsd_(value) {
  return GG_Money.formatRSD(value);
}

function effectiveUserEmail_() {
  try {
    return Session.getEffectiveUser().getEmail() || '';
  } catch (ignored) {
    return '';
  }
}

/**
 * Sends one message to each recipient. Returns { sent:[], failed:[{to,error}], skipped, degraded, test }.
 * opts: { priorityFirst: when quota is short, still deliver to the first recipient; replyTo; attachments }
 */
function deliverEmail_(recipients, subject, html, text, opts) {
  var o = opts || {};
  var settings = getSettings_();
  var result = { sent: [], failed: [], skipped: '', degraded: false, test: false };
  var list = recipients.slice();
  var finalSubject = subject;
  var finalHtml = html;
  if (toBool_(settings.test_mode, true)) {
    var testTo = recipients_(settings.test_email_recipient)[0] || effectiveUserEmail_();
    if (!testTo) {
      result.skipped = 'test_mode_no_recipient';
      return result;
    }
    result.test = true;
    finalSubject = '[TEST] ' + subject;
    finalHtml =
      '<div style="background:' + C_.tomato + ';color:#fff;font:bold 13px Arial,sans-serif;padding:8px 12px">TEST REŽIM — u produkciji bi ovo dobili: ' +
      esc_(list.join(', ') || '(niko)') + '</div>' + html;
    list = [testTo];
  }
  if (!list.length) {
    result.skipped = 'no_recipients';
    return result;
  }
  var quota = 100;
  try {
    quota = MailApp.getRemainingDailyQuota();
  } catch (ignored) {}
  if (quota < list.length) {
    if (o.priorityFirst && quota >= 1) {
      list = list.slice(0, quota);
      result.degraded = true;
      log_('WARN', 'email.quota', 'DEGRADED', 'Dnevna email kvota je pri kraju (' + quota + '), šaljem samo prvom primaocu.');
    } else {
      result.skipped = 'quota';
      log_('ERROR', 'email.quota', 'FAIL', 'Dnevna email kvota je potrošena, email nije poslat: ' + subject);
      return result;
    }
  }
  list.forEach(function (to) {
    var attempt = 0;
    while (attempt < 2) {
      try {
        var message = { to: to, subject: finalSubject, htmlBody: finalHtml, body: text, name: settings.business_name || 'Grčki Giros' };
        if (o.replyTo) message.replyTo = o.replyTo;
        if (o.attachments) message.attachments = o.attachments;
        MailApp.sendEmail(message);
        result.sent.push(to);
        if (attempt > 0) log_('INFO', 'email.send', 'OK', 'Poslato iz drugog pokušaja: ' + to, { retry: attempt });
        return;
      } catch (err) {
        attempt++;
        if (attempt >= 2) {
          result.failed.push({ to: to, error: err.message });
          logError_('email.send', err, { retry: attempt - 1, context: { to: to, subject: finalSubject } });
        } else {
          Utilities.sleep(800);
        }
      }
    }
  });
  return result;
}

function emailStatusOf_(res, total) {
  if (res.skipped) return 'SKIPPED (' + res.skipped + ')';
  var prefix = res.test ? 'TEST ' : '';
  if (!res.sent.length) return prefix + 'FAILED';
  if (res.failed.length || res.degraded) return prefix + 'PARTIAL ' + res.sent.length + '/' + total;
  return prefix + 'SENT ' + res.sent.length;
}

function sendOrderEmails_(order, settings) {
  var kitchen = recipients_(settings.order_email_recipients);
  var ticket = kitchenTicket_(order, settings);
  var res = deliverEmail_(kitchen, ticket.subject, ticket.html, ticket.text, { priorityFirst: true });
  var status = emailStatusOf_(res, kitchen.length);
  if (order.customer.email && toBool_(settings.customer_confirmation_enabled, true)) {
    var conf = customerConfirmation_(order, settings);
    var cres = deliverEmail_([order.customer.email], conf.subject, conf.html, conf.text, { replyTo: settings.email_public });
    status += cres.sent.length ? ' · kupac OK' : ' · kupac ' + (cres.skipped || 'FAILED');
  }
  return status;
}

// ---------------------------------------------------------------------------
// Kitchen ticket
// ---------------------------------------------------------------------------

function mapsLink_(order, settings) {
  var q = addressLine_(order) + ', ' + (settings.address_city || 'Novi Sad');
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
}

function infoRow_(label, valueHtml) {
  return (
    '<tr><td style="padding:6px 0;width:110px;vertical-align:top;font-size:12px;letter-spacing:1px;color:' + C_.ink2 + ';text-transform:uppercase">' + label + '</td>' +
    '<td style="padding:6px 0;font-size:16px;vertical-align:top">' + valueHtml + '</td></tr>'
  );
}

function linesTable_(lines) {
  var html = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">';
  lines.forEach(function (l) {
    html +=
      '<tr><td style="padding:10px 0 2px;font-size:17px;font-weight:bold;vertical-align:top;width:44px">' + l.qty + '×</td>' +
      '<td style="padding:10px 0 2px;font-size:17px;font-weight:bold">' + esc_(l.name) + '</td>' +
      '<td align="right" style="padding:10px 0 2px;font-size:15px;white-space:nowrap">' + esc_(GG_Money.formatNumber(l.lineTotal)) + '</td></tr>';
    var details = [];
    if (l.summary) details.push('<div style="color:' + C_.ink + '">' + esc_(l.summary) + '</div>');
    if (l.removedSummary) details.push('<div style="color:' + C_.tomato + ';font-weight:bold">' + esc_(l.removedSummary) + '</div>');
    if (l.note) details.push('<div style="color:' + C_.ink2 + ';font-style:italic">„' + esc_(l.note) + '“</div>');
    if (details.length) {
      html += '<tr><td></td><td colspan="2" style="padding:0 0 10px;font-size:14px;line-height:1.45;border-bottom:1px solid ' + C_.line + '">' + details.join('') + '</td></tr>';
    } else {
      html += '<tr><td colspan="3" style="border-bottom:1px solid ' + C_.line + ';padding:0 0 8px"></td></tr>';
    }
  });
  return html + '</table>';
}

function totalsTable_(order) {
  var rows = [['Međuzbir', rsd_(order.subtotal), false]];
  if (order.mode === 'delivery') rows.push(['Dostava', order.deliveryExternal ? 'po cenovniku službe' : rsd_(order.deliveryFee), false]);
  rows.push(['UKUPNO', rsd_(order.total), true]);
  return (
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
    rows
      .map(function (r) {
        var style = r[2] ? 'font-size:20px;font-weight:900;padding-top:8px' : 'font-size:15px;color:' + C_.ink2;
        return '<tr><td style="' + style + '">' + r[0] + '</td><td align="right" style="' + style + '">' + esc_(r[1]) + '</td></tr>';
      })
      .join('') +
    '</table>'
  );
}

function kitchenTicket_(order, settings) {
  var isDelivery = order.mode === 'delivery';
  var typeLabel = isDelivery ? 'DOSTAVA' : 'PREUZIMANJE';
  var timeLabel = order.when === 'asap' ? 'ŠTO PRE' : 'ZAKAZANO ' + order.when;
  var eta = order.when === 'asap' ? 'oko ' + order.promisedLabel : '';
  var shortName = order.customer.name.split(' ')[0] + (order.customer.name.split(' ')[1] ? ' ' + order.customer.name.split(' ')[1].charAt(0) + '.' : '');
  var subject = '#' + order.publicNumber + ' · ' + typeLabel + ' · ' + timeLabel + ' · ' + GG_Money.formatNumber(order.total) + ' RSD · ' + shortName;
  var site = String(settings.site_url || '').replace(/\/$/, '');

  var cashBlock = '';
  if (isDelivery) {
    cashBlock =
      '<tr><td style="padding:0 16px 16px"><div style="background:' + C_.goldTint + ';border-left:6px solid ' + C_.gold + ';padding:12px 14px;font-size:18px;line-height:1.4">' +
      'Plaća <b>' + rsd_(order.cash) + '</b> gotovinom<br>Kusur: <b style="font-size:22px">' + rsd_(order.change) + '</b></div></td></tr>';
  } else {
    cashBlock =
      '<tr><td style="padding:0 16px 16px"><div style="background:' + C_.goldTint + ';border-left:6px solid ' + C_.gold + ';padding:12px 14px;font-size:17px">Plaća gotovinom na kasi: <b>' +
      rsd_(order.total) + '</b></div></td></tr>';
  }

  var people = infoRow_('Kupac', '<b>' + esc_(order.customer.name) + '</b>');
  people += infoRow_('Telefon', '<a href="tel:' + esc_(order.customer.phone) + '" style="color:' + C_.blue + ';font-weight:bold;font-size:18px;text-decoration:none">' + esc_(order.customer.phoneDisplay || order.customer.phone) + '</a>');
  if (isDelivery) {
    var addr = esc_(addressLine_(order)) + (order.address.apt ? ', ' + esc_(order.address.apt) : '');
    people += infoRow_('Adresa', '<a href="' + esc_(mapsLink_(order, settings)) + '" style="color:' + C_.ink + ';font-weight:bold">' + addr + '</a>');
    if (order.address.zoneName) people += infoRow_('Naselje', esc_(order.address.zoneName));
    if (order.address.note) people += infoRow_('Za kurira', esc_(order.address.note));
  }
  if (order.customer.email) people += infoRow_('Email', esc_(order.customer.email));

  var noteBlock = order.note
    ? '<tr><td style="padding:0 16px 16px"><div style="border:2px dashed ' + C_.tomato + ';padding:10px 12px;font-size:16px"><div style="font-size:11px;letter-spacing:1.5px;color:' + C_.tomato + ';font-weight:bold">NAPOMENA ZA KUHINJU</div>' + esc_(order.note).replace(/\n/g, '<br>') + '</div></td></tr>'
    : '';

  var html =
    '<div style="background:' + C_.paper + ';padding:16px 8px;font-family:Arial,Helvetica,sans-serif;color:' + C_.ink + '">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border:2px solid ' + C_.ink + '">' +
    '<tr><td style="background:' + C_.blue + ';color:#fff;padding:10px 16px;font-size:12px;letter-spacing:2px;font-weight:bold">' + esc_((settings.business_name || 'Grčki Giros').toUpperCase()) + ' · NOVA PORUDŽBINA</td></tr>' +
    '<tr><td style="padding:16px 16px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
    '<td style="font-size:60px;font-weight:900;line-height:1;letter-spacing:-1px">#' + order.publicNumber + '</td>' +
    '<td align="right" style="vertical-align:top"><span style="display:inline-block;background:' + (isDelivery ? C_.blue : C_.gold) + ';color:' + (isDelivery ? '#fff' : C_.ink) + ';padding:7px 12px;font-weight:bold;font-size:14px;letter-spacing:1px">' + typeLabel + '</span></td>' +
    '</tr></table>' +
    '<div style="font-size:22px;font-weight:bold;margin-top:10px">' + timeLabel + (eta ? ' <span style="font-weight:normal;color:' + C_.ink2 + ';font-size:17px">· ' + eta + '</span>' : '') + '</div>' +
    '<div style="font-size:14px;color:' + C_.ink2 + ';margin-top:4px">Primljeno ' + esc_(displayDateTime_(order.createdAt)) + '</div></td></tr>' +
    cashBlock +
    '<tr><td style="padding:0 16px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + people + '</table></td></tr>' +
    '<tr><td style="padding:8px 16px 4px;border-top:2px solid ' + C_.ink + '">' + linesTable_(order.lines) + '</td></tr>' +
    '<tr><td style="padding:8px 16px 16px">' + totalsTable_(order) + '</td></tr>' +
    noteBlock +
    '<tr><td style="padding:12px 16px;background:' + C_.paper + ';font-size:12px;color:' + C_.ink2 + ';line-height:1.5">' +
    esc_(order.id) + ' · sa sajta' + (order.channel && order.channel !== 'direct' ? ' (' + esc_(order.channel) + ')' : '') +
    (site ? '<br><a href="' + esc_(site) + '/panel/" style="color:' + C_.blue + ';font-weight:bold">Otvori panel porudžbina →</a>' : '') +
    '</td></tr></table></div>';

  var text = [
    'NOVA PORUDŽBINA #' + order.publicNumber + ' — ' + (settings.business_name || 'Grčki Giros'),
    typeLabel + ' · ' + timeLabel + (eta ? ' (' + eta + ')' : ''),
    '',
    'KUPAC: ' + order.customer.name,
    'TELEFON: ' + (order.customer.phoneDisplay || order.customer.phone),
    isDelivery ? 'ADRESA: ' + addressLine_(order) + (order.address.apt ? ', ' + order.address.apt : '') : '',
    isDelivery && order.address.note ? 'ZA KURIRA: ' + order.address.note : '',
    '',
    'PROIZVODI:',
    itemsText_(order.lines),
    '',
    'UKUPNO: ' + rsd_(order.total),
    isDelivery ? 'PLAĆA: ' + rsd_(order.cash) + '\nKUSUR: ' + rsd_(order.change) : 'PLAĆA NA KASI: ' + rsd_(order.total),
    order.note ? '\nNAPOMENA: ' + order.note : '',
    '',
    order.id
  ]
    .filter(function (l) {
      return l !== '';
    })
    .join('\n')
    .replace(/ /g, ' ');

  return { subject: subject, html: html, text: text };
}

// ---------------------------------------------------------------------------
// Customer confirmation
// ---------------------------------------------------------------------------

function customerConfirmation_(order, settings) {
  var isDelivery = order.mode === 'delivery';
  var site = String(settings.site_url || '').replace(/\/$/, '');
  var statusUrl = site + '/porudzbina/?id=' + encodeURIComponent(order.id) + '&t=' + encodeURIComponent(order.statusToken);
  var when = order.when === 'asap' ? (isDelivery ? 'Što pre — oko ' + order.promisedLabel : 'Što pre — spremno oko ' + order.promisedLabel) : 'Zakazano za ' + order.when;
  var pay = isDelivery
    ? 'Gotovinom dostavljaču: ' + rsd_(order.total) + '. Pripremite ' + rsd_(order.cash) + (order.change ? ', kusur ' + rsd_(order.change) + '.' : '.')
    : 'Gotovinom na kasi: ' + rsd_(order.total) + '.';
  var where = isDelivery
    ? esc_(addressLine_(order)) + (order.address.apt ? ', ' + esc_(order.address.apt) : '')
    : esc_(settings.business_name) + ', ' + esc_(settings.address_street) + ', ' + esc_(settings.address_city);

  var html =
    '<div style="background:' + C_.paper + ';padding:20px 8px;font-family:Arial,Helvetica,sans-serif;color:' + C_.ink + '">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#fff">' +
    '<tr><td style="background:' + C_.blue + ';color:#fff;padding:22px 24px"><div style="font-size:13px;letter-spacing:2px;font-weight:bold">GRČKI GIROS</div>' +
    '<div style="font-size:26px;font-weight:900;margin-top:8px;line-height:1.15">Porudžbina je primljena.</div></td></tr>' +
    '<tr><td style="padding:24px"><div style="font-size:12px;letter-spacing:1.5px;color:' + C_.ink2 + '">BROJ PORUDŽBINE</div>' +
    '<div style="font-size:64px;font-weight:900;line-height:1;margin:4px 0 8px">#' + order.publicNumber + '</div>' +
    '<div style="font-size:14px;color:' + C_.ink2 + '">Sačuvajte broj porudžbine. Ako nas zovete, samo ga recite.</div></td></tr>' +
    '<tr><td style="padding:0 24px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
    infoRow_(isDelivery ? 'Dostava na' : 'Preuzimanje', where) +
    infoRow_('Vreme', esc_(when)) +
    infoRow_('Plaćanje', esc_(pay)) +
    '</table></td></tr>' +
    '<tr><td style="padding:8px 24px;border-top:1px solid ' + C_.line + '">' + linesTable_(order.lines) + '</td></tr>' +
    '<tr><td style="padding:8px 24px 20px">' + totalsTable_(order) + '</td></tr>' +
    '<tr><td style="padding:0 24px 24px"><a href="' + esc_(statusUrl) + '" style="display:inline-block;background:' + C_.gold + ';color:' + C_.ink + ';font-weight:bold;text-decoration:none;padding:14px 22px;border-radius:999px">Pratite status porudžbine</a></td></tr>' +
    '<tr><td style="padding:16px 24px;background:' + C_.paper + ';font-size:13px;color:' + C_.ink2 + ';line-height:1.5">Izmena ili otkazivanje: <a href="tel:' + esc_(settings.phone_e164) + '" style="color:' + C_.blue + ';font-weight:bold">' + esc_(settings.phone_display) + '</a><br>' +
    esc_(settings.business_name) + ' · ' + esc_(settings.address_street) + ', ' + esc_(settings.address_city) + '</td></tr>' +
    '</table></div>';

  var text = [
    'Porudžbina je primljena. Broj porudžbine: #' + order.publicNumber,
    (isDelivery ? 'Dostava na: ' : 'Preuzimanje: ') + (isDelivery ? addressLine_(order) : settings.address_street + ', ' + settings.address_city),
    'Vreme: ' + when,
    'Plaćanje: ' + pay,
    '',
    itemsText_(order.lines),
    '',
    'Ukupno: ' + rsd_(order.total),
    'Status: ' + statusUrl,
    'Izmena ili otkazivanje: ' + settings.phone_display
  ]
    .join('\n')
    .replace(/ /g, ' ');

  return { subject: 'Porudžbina #' + order.publicNumber + ' je primljena — Grčki Giros', html: html, text: text };
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

function pctText_(value) {
  if (value === null || value === undefined || !isFinite(value)) return '—';
  return (value > 0 ? '+' : '') + round_(value, 1) + '%';
}

function kpiCell_(label, value, sub) {
  return (
    '<td style="padding:12px;border:1px solid ' + C_.line + ';vertical-align:top;width:50%">' +
    '<div style="font-size:11px;letter-spacing:1.5px;color:' + C_.ink2 + ';text-transform:uppercase">' + esc_(label) + '</div>' +
    '<div style="font-size:24px;font-weight:900;margin-top:4px">' + esc_(value) + '</div>' +
    (sub ? '<div style="font-size:12px;color:' + C_.ink2 + ';margin-top:2px">' + esc_(sub) + '</div>' : '') +
    '</td>'
  );
}

function barList_(title, rows, valueKey, labelKey, suffix) {
  if (!rows || !rows.length) return '';
  var max = Math.max.apply(null, rows.map(function (r) { return r[valueKey] || 0; })) || 1;
  var html = '<div style="font-size:12px;letter-spacing:1.5px;font-weight:bold;margin:20px 0 8px">' + esc_(title.toUpperCase()) + '</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0">';
  rows.forEach(function (r) {
    var w = Math.max(2, Math.round(((r[valueKey] || 0) / max) * 100));
    html +=
      '<tr><td style="font-size:14px;padding:4px 8px 4px 0;width:42%">' + esc_(r[labelKey]) + '</td>' +
      '<td style="padding:4px 0"><div style="background:' + C_.blue + ';height:10px;width:' + w + '%"></div></td>' +
      '<td align="right" style="font-size:14px;padding:4px 0 4px 8px;white-space:nowrap;width:90px">' + esc_(GG_Money.formatNumber(r[valueKey])) + (suffix || '') + '</td></tr>';
  });
  return html + '</table>';
}

/** report: { kind, title, periodLabel, stats, previous, lifetime, compareLabel } */
function reportEmail_(report, settings) {
  var s = report.stats;
  var p = report.previous;
  function delta(cur, prev) {
    if (!p || !prev) return '';
    return (report.compareLabel || 'prethodni period') + ': ' + pctText_(((cur - prev) / prev) * 100);
  }
  var grid =
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">' +
    '<tr>' + kpiCell_('Prihod', rsd_(s.revenue), delta(s.revenue, p && p.revenue)) + kpiCell_('Porudžbine', GG_Money.formatNumber(s.orders), delta(s.orders, p && p.orders)) + '</tr>' +
    '<tr>' + kpiCell_('Prosečna porudžbina', rsd_(s.aov), '') + kpiCell_('Otkazano', GG_Money.formatNumber(s.cancelled), s.orders + s.cancelled ? round_(s.cancelRate, 1) + '% porudžbina' : '') + '</tr>' +
    '<tr>' + kpiCell_('Dostava', GG_Money.formatNumber(s.delivery), round_(s.deliveryPct, 0) + '%') + kpiCell_('Preuzimanje', GG_Money.formatNumber(s.pickup), round_(s.pickupPct, 0) + '%') + '</tr>' +
    '</table>';

  function withQty(rows) {
    return rows.map(function (r) {
      return { name: r.name + ' · ' + r.qty + ' kom', revenue: r.revenue };
    });
  }
  var sections = '';
  sections += barList_('Top proizvodi', withQty(s.topProducts.slice(0, 5)), 'revenue', 'name', ' RSD');
  if (report.kind !== 'daily') sections += barList_('Top paketi', withQty(s.topPackages.slice(0, 3)), 'revenue', 'name', ' RSD');
  if (report.kind === 'monthly') sections += barList_('Top kategorije', s.topCategories.slice(0, 5), 'revenue', 'name', ' RSD');
  if (report.kind !== 'daily') sections += barList_('Najprometniji dani', s.byWeekdayList.slice(0, 7), 'orders', 'name', '');
  sections += barList_('Najprometniji sati', s.byHourList.slice(0, report.kind === 'daily' ? 4 : 6), 'orders', 'name', '');
  if (report.kind === 'monthly') sections += barList_('Vremena porudžbina', s.topSlots.slice(0, 5), 'orders', 'name', '');

  var lifetime = report.lifetime
    ? '<div style="margin-top:24px;padding:14px;background:' + C_.blue + ';color:#fff"><div style="font-size:11px;letter-spacing:1.5px">SAJT JE UKUPNO DONEO (OD ' + esc_(displayDate_(report.lifetime.firstDate)) + ')</div>' +
      '<div style="font-size:26px;font-weight:900;margin-top:4px">' + rsd_(report.lifetime.revenue) + '</div>' +
      '<div style="font-size:13px;opacity:.85">' + GG_Money.formatNumber(report.lifetime.orders) + ' porudžbina · prosečno ' + rsd_(report.lifetime.aov) + '</div></div>'
    : '';

  var html =
    '<div style="background:' + C_.paper + ';padding:20px 8px;font-family:Arial,Helvetica,sans-serif;color:' + C_.ink + '">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff">' +
    '<tr><td style="background:' + C_.ink + ';color:#fff;padding:18px 20px"><div style="font-size:12px;letter-spacing:2px;color:' + C_.gold + ';font-weight:bold">' + esc_(report.title) + '</div>' +
    '<div style="font-size:22px;font-weight:900;margin-top:6px">' + esc_(report.periodLabel) + '</div><div style="font-size:13px;opacity:.8;margin-top:2px">' + esc_(settings.business_name) + '</div></td></tr>' +
    '<tr><td style="padding:20px">' + (s.orders + s.cancelled === 0 ? '<p style="font-size:16px">U ovom periodu nije bilo porudžbina preko sajta.</p>' : grid + sections) + lifetime + '</td></tr>' +
    '<tr><td style="padding:14px 20px;background:' + C_.paper + ';font-size:12px;color:' + C_.ink2 + '">Prihod = hrana iz porudžbina koje nisu otkazane' + (toBool_(settings.revenue_includes_delivery, false) ? ', sa dostavom' : ', bez dostave') + '. Detalji u Google Sheets tabeli (DASHBOARD).</td></tr>' +
    '</table></div>';

  var text = [
    report.title + ' — ' + report.periodLabel,
    settings.business_name,
    'Porudžbine: ' + s.orders,
    'Prihod: ' + rsd_(s.revenue),
    'Dostava: ' + s.delivery,
    'Preuzimanje: ' + s.pickup,
    'Prosečna porudžbina: ' + rsd_(s.aov),
    'Otkazano: ' + s.cancelled,
    s.topProducts.length ? 'Top: ' + s.topProducts.slice(0, 3).map(function (t) { return t.name + ' (' + t.qty + ')'; }).join(', ') : '',
    report.lifetime ? 'Ukupno od prvog dana: ' + rsd_(report.lifetime.revenue) : ''
  ]
    .filter(Boolean)
    .join('\n')
    .replace(/ /g, ' ');

  return { subject: report.title + ' · ' + report.periodLabel + ' · ' + GG_Money.formatNumber(s.revenue) + ' RSD', html: html, text: text };
}

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

function simpleCard_(title, rows, footer) {
  return (
    '<div style="background:' + C_.paper + ';padding:16px 8px;font-family:Arial,Helvetica,sans-serif;color:' + C_.ink + '">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-top:6px solid ' + C_.blue + '">' +
    '<tr><td style="padding:18px 20px 6px;font-size:20px;font-weight:900">' + esc_(title) + '</td></tr>' +
    '<tr><td style="padding:0 20px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
    rows.map(function (r) { return infoRow_(r[0], r[1]); }).join('') +
    '</table></td></tr>' +
    (footer ? '<tr><td style="padding:12px 20px;background:' + C_.paper + ';font-size:12px;color:' + C_.ink2 + '">' + footer + '</td></tr>' : '') +
    '</table></div>'
  );
}
