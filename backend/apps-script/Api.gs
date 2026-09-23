/**
 * Grčki Giros — Web App entry points and router.
 * GET  ?action=bootstrap | order.status
 * POST text/plain JSON { action, payload } (text/plain avoids a CORS preflight)
 */

var GET_ROUTES = {
  bootstrap: function () {
    return bootstrapPayload_();
  },
  'order.status': function (params) {
    return orderStatus_(params);
  },
  ping: function () {
    return { pong: true, serverNow: now_().getTime() };
  }
};

var POST_ROUTES = {
  'order.create': function (payload, ctx) {
    return createOrder_(payload, ctx);
  },
  'contact.submit': function (payload, ctx) {
    return submitContact_(payload, ctx);
  },
  'jobs.submit': function (payload, ctx) {
    return submitJob_(payload, ctx);
  },
  'panel.login': function (payload) {
    return panelLogin_(payload);
  },
  'panel.orders': function (payload) {
    return panelOrders_(payload);
  },
  'panel.status': function (payload) {
    return panelStatus_(payload);
  },
  'panel.availability': function (payload) {
    return panelAvailability_(payload);
  },
  'panel.settings': function (payload) {
    return panelSettings_(payload);
  }
};

function doGet(e) {
  return handleRequest_('GET', e);
}

function doPost(e) {
  return handleRequest_('POST', e);
}

/** Error that carries a public, customer-facing message. */
function apiError_(code, message, extra) {
  var err = new Error(message);
  err.code = code;
  err.publicMessage = message;
  err.expected = true;
  if (extra) {
    Object.keys(extra).forEach(function (k) {
      err[k] = extra[k];
    });
  }
  return err;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function parseBody_(e) {
  var raw = e && e.postData ? e.postData.contents : '';
  if (!raw) throw apiError_('BAD_REQUEST', 'Prazan zahtev.');
  if (raw.length > MAX_UPLOAD_BODY_BYTES) throw apiError_('BAD_REQUEST', 'Zahtev je prevelik.');
  var body;
  try {
    body = JSON.parse(raw);
  } catch (err) {
    throw apiError_('BAD_REQUEST', 'Zahtev nije ispravan.');
  }
  if (!body || typeof body !== 'object' || typeof body.action !== 'string') throw apiError_('BAD_REQUEST', 'Zahtev nije ispravan.');
  if (body.action !== 'jobs.submit' && raw.length > MAX_BODY_BYTES) throw apiError_('BAD_REQUEST', 'Zahtev je prevelik.');
  return body;
}

function fallbackMessage_() {
  var phone = '';
  try {
    phone = getSettings_().phone_display;
  } catch (ignored) {
    phone = DEFAULT_SETTINGS.phone_display;
  }
  return 'Porudžbina trenutno nije mogla da bude poslata. Molimo pokušajte ponovo ili pozovite nas na ' + phone + '.';
}

function handleRequest_(method, e) {
  var started = Date.now();
  var requestId = newRequestId_();
  setLogContext_(requestId);
  var action = '';
  try {
    var route;
    var input;
    if (method === 'GET') {
      input = (e && e.parameter) || {};
      action = String(input.action || '');
      route = GET_ROUTES[action];
    } else {
      var body = parseBody_(e);
      action = body.action;
      input = body.payload || {};
      route = POST_ROUTES[action];
    }
    if (!route) throw apiError_('BAD_REQUEST', 'Nepoznata akcija.');
    var data = route(input, { requestId: requestId, method: method, started: started });
    return json_({ ok: true, data: data, requestId: requestId });
  } catch (err) {
    return json_(errorEnvelope_(err, action, requestId, started));
  }
}

function errorEnvelope_(err, action, requestId, started) {
  var duration = Date.now() - started;
  if (err && err.expected) {
    var severity = err.code === 'VALIDATION' || err.code === 'CLOSED' || err.code === 'SLOT_UNAVAILABLE' ? 'INFO' : 'WARN';
    log_(severity, action || 'request', 'REJECTED', err.code + ': ' + err.publicMessage, {
      durationMs: duration,
      details: err.fields ? { fields: err.fields } : undefined
    });
    var error = { code: err.code, message: err.publicMessage };
    if (err.field) error.field = err.field;
    if (err.fields) error.fields = err.fields;
    if (err.data) error.data = err.data;
    return { ok: false, error: error, requestId: requestId };
  }
  logError_(action || 'request', err, { durationMs: duration, severity: 'ERROR' });
  var message = action === 'order.create' ? fallbackMessage_() : 'Došlo je do greške na našoj strani. Pokušajte ponovo za minut.';
  return { ok: false, error: { code: 'SERVER_ERROR', message: message }, requestId: requestId };
}
