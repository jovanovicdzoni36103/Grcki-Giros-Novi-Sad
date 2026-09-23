/*
 * Grčki Giros — pricing and cart core.
 * Shared by the browser bundle, Node tests and Google Apps Script (Shared_Pricing.gs).
 * The server always recomputes with this module against its own catalog; client prices are never trusted.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GG_Pricing = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function byId(list) {
    var map = {};
    (list || []).forEach(function (x) {
      map[x.id] = x;
    });
    return map;
  }

  function sortBySort(a, b) {
    return (a.sort || 0) - (b.sort || 0);
  }

  function buildIndex(catalog) {
    var c = catalog || {};
    var optionsByGroup = {};
    (c.options || []).forEach(function (o) {
      (optionsByGroup[o.groupId] = optionsByGroup[o.groupId] || []).push(o);
    });
    Object.keys(optionsByGroup).forEach(function (k) {
      optionsByGroup[k].sort(sortBySort);
    });
    return {
      categories: byId(c.categories),
      products: byId(c.products),
      groups: byId(c.groups),
      options: byId(c.options),
      optionsByGroup: optionsByGroup,
      catalog: c
    };
  }

  function isAvailable(x) {
    return x && x.available !== false && x.active !== false;
  }

  function productAllowedFor(product, mode) {
    if (mode === 'delivery') return product.delivery !== false;
    if (mode === 'pickup') return product.pickup !== false;
    return true;
  }

  function lineKey(line) {
    var opts = (line.options || []).slice().sort().join(',');
    return line.productId + '|' + opts + '|' + String(line.note || '').trim();
  }

  function err(code, message, extra) {
    var e = { code: code, message: message };
    if (extra) {
      Object.keys(extra).forEach(function (k) {
        e[k] = extra[k];
      });
    }
    return e;
  }

  /**
   * Prices and validates one cart line.
   * Returns { ok, errors, product, qty, unitPrice, lineTotal, selections, summary, removedSummary }.
   */
  function priceLine(index, line, ctx) {
    var context = ctx || {};
    var maxQty = context.maxQty || 20;
    var errors = [];
    var product = index.products[line && line.productId];
    if (!product || product.active === false) {
      return { ok: false, errors: [err('ITEM_UNAVAILABLE', 'Ovaj proizvod više nije u ponudi.', { productId: line && line.productId })] };
    }
    // Neutral wording: product names have every grammatical gender (Fanta, pomfrit, Giros + sok).
    if (product.available === false) {
      errors.push(err('ITEM_UNAVAILABLE', 'Trenutno nema: ' + product.name + '.', { productId: product.id }));
    }
    if (context.mode && !productAllowedFor(product, context.mode)) {
      errors.push(
        err('ITEM_UNAVAILABLE', (context.mode === 'delivery' ? 'Ne šaljemo u dostavu: ' : 'Nije dostupno za preuzimanje: ') + product.name + '.', {
          productId: product.id
        })
      );
    }
    var qty = Number(line.qty);
    if (!(qty >= 1 && qty <= maxQty && Math.floor(qty) === qty)) {
      errors.push(err('VALIDATION', 'Količina mora biti između 1 i ' + maxQty + '.', { productId: product.id }));
      qty = Math.max(1, Math.min(maxQty, Math.floor(qty) || 1));
    }

    var chosen = {};
    var seen = {};
    (line.options || []).forEach(function (optId) {
      if (seen[optId]) return;
      seen[optId] = true;
      var opt = index.options[optId];
      if (!opt || (product.groups || []).indexOf(opt.groupId) === -1) {
        errors.push(err('VALIDATION', 'Izabrana opcija ne postoji za ' + product.name + '.', { productId: product.id, optionId: optId }));
        return;
      }
      if (!isAvailable(opt)) {
        errors.push(err('ITEM_UNAVAILABLE', 'Trenutno nema: ' + opt.name + ' (' + product.name + ').', { productId: product.id, optionId: optId }));
      }
      (chosen[opt.groupId] = chosen[opt.groupId] || []).push(opt);
    });

    var defaults = {};
    (product.defaults || []).forEach(function (id) {
      defaults[id] = true;
    });

    var optionsTotal = 0;
    var selections = [];
    var summaryParts = [];
    var removedParts = [];
    var groupIds = (product.groups || []).slice().sort(function (a, b) {
      return ((index.groups[a] || {}).sort || 0) - ((index.groups[b] || {}).sort || 0);
    });

    groupIds.forEach(function (gid) {
      var group = index.groups[gid];
      if (!group) return;
      var picked = (chosen[gid] || []).slice().sort(sortBySort);
      var count = picked.length;
      if (group.type === 'single') {
        if (count > 1) errors.push(err('VALIDATION', 'Za „' + group.name + '“ može samo jedan izbor.', { productId: product.id, groupId: gid }));
        if (group.required && count === 0) errors.push(err('VALIDATION', 'Izaberi: ' + group.name.toLowerCase() + '.', { productId: product.id, groupId: gid }));
      } else {
        var min = group.required ? Math.max(1, group.min || 0) : group.min || 0;
        if (count < min) errors.push(err('VALIDATION', 'Izaberi bar ' + min + ': ' + group.name.toLowerCase() + '.', { productId: product.id, groupId: gid }));
        if (group.max && count > group.max) errors.push(err('VALIDATION', 'Najviše ' + group.max + ': ' + group.name.toLowerCase() + '.', { productId: product.id, groupId: gid }));
      }
      picked.forEach(function (o) {
        optionsTotal += Number(o.price) || 0;
      });
      var removed = (index.optionsByGroup[gid] || []).filter(function (o) {
        return defaults[o.id] && !seen[o.id];
      });
      selections.push({
        groupId: gid,
        groupName: group.name,
        type: group.type,
        display: group.display,
        chosen: picked.map(function (o) {
          return { id: o.id, name: o.name, price: Number(o.price) || 0 };
        }),
        removed: removed.map(function (o) {
          return { id: o.id, name: o.name };
        })
      });
      if (group.display === 'info' || group.display === 'toggle') {
        // Informational groups (pita) and toggles (pomfrit u piti) only show up when they differ from the default.
      } else if (picked.length) {
        summaryParts.push(
          picked
            .map(function (o) {
              return o.price ? o.name + ' +' + o.price : o.name;
            })
            .join(', ')
        );
      }
      removed.forEach(function (o) {
        removedParts.push(o.name.toLowerCase());
      });
    });

    var unitPrice = (Number(product.price) || 0) + optionsTotal;
    var summary = summaryParts.join(' · ');
    var removedSummary = removedParts.length ? 'BEZ: ' + removedParts.join(', ') : '';
    return {
      ok: errors.length === 0,
      errors: errors,
      product: product,
      productId: product.id,
      qty: qty,
      options: Object.keys(seen),
      note: String(line.note || ''),
      unitPrice: unitPrice,
      optionsTotal: optionsTotal,
      lineTotal: unitPrice * qty,
      selections: selections,
      summary: summary,
      removedSummary: removedSummary,
      key: lineKey(line)
    };
  }

  function computeDeliveryFee(subtotal, ctx) {
    if (ctx.mode !== 'delivery') return { fee: 0, external: false };
    if (ctx.feeMode === 'agency') return { fee: 0, external: true };
    var threshold = Number(ctx.freeThreshold) || 0;
    if (threshold > 0 && subtotal >= threshold) return { fee: 0, external: false, free: true };
    var fee = ctx.zoneFee !== undefined && ctx.zoneFee !== null && ctx.zoneFee !== '' ? Number(ctx.zoneFee) : Number(ctx.defaultFee);
    return { fee: isFinite(fee) ? Math.max(0, fee) : 0, external: false };
  }

  /**
   * Prices the whole cart. ctx: { mode, feeMode, defaultFee, zoneFee, freeThreshold, minOrder, maxLines, maxQty }.
   */
  function computeCart(index, lines, ctx) {
    var context = ctx || {};
    var errors = [];
    var list = lines || [];
    if (!list.length) errors.push(err('VALIDATION', 'Korpa je prazna.', { field: 'items' }));
    if (context.maxLines && list.length > context.maxLines) {
      errors.push(err('VALIDATION', 'Previše stavki u jednoj porudžbini. Pozovite nas za veće porudžbine.', { field: 'items' }));
    }
    var priced = list.map(function (line) {
      var p = priceLine(index, line, context);
      p.errors.forEach(function (e) {
        errors.push(e);
      });
      return p;
    });
    var subtotal = priced.reduce(function (sum, p) {
      return sum + (p.lineTotal || 0);
    }, 0);
    var itemCount = priced.reduce(function (sum, p) {
      return sum + (p.qty || 0);
    }, 0);
    var delivery = computeDeliveryFee(subtotal, context);
    var minOrder = Number(context.minOrder) || 0;
    var shortfall = minOrder > 0 && subtotal < minOrder ? minOrder - subtotal : 0;
    if (shortfall > 0) {
      errors.push(err('VALIDATION', 'Minimalna porudžbina je ' + minOrder + ' RSD.', { field: 'items', shortfall: shortfall }));
    }
    return {
      ok: errors.length === 0,
      errors: errors,
      lines: priced,
      subtotal: subtotal,
      deliveryFee: delivery.fee,
      deliveryExternal: delivery.external,
      deliveryFree: !!delivery.free,
      total: subtotal + delivery.fee,
      itemCount: itemCount,
      minOrderShortfall: shortfall
    };
  }

  /** Default option ids for a product, filtered to what is currently available. */
  function defaultOptions(index, product) {
    return (product.defaults || []).filter(function (id) {
      var o = index.options[id];
      return o && isAvailable(o) && (product.groups || []).indexOf(o.groupId) !== -1;
    });
  }

  function hasOptions(product) {
    return !!(product.groups && product.groups.length);
  }

  function matchesToken(index, line, token) {
    var product = index.products[line.productId];
    if (!product || product.kind === 'bundle') return false;
    var parts = token.split(':');
    if (parts[0] === 'cat') return product.categoryId === parts[1];
    if (parts[0] === 'p') return product.id === parts[1];
    return false;
  }

  /** "Povoljnije u paketu": bundles whose hint rule is covered by loose cart lines. */
  function bundleHints(index, lines) {
    var hints = [];
    Object.keys(index.products).forEach(function (id) {
      var bundle = index.products[id];
      if (bundle.kind !== 'bundle' || !bundle.bundleHint || !isAvailable(bundle)) return;
      var tokens = String(bundle.bundleHint).split('+').map(function (t) {
        return t.trim();
      });
      var separate = 0;
      var covered = tokens.every(function (token) {
        var matching = (lines || []).filter(function (l) {
          return matchesToken(index, l, token);
        });
        if (!matching.length) return false;
        var cheapest = Math.min.apply(
          null,
          matching.map(function (l) {
            return l.unitPrice !== undefined ? l.unitPrice : Number(index.products[l.productId].price) || 0;
          })
        );
        separate += cheapest;
        return true;
      });
      var saving = separate - (Number(bundle.price) || 0);
      if (covered && saving > 0) hints.push({ productId: bundle.id, name: bundle.name, saving: saving });
    });
    return hints.sort(function (a, b) {
      return b.saving - a.saving;
    });
  }

  /**
   * "Ide uz ovo" / "Najčešće se naručuje uz": manual pairs first, then data-driven recs, excluding what is already in the cart.
   */
  function recommendations(index, productIds, autoRecs, limit) {
    var inCart = {};
    productIds.forEach(function (id) {
      inCart[id] = true;
    });
    var scored = {};
    var order = [];
    function add(id, source, weight) {
      var p = index.products[id];
      if (!p || inCart[id] || !isAvailable(p) || p.kind === 'bundle') return;
      if (!scored[id]) {
        scored[id] = { productId: id, source: source, score: 0 };
        order.push(id);
      }
      scored[id].score += weight;
    }
    productIds.forEach(function (pid) {
      var p = index.products[pid];
      (p && p.pairs ? p.pairs : []).forEach(function (id, i) {
        add(id, 'pairs', 10 - i);
      });
      ((autoRecs && autoRecs[pid]) || []).forEach(function (id, i) {
        add(id, 'data', 5 - i);
      });
    });
    return order
      .map(function (id) {
        return scored[id];
      })
      .sort(function (a, b) {
        return b.score - a.score;
      })
      .slice(0, limit || 3);
  }

  return {
    buildIndex: buildIndex,
    priceLine: priceLine,
    computeCart: computeCart,
    computeDeliveryFee: computeDeliveryFee,
    defaultOptions: defaultOptions,
    hasOptions: hasOptions,
    bundleHints: bundleHints,
    recommendations: recommendations,
    lineKey: lineKey,
    productAllowedFor: productAllowedFor
  };
});
