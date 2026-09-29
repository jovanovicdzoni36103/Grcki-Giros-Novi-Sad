/**
 * Grčki Giros — abuse protection: honeypot, fill-time, rate limits, idempotency.
 * Apps Script exposes neither the client IP nor the Origin header, so limits are per phone and global.
 */

// A returning guest with remembered details can honestly order in ~2 s; bots post in well under a second.
var MIN_FILL_MS = 1200;

/**
 * Bots fill hidden fields and submit instantly. Rejected with a neutral message.
 * The fill time is a duration measured in the browser (performance.now), so a wrong clock on the
 * guest's phone can never make a real order look like a bot.
 */
function checkBot_(meta) {
  var m = meta || {};
  if (m.hp) throw apiError_('BAD_REQUEST', 'Zahtev nije ispravan.');
  var elapsed = toNum_(m.elapsedMs, -1);
  if (elapsed >= 0 && elapsed < MIN_FILL_MS) throw apiError_('BAD_REQUEST', 'Zahtev nije ispravan.');
}

/** Fixed-window counter in CacheService. Returns false when the limit is exceeded. */
function hitRateLimit_(key, limit, windowSec) {
  if (!limit) return true;
  var cache = CacheService.getScriptCache();
  var bucket = Math.floor(now_().getTime() / (windowSec * 1000));
  var cacheKey = 'rl:' + key + ':' + bucket;
  var count = toNum_(cache.get(cacheKey), 0) + 1;
  cache.put(cacheKey, String(count), windowSec + 5);
  return count <= limit;
}

function enforceOrderRateLimits_(phoneE164, settings) {
  var perPhone = toNum_(settings.rate_limit_phone_count, 3);
  var windowMin = toNum_(settings.rate_limit_phone_window_min, 10);
  if (!hitRateLimit_('phone:' + phoneE164, perPhone, windowMin * 60)) {
    throw apiError_('RATE_LIMITED', 'Sa ovog broja je upravo stiglo nekoliko porudžbina. Ako nešto nije u redu, pozovite nas na ' + settings.phone_display + '.');
  }
  if (!hitRateLimit_('global', toNum_(settings.rate_limit_global_per_min, 20), 60)) {
    throw apiError_('RATE_LIMITED', 'Trenutno primamo mnogo porudžbina. Pokušajte ponovo za minut ili nas pozovite na ' + settings.phone_display + '.');
  }
}

function validRequestId_(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(id);
}

function idempotencyGet_(requestId) {
  try {
    var hit = CacheService.getScriptCache().get('idem:' + requestId);
    return hit ? JSON.parse(hit) : null;
  } catch (ignored) {
    return null;
  }
}

function idempotencyPut_(requestId, response) {
  try {
    CacheService.getScriptCache().put('idem:' + requestId, JSON.stringify(response), IDEMPOTENCY_TTL_SEC);
  } catch (ignored) {}
}

/**
 * Runs a form submit once per requestId. Check-and-claim happens under the script lock, so a double click or a
 * retry racing the first copy never stores the message or sends the email twice: a copy that arrives while the
 * first still runs gets BUSY, a later one gets the first copy's response. A failed run frees the id for a retry.
 */
function onceForRequest_(scope, requestId, run) {
  if (!validRequestId_(requestId)) return run();
  var key = scope + ':' + requestId;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw apiError_('BUSY', 'Sistem je trenutno zauzet, pokušajte ponovo.');
  try {
    var prior = idempotencyGet_(key);
    if (prior && prior.pending) throw apiError_('BUSY', 'Već šaljemo ovu poruku. Sačekajte nekoliko sekundi.');
    if (prior) return prior;
    idempotencyPut_(key, { pending: true });
  } finally {
    lock.releaseLock();
  }
  try {
    var response = run();
    idempotencyPut_(key, response);
    return response;
  } catch (err) {
    try {
      CacheService.getScriptCache().remove('idem:' + key);
    } catch (ignored) {}
    throw err;
  }
}

/** Keyed hash for secrets stored in Script Properties (PIN). */
function sha256Hex_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)
    .map(function (b) {
      return ('0' + (b & 0xff).toString(16)).slice(-2);
    })
    .join('');
}

function hmacB64_(message, secret) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(message, secret)).replace(/=+$/, '');
}

function secret_(name) {
  var props = PropertiesService.getScriptProperties();
  var value = props.getProperty(name);
  if (!value) {
    value = randomHex_(48);
    props.setProperty(name, value);
  }
  return value;
}

/** Constant-time string comparison. */
function safeEqual_(a, b) {
  var x = String(a);
  var y = String(b);
  if (x.length !== y.length) return false;
  var diff = 0;
  for (var i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}
