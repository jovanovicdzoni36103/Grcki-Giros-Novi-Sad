/**
 * Grčki Giros — order numbering.
 *
 * PUBLIC_NO: what the guest and the shop see (#1001, #1002, …). Starts at order_number_start and only grows.
 * ORDER_SEQ: global sequence, never resets; it makes the internal ID unique by construction.
 * Both live in Script Properties and are only touched while the script lock is held.
 */

function nextOrderNumber_(lock, startNumber) {
  if (!lock || !lock.hasLock()) throw new Error('nextOrderNumber_ called without holding the script lock');
  var start = Math.max(1, Math.floor(startNumber || 1001));
  var props = PropertiesService.getScriptProperties();
  var seq = toNum_(props.getProperty('ORDER_SEQ'), 0) + 1;
  var last = toNum_(props.getProperty('PUBLIC_NO'), 0);
  var next = last < start ? start : last + 1;
  props.setProperties({ ORDER_SEQ: String(seq), PUBLIC_NO: String(next) });
  return { publicNumber: next, seq: seq };
}

/** GG-20260923-1042-00A4: business date, public number, global sequence in hex. */
function buildOrderId_(businessDate, publicNumber, seq) {
  var hex = seq.toString(16).toUpperCase();
  while (hex.length < 4) hex = '0' + hex;
  return 'GG-' + businessDate.replace(/-/g, '') + '-' + publicNumber + '-' + hex;
}

var ORDER_ID_PATTERN = /^GG-\d{8}-\d{1,7}-[0-9A-F]{4,}$/;

/** Admin: the next order will get `nextNumber` (never lower than a number already used). */
function setNextOrderNumber_(nextNumber) {
  var n = Math.floor(Number(nextNumber));
  if (!(n >= 1 && n <= 9999999)) throw new Error('Broj mora biti između 1 i 9999999.');
  var lock = LockService.getScriptLock();
  lock.waitLock(LOCK_WAIT_MS);
  try {
    var last = toNum_(PropertiesService.getScriptProperties().getProperty('PUBLIC_NO'), 0);
    if (n <= last) throw new Error('Broj ' + n + ' je već iskorišćen (poslednji je ' + last + '). Izaberite veći.');
    PropertiesService.getScriptProperties().setProperty('PUBLIC_NO', String(n - 1));
  } finally {
    lock.releaseLock();
  }
  log_('INFO', 'setNextOrderNumber', 'OK', 'Sledeći broj porudžbine: ' + n);
}

/**
 * Before go-live only: after the test orders are deleted from ORDERS, the next order gets
 * order_number_start again. Refuses while any order row exists, so a number can never repeat.
 */
function resetOrderCounter_() {
  var rows = readTable_(SHEETS.ORDERS).rows.length;
  if (rows > 0) throw new Error('U listu ORDERS još ima ' + rows + ' porudžbina. Brojač se vraća samo kada je list prazan (posle brisanja test porudžbina).');
  var lock = LockService.getScriptLock();
  lock.waitLock(LOCK_WAIT_MS);
  try {
    PropertiesService.getScriptProperties().setProperty('PUBLIC_NO', '0');
  } finally {
    lock.releaseLock();
  }
  log_('INFO', 'resetOrderCounter', 'OK', 'Brojač vraćen, sledeća porudžbina dobija ' + toNum_(getSettings_().order_number_start, 1001));
  return toNum_(getSettings_().order_number_start, 1001);
}

function counterState_() {
  var props = PropertiesService.getScriptProperties();
  return { seq: toNum_(props.getProperty('ORDER_SEQ'), 0), lastPublic: toNum_(props.getProperty('PUBLIC_NO'), 0) };
}
