// GENERATED from src/scripts/shared/money.cjs by tools/gas-sync.mjs — do not edit here.
/*
 * Grčki Giros — money helpers (whole dinars only; cash business, no decimals).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GG_Money = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var NBSP = ' ';

  /** 1850 -> "1.850" (Serbian thousands separator). */
  function formatNumber(value) {
    var n = Math.round(Number(value) || 0);
    var sign = n < 0 ? '-' : '';
    var s = String(Math.abs(n));
    var out = '';
    while (s.length > 3) {
      out = '.' + s.slice(-3) + out;
      s = s.slice(0, -3);
    }
    return sign + s + out;
  }

  /** 1850 -> "1.850 RSD" with a non-breaking space. */
  function formatRSD(value) {
    return formatNumber(value) + NBSP + 'RSD';
  }

  function roundUp(value, step) {
    return Math.ceil(value / step) * step;
  }

  /**
   * Quick "Plaćam sa" amounts: realistic banknote totals above the bill, at most three.
   * 1280 -> [1500, 2000, 5000]; 1850 -> [2000, 5000]; 620 -> [700, 1000, 2000].
   */
  function cashSuggestions(total) {
    var t = Math.max(0, Math.round(Number(total) || 0));
    if (!t) return [];
    var candidates = [];
    if (t < 1000) candidates.push(roundUp(t, 100));
    candidates.push(roundUp(t, 500), roundUp(t, 1000), 1000, 2000, 5000);
    if (t >= 5000) candidates.push(roundUp(t, 5000), 10000);
    var seen = {};
    return candidates
      .filter(function (c) {
        if (c <= t || seen[c]) return false;
        seen[c] = true;
        return true;
      })
      .sort(function (a, b) {
        return a - b;
      })
      .slice(0, 3);
  }

  function change(total, cash) {
    return Math.max(0, Math.round(Number(cash) || 0) - Math.round(Number(total) || 0));
  }

  return {
    NBSP: NBSP,
    formatNumber: formatNumber,
    formatRSD: formatRSD,
    cashSuggestions: cashSuggestions,
    change: change
  };
});
