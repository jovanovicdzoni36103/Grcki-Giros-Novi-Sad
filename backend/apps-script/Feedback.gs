/**
 * Grčki Giros — guest feedback after a completed order.
 * Only the holder of the order's status link can rate it, only once, and only after it is ZAVRŠENA.
 */

function feedbackExists_(orderId) {
  return findRows_(SHEETS.FEEDBACK, 'Order ID', orderId).length > 0;
}

function submitFeedback_(payload) {
  var p = payload || {};
  var id = String(p.id || '').slice(0, 40);
  var token = String(p.t || '').slice(0, 64);
  if (!ORDER_ID_PATTERN.test(id) || !token) throw apiError_('BAD_REQUEST', 'Nepoznata porudžbina.');
  var v = GG_Validation.validateFeedback(p);
  if (!v.ok) {
    var field = Object.keys(v.errors)[0];
    throw apiError_('VALIDATION', v.errors[field], { field: field, fields: v.errors });
  }
  if (!hitRateLimit_('feedback:global', 60, 3600)) throw apiError_('RATE_LIMITED', 'Trenutno ne možemo da primimo ocenu. Pokušajte kasnije.');

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw apiError_('BUSY', 'Sistem je trenutno zauzet, pokušajte ponovo.');
  try {
    var rows = findRows_(SHEETS.ORDERS, 'Internal Order ID', id);
    if (!rows.length) throw apiError_('BAD_REQUEST', 'Nepoznata porudžbina.');
    var order = orderFromRow_(readRow_(SHEETS.ORDERS, rows[0]));
    if (!safeEqual_(order.statusToken, token)) throw apiError_('BAD_REQUEST', 'Nepoznata porudžbina.');
    if (order.status !== STATUS.COMPLETED) throw apiError_('BAD_REQUEST', 'Ocenu možete da ostavite kada porudžbina bude završena.');
    if (feedbackExists_(order.id)) return { saved: true, duplicate: true };
    appendObjects_(SHEETS.FEEDBACK, [
      {
        Timestamp: now_(),
        'Order ID': order.id,
        'Order Number': order.publicNumber,
        'Order Type': order.type,
        Rating: v.value.rating,
        Good: v.value.good.join(', '),
        Improve: v.value.improve.join(', '),
        Comment: v.value.comment,
        'Customer Name': order.customer.name,
        'Created At': isoLocal_()
      }
    ]);
    CacheService.getScriptCache().remove('st:' + order.id);
    log_('INFO', 'feedback.submit', 'OK', '#' + order.publicNumber + ': ' + v.value.rating + '/5', { orderId: order.id });
    return { saved: true };
  } finally {
    lock.releaseLock();
  }
}
