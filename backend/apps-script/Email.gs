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
 * opts: { priorityFirst: when quota is short, still deliver to the first recipient; replyTo; attachments;
 *         reserve: skip unless this many sends stay left afterwards (guest emails keep room for kitchen tickets) }
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
  if (o.reserve && quota - list.length < o.reserve) {
    result.skipped = 'quota_reserved';
    log_('WARN', 'email.quota', 'SKIPPED', 'Email kvota je pri kraju (' + quota + '), email kupcu je preskočen da bi kuhinja i dalje dobijala porudžbine: ' + subject);
    return result;
  }
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
  var kitchen = notificationRecipients_(settings);
  var ticket = kitchenTicket_(order, settings);
  var res = deliverEmail_(kitchen, ticket.subject, ticket.html, ticket.text, { priorityFirst: true });
  var status = emailStatusOf_(res, kitchen.length);
  if (order.customer.email && toBool_(settings.customer_confirmation_enabled, true)) {
    var conf = customerConfirmation_(order, settings);
    var cres = deliverEmail_([order.customer.email], conf.subject, conf.html, conf.text, { replyTo: settings.email_public, reserve: GUEST_EMAIL_RESERVE });
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
  var timeLabel = whenText_(order);
  var subjectTime = order.when === 'asap' ? 'ŠTO PRE' : 'ZAKAZANO ' + GG_Scheduling.formatDateShort(order.scheduledDate) + ' ' + order.scheduledTime;
  var eta = order.when === 'asap' ? 'oko ' + order.promisedLabel : '';
  var shortName = order.customer.name.split(' ')[0] + (order.customer.name.split(' ')[1] ? ' ' + order.customer.name.split(' ')[1].charAt(0) + '.' : '');
  var subject = '#' + order.publicNumber + ' · ' + typeLabel + ' · ' + subjectTime + ' · ' + GG_Money.formatNumber(order.total) + ' RSD · ' + shortName;
  var site = String(settings.site_url || '').replace(/\/$/, '');
  var acceptMin = toNum_(settings.accept_timeout_min, 5);
  var aptFloor = aptFloorText_(order.address);

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
    var addr = esc_(addressLine_(order)) + (aptFloor ? ', ' + esc_(aptFloor) : '');
    people += infoRow_('Adresa', '<a href="' + esc_(mapsLink_(order, settings)) + '" style="color:' + C_.ink + ';font-weight:bold">' + addr + '</a>');
    if (order.address.zoneName) people += infoRow_('Zona', esc_(order.address.zoneName));
    if (order.address.note) people += infoRow_('Za kurira', esc_(order.address.note));
  }
  if (order.customer.email) people += infoRow_('Email', esc_(order.customer.email));

  var noteBlock = order.note
    ? '<tr><td style="padding:0 16px 16px"><div style="border:2px dashed ' + C_.tomato + ';padding:10px 12px;font-size:16px"><div style="font-size:11px;letter-spacing:1.5px;color:' + C_.tomato + ';font-weight:bold">NAPOMENA KUPCA</div>' + esc_(order.note).replace(/\n/g, '<br>') + '</div></td></tr>'
    : '';

  var acceptBlock =
    '<tr><td style="padding:0 16px 14px"><div style="background:' + C_.tomato + ';color:#fff;padding:10px 12px;font-size:15px;font-weight:bold">Prihvatite ili odbijte u roku od ' + acceptMin + ' min' +
    (site ? ' · <a href="' + esc_(site) + '/admin/" style="color:#fff">otvori admin panel</a>' : '') + '</div></td></tr>';

  var html =
    '<div style="background:' + C_.paper + ';padding:16px 8px;font-family:Arial,Helvetica,sans-serif;color:' + C_.ink + '">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border:2px solid ' + C_.ink + '">' +
    '<tr><td style="background:' + C_.blue + ';color:#fff;padding:10px 16px;font-size:12px;letter-spacing:2px;font-weight:bold">' + esc_((settings.business_name || 'Grčki Giros').toUpperCase()) + ' · NOVA PORUDŽBINA</td></tr>' +
    '<tr><td style="padding:16px 16px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
    '<td style="font-size:60px;font-weight:900;line-height:1;letter-spacing:-1px">#' + order.publicNumber + '</td>' +
    '<td align="right" style="vertical-align:top"><span style="display:inline-block;background:' + (isDelivery ? C_.blue : C_.gold) + ';color:' + (isDelivery ? '#fff' : C_.ink) + ';padding:7px 12px;font-weight:bold;font-size:14px;letter-spacing:1px">' + typeLabel + '</span></td>' +
    '</tr></table>' +
    '<div style="font-size:22px;font-weight:bold;margin-top:10px">' + esc_(timeLabel) + (eta ? ' <span style="font-weight:normal;color:' + C_.ink2 + ';font-size:17px">· ' + eta + '</span>' : '') + '</div>' +
    '<div style="font-size:14px;color:' + C_.ink2 + ';margin-top:4px">Primljeno ' + esc_(displayDateTime_(order.createdAt)) + '</div></td></tr>' +
    acceptBlock +
    cashBlock +
    '<tr><td style="padding:0 16px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + people + '</table></td></tr>' +
    '<tr><td style="padding:8px 16px 4px;border-top:2px solid ' + C_.ink + '">' + linesTable_(order.lines) + '</td></tr>' +
    '<tr><td style="padding:8px 16px 16px">' + totalsTable_(order) + '</td></tr>' +
    noteBlock +
    '<tr><td style="padding:12px 16px;background:' + C_.paper + ';font-size:12px;color:' + C_.ink2 + ';line-height:1.5">' +
    esc_(order.id) + ' · sa sajta' + (order.channel && order.channel !== 'direct' ? ' (' + esc_(order.channel) + ')' : '') +
    (site ? '<br><a href="' + esc_(site) + '/admin/" style="color:' + C_.blue + ';font-weight:bold">Otvori admin panel →</a>' : '') +
    '</td></tr></table></div>';

  var text = [
    'NOVA PORUDŽBINA #' + order.publicNumber + ' — ' + (settings.business_name || 'Grčki Giros'),
    typeLabel + ' · ' + timeLabel + (eta ? ' (' + eta + ')' : ''),
    'PRIHVATITE ILI ODBIJTE U ROKU OD ' + acceptMin + ' MIN' + (site ? ': ' + site + '/admin/' : ''),
    '',
    'KUPAC: ' + order.customer.name,
    'TELEFON: ' + (order.customer.phoneDisplay || order.customer.phone),
    isDelivery ? 'ADRESA: ' + addressLine_(order) + (aptFloor ? ', ' + aptFloor : '') : '',
    isDelivery && order.address.zoneName ? 'ZONA: ' + order.address.zoneName : '',
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
// Guest emails: received, confirmed, rejected, ready for pickup
// ---------------------------------------------------------------------------

function guestShell_(title, bodyRows, settings, accent) {
  return (
    '<div style="background:' + C_.paper + ';padding:20px 8px;font-family:Arial,Helvetica,sans-serif;color:' + C_.ink + '">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#fff">' +
    '<tr><td style="background:' + (accent || C_.blue) + ';color:#fff;padding:22px 24px"><div style="font-size:13px;letter-spacing:2px;font-weight:bold">' + esc_((settings.business_name || 'Grčki Giros').toUpperCase()) + '</div>' +
    '<div style="font-size:26px;font-weight:900;margin-top:8px;line-height:1.15">' + esc_(title) + '</div></td></tr>' +
    bodyRows +
    '<tr><td style="padding:16px 24px;background:' + C_.paper + ';font-size:13px;color:' + C_.ink2 + ';line-height:1.5">Izmena ili otkazivanje samo telefonom: <a href="tel:' + esc_(settings.phone_e164) + '" style="color:' + C_.blue + ';font-weight:bold">' + esc_(settings.phone_display) + '</a><br>' +
    esc_(settings.business_name) + ' · ' + esc_(settings.address_street) + ', ' + esc_(settings.address_city) + '</td></tr>' +
    '</table></div>'
  );
}

function numberBlock_(order, line) {
  return (
    '<tr><td style="padding:24px 24px 8px"><div style="font-size:12px;letter-spacing:1.5px;color:' + C_.ink2 + '">BROJ PORUDŽBINE</div>' +
    '<div style="font-size:60px;font-weight:900;line-height:1;margin:4px 0 8px">#' + order.publicNumber + '</div>' +
    (line ? '<div style="font-size:15px;line-height:1.5">' + line + '</div>' : '') +
    '</td></tr>'
  );
}

function statusButton_(order, settings, label) {
  return '<tr><td style="padding:8px 24px 24px"><a href="' + esc_(statusUrl_(order, settings)) + '" style="display:inline-block;background:' + C_.gold + ';color:' + C_.ink + ';font-weight:bold;text-decoration:none;padding:14px 22px;border-radius:999px">' + esc_(label || 'Pratite status porudžbine') + '</a></td></tr>';
}

function guestWhen_(order) {
  var isDelivery = order.mode === 'delivery';
  if (order.when === 'asap') return isDelivery ? 'Što pre — okvirno oko ' + order.promisedLabel : 'Što pre — spremno okvirno oko ' + order.promisedLabel;
  return 'Zakazano: ' + scheduledText_(order.scheduledDate, order.scheduledTime);
}

function customerConfirmation_(order, settings) {
  var isDelivery = order.mode === 'delivery';
  var acceptMin = toNum_(settings.accept_timeout_min, 5);
  var pay = isDelivery
    ? 'Gotovinom dostavljaču: ' + rsd_(order.total) + '. Pripremite ' + rsd_(order.cash) + (order.change ? ', kusur ' + rsd_(order.change) + '.' : '.')
    : 'Gotovinom na kasi: ' + rsd_(order.total) + '.';
  var aptFloor = aptFloorText_(order.address);
  var where = isDelivery
    ? esc_(addressLine_(order)) + (aptFloor ? ', ' + esc_(aptFloor) : '')
    : esc_(settings.business_name) + ', ' + esc_(settings.address_street) + ', ' + esc_(settings.address_city);
  var body =
    numberBlock_(order, 'Porudžbina još nije potvrđena. Lokal je potvrđuje u roku od ' + acceptMin + ' minuta — dobićete email čim je potvrdi.') +
    '<tr><td style="padding:0 24px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
    infoRow_(isDelivery ? 'Dostava na' : 'Preuzimanje', where) +
    infoRow_('Vreme', esc_(guestWhen_(order))) +
    infoRow_('Plaćanje', esc_(pay)) +
    '</table></td></tr>' +
    '<tr><td style="padding:8px 24px;border-top:1px solid ' + C_.line + '">' + linesTable_(order.lines) + '</td></tr>' +
    '<tr><td style="padding:8px 24px 12px">' + totalsTable_(order) + '</td></tr>' +
    statusButton_(order, settings);
  var text = [
    'Primili smo porudžbinu #' + order.publicNumber + '. Lokal je potvrđuje u roku od ' + acceptMin + ' minuta.',
    (isDelivery ? 'Dostava na: ' + addressLine_(order) + (aptFloor ? ', ' + aptFloor : '') : 'Preuzimanje: ' + settings.address_street + ', ' + settings.address_city),
    'Vreme: ' + guestWhen_(order),
    'Plaćanje: ' + pay,
    '',
    itemsText_(order.lines),
    '',
    'Ukupno: ' + rsd_(order.total),
    'Status: ' + statusUrl_(order, settings),
    'Izmena ili otkazivanje: ' + settings.phone_display
  ]
    .join('\n')
    .replace(/ /g, ' ');
  return { subject: 'Primili smo porudžbinu #' + order.publicNumber + ' — ' + (settings.business_name || 'Grčki Giros'), html: guestShell_('Primili smo vašu porudžbinu.', body, settings), text: text };
}

/**
 * Status emails for guests who left an email. Only moves the guest cares about:
 * NEW → CONFIRMED, → REJECTED, and the first time a pickup is READY (an undo such as
 * ZAVRŠENA → SPREMNA never tells the guest to come again). Returns a short status or '' when nothing was sent.
 */
function sendStatusEmail_(order, fromStatus, settings, firstTime) {
  if (!order.customer.email || !toBool_(settings.customer_status_emails, true)) return '';
  var isDelivery = order.mode === 'delivery';
  var cfg = schedulingConfig_();
  var eta = GG_Scheduling.etaFor(cfg, order.mode);
  var mail = null;
  if (order.status === STATUS.CONFIRMED && fromStatus === STATUS.NEW) {
    var when = order.when === 'asap'
      ? (isDelivery ? 'Stiže za oko ' + eta.min + '–' + eta.max + ' minuta.' : 'Biće spremna za oko ' + eta.min + '–' + eta.max + ' minuta.')
      : 'Zakazano: ' + scheduledText_(order.scheduledDate, order.scheduledTime) + '.';
    mail = {
      subject: 'Porudžbina #' + order.publicNumber + ' je potvrđena',
      title: 'Porudžbina je potvrđena.',
      line: esc_(when) + ' Plaćanje gotovinom' + (isDelivery ? ' dostavljaču' : ' na kasi') + ': <b>' + rsd_(order.total) + '</b>.',
      text: 'Porudžbina #' + order.publicNumber + ' je potvrđena. ' + when,
      accent: C_.olive
    };
  } else if (order.status === STATUS.REJECTED) {
    mail = {
      subject: 'Porudžbina #' + order.publicNumber + ' nije prihvaćena',
      title: 'Nažalost, porudžbina nije prihvaćena.',
      line: 'Lokal trenutno ne može da pripremi ovu porudžbinu. Ništa ne plaćate. Pozovite nas na <a href="tel:' + esc_(settings.phone_e164) + '" style="color:' + C_.blue + '"><b>' + esc_(settings.phone_display) + '</b></a> ako želite da poručite drugačije.',
      text: 'Porudžbina #' + order.publicNumber + ' nije prihvaćena. Ništa ne plaćate. Telefon: ' + settings.phone_display,
      accent: C_.tomato,
      button: 'Pogledajte porudžbinu'
    };
  } else if (order.status === STATUS.READY && !isDelivery && firstTime !== false && (fromStatus === STATUS.CONFIRMED || fromStatus === STATUS.PREPARING)) {
    mail = {
      subject: 'Porudžbina #' + order.publicNumber + ' je spremna',
      title: 'Spremno je — možete da dođete.',
      line: esc_(settings.business_name) + ', ' + esc_(settings.address_street) + '. Plaćate na kasi: <b>' + rsd_(order.total) + '</b>. Recite broj porudžbine.',
      text: 'Porudžbina #' + order.publicNumber + ' je spremna za preuzimanje: ' + settings.address_street + '. Plaćate ' + rsd_(order.total) + '.',
      accent: C_.olive
    };
  }
  if (!mail) return '';
  var html = guestShell_(mail.title, numberBlock_(order, mail.line) + statusButton_(order, settings, mail.button), settings, mail.accent);
  var res = deliverEmail_([order.customer.email], mail.subject + ' — ' + (settings.business_name || 'Grčki Giros'), html, mail.text + '\nStatus: ' + statusUrl_(order, settings), { replyTo: settings.email_public, reserve: GUEST_EMAIL_RESERVE });
  return 'kupac ' + STATUS_LABEL[order.status] + ' ' + (res.sent.length ? 'OK' : res.skipped || 'FAILED');
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
    '<tr>' + kpiCell_('Prosečna porudžbina', rsd_(s.aov), '') + kpiCell_('Odbijeno', GG_Money.formatNumber(s.cancelled), s.orders + s.cancelled ? round_(s.cancelRate, 1) + '% porudžbina' : '') + '</tr>' +
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
    '<tr><td style="padding:14px 20px;background:' + C_.paper + ';font-size:12px;color:' + C_.ink2 + '">Prihod = hrana iz porudžbina koje nisu odbijene' + (toBool_(settings.revenue_includes_delivery, false) ? ', sa dostavom' : ', bez dostave') + '. Detalji u Google Sheets tabeli (DASHBOARD).</td></tr>' +
    '</table></div>';

  var text = [
    report.title + ' — ' + report.periodLabel,
    settings.business_name,
    'Porudžbine: ' + s.orders,
    'Prihod: ' + rsd_(s.revenue),
    'Dostava: ' + s.delivery,
    'Preuzimanje: ' + s.pickup,
    'Prosečna porudžbina: ' + rsd_(s.aov),
    'Odbijeno: ' + s.cancelled,
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
