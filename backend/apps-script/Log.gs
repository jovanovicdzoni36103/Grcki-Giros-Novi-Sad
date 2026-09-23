/**
 * Grčki Giros — SYSTEM_LOG / ERROR_LOG.
 * Logging must never break the caller: every write is wrapped.
 */

var LOG_CONTEXT_ = { requestId: '' };

function setLogContext_(requestId) {
  LOG_CONTEXT_.requestId = requestId || '';
}

/**
 * severity: DEBUG | INFO | WARN | ERROR | CRITICAL
 * extra: { orderId, durationMs, retry, details }
 */
function log_(severity, fn, status, message, extra) {
  var e = extra || {};
  try {
    appendObjects_(SHEETS.SYSTEM_LOG, [
      {
        Timestamp: now_(),
        'Request ID': LOG_CONTEXT_.requestId,
        Severity: severity,
        Function: fn,
        Status: status,
        Message: String(message || '').slice(0, 500),
        'Order ID': e.orderId || '',
        'Duration ms': e.durationMs === undefined ? '' : e.durationMs,
        Retry: e.retry || 0,
        Details: e.details ? safeJson_(e.details).slice(0, 2000) : ''
      }
    ]);
  } catch (ignored) {
    // The log sheet itself failing must not take the order down with it.
  }
}

function logError_(fn, error, extra) {
  var e = extra || {};
  var message = error && error.message ? error.message : String(error);
  try {
    appendObjects_(SHEETS.ERROR_LOG, [
      {
        Timestamp: now_(),
        'Request ID': LOG_CONTEXT_.requestId,
        Severity: e.severity || 'ERROR',
        Function: fn,
        Error: message.slice(0, 500),
        Stack: error && error.stack ? String(error.stack).slice(0, 2000) : '',
        'Order ID': e.orderId || '',
        Context: e.context ? safeJson_(e.context).slice(0, 4000) : ''
      }
    ]);
  } catch (ignored) {}
  log_(e.severity || 'ERROR', fn, 'FAIL', message, { orderId: e.orderId, durationMs: e.durationMs, retry: e.retry });
}

function safeJson_(value) {
  try {
    return JSON.stringify(value);
  } catch (err) {
    return String(value);
  }
}

/** Keeps the log sheets bounded (maintenance). */
function trimLogs_() {
  [SHEETS.SYSTEM_LOG, SHEETS.ERROR_LOG].forEach(function (name) {
    var sh = sheet_(name);
    var dataRows = sh.getLastRow() - 1;
    if (dataRows > LOG_KEEP_ROWS) sh.deleteRows(2, dataRows - LOG_KEEP_ROWS);
  });
}
