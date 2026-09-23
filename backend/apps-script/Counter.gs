/**
 * Grčki Giros — order numbering.
 *
 * PUBLIC_NO: what the guest sees, 1..order_number_max (100), then back to 1.
 * ORDER_SEQ: global sequence, never resets; it makes the internal ID unique by construction.
 * Both live in Script Properties and are only touched while the script lock is held.
 */

function nextOrderNumber_(lock, maxNumber) {
  if (!lock || !lock.hasLock()) throw new Error('nextOrderNumber_ called without holding the script lock');
  var max = Math.max(1, Math.floor(maxNumber || 100));
  var props = PropertiesService.getScriptProperties();
  var seq = toNum_(props.getProperty('ORDER_SEQ'), 0) + 1;
  var last = toNum_(props.getProperty('PUBLIC_NO'), 0);
  var next = last >= max || last < 1 ? 1 : last + 1;
  props.setProperties({ ORDER_SEQ: String(seq), PUBLIC_NO: String(next) });
  return { publicNumber: next, seq: seq };
}

/** GG-20260923-37-00A4: business date, public number, global sequence in hex. */
function buildOrderId_(businessDate, publicNumber, seq) {
  var hex = seq.toString(16).toUpperCase();
  while (hex.length < 4) hex = '0' + hex;
  return 'GG-' + businessDate.replace(/-/g, '') + '-' + publicNumber + '-' + hex;
}

/** Admin: the next order will get `nextNumber`. The global sequence is never touched. */
function setNextOrderNumber_(nextNumber) {
  var max = toNum_(getSettings_().order_number_max, 100);
  var n = Math.floor(Number(nextNumber));
  if (!(n >= 1 && n <= max)) throw new Error('Broj mora biti između 1 i ' + max + '.');
  var lock = LockService.getScriptLock();
  lock.waitLock(LOCK_WAIT_MS);
  try {
    PropertiesService.getScriptProperties().setProperty('PUBLIC_NO', String(n === 1 ? max : n - 1));
  } finally {
    lock.releaseLock();
  }
  log_('INFO', 'setNextOrderNumber', 'OK', 'Sledeći broj porudžbine: ' + n);
}

function counterState_() {
  var props = PropertiesService.getScriptProperties();
  return { seq: toNum_(props.getProperty('ORDER_SEQ'), 0), lastPublic: toNum_(props.getProperty('PUBLIC_NO'), 0) };
}
