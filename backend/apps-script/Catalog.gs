/**
 * Grčki Giros — menu catalog from PRODUCTS / CATEGORIES / OPTION_GROUPS / OPTIONS.
 * Output shape is the one GG_Pricing and the website expect.
 */

function listCell_(value) {
  return splitList_(value);
}

function getCatalog_() {
  return cached_('catalog', CACHE_TTL_SEC, function () {
    var categories = readTable_(SHEETS.CATEGORIES).rows
      .map(function (r) {
        return {
          id: String(r.id || '').trim(),
          name: String(r.name || '').trim(),
          description: String(r.description || ''),
          sort: toNum_(r.sort, 0),
          active: toBool_(r.active, true)
        };
      })
      .filter(function (c) {
        return c.id && c.active;
      });

    var groups = readTable_(SHEETS.OPTION_GROUPS).rows
      .map(function (r) {
        return {
          id: String(r.id || '').trim(),
          name: String(r.name || '').trim(),
          type: String(r.type || 'multi').trim() === 'single' ? 'single' : 'multi',
          required: toBool_(r.required, false),
          min: toNum_(r.min, 0),
          max: toNum_(r.max, 0),
          display: String(r.display || 'chips').trim() || 'chips',
          hint: String(r.hint || ''),
          sort: toNum_(r.sort, 0)
        };
      })
      .filter(function (g) {
        return g.id;
      });

    var options = readTable_(SHEETS.OPTIONS).rows
      .map(function (r) {
        return {
          id: String(r.id || '').trim(),
          groupId: String(r.group_id || '').trim(),
          name: String(r.name || '').trim(),
          price: toNum_(r.price, 0),
          available: toBool_(r.available, true),
          sort: toNum_(r.sort, 0)
        };
      })
      .filter(function (o) {
        return o.id && o.groupId;
      });

    var activeCategories = {};
    categories.forEach(function (c) {
      activeCategories[c.id] = true;
    });

    var products = readTable_(SHEETS.PRODUCTS).rows
      .map(function (r) {
        return {
          id: String(r.id || '').trim(),
          categoryId: String(r.category_id || '').trim(),
          name: String(r.name || '').trim(),
          description: String(r.description || ''),
          price: toNum_(r.price, 0),
          comparePrice: toNum_(r.compare_price, 0),
          available: toBool_(r.available, true),
          delivery: toBool_(r.delivery, true),
          pickup: toBool_(r.pickup, true),
          tags: listCell_(r.tags),
          badge: String(r.badge || ''),
          groups: listCell_(r.groups),
          defaults: listCell_(r.defaults),
          pairs: listCell_(r.pairs),
          bundleHint: String(r.bundle_hint || '').trim(),
          includes: String(r.includes || ''),
          kind: String(r.kind || 'item').trim() === 'bundle' ? 'bundle' : 'item',
          image: String(r.image || '').trim(),
          art: String(r.art || '').trim(),
          sort: toNum_(r.sort, 0),
          active: toBool_(r.active, true)
        };
      })
      .filter(function (p) {
        return p.id && p.active && p.name && activeCategories[p.categoryId];
      });

    return { categories: categories, groups: groups, options: options, products: products };
  });
}

function catalogIndex_() {
  if (!MEMO_.catalogIndex) MEMO_.catalogIndex = GG_Pricing.buildIndex(getCatalog_());
  return MEMO_.catalogIndex;
}

/** Data-driven "Najčešće se naručuje uz" (written nightly by Reports.gs). */
function getRecsAuto_() {
  return cached_('recs', CACHE_TTL_SEC * 10, function () {
    var out = {};
    try {
      readTable_(SHEETS.RECS_AUTO).rows.forEach(function (r) {
        var id = String(r['Product ID'] || '').trim();
        if (id) out[id] = splitList_(r['Often With (IDs)']);
      });
    } catch (ignored) {}
    return out;
  });
}

function catalogVersion_(catalog) {
  var s = JSON.stringify(catalog);
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, s, Utilities.Charset.UTF_8);
  return bytes
    .slice(0, 6)
    .map(function (b) {
      return ('0' + (b & 0xff).toString(16)).slice(-2);
    })
    .join('');
}

/** Public payload for the website. serverNow is added per request (never cached). */
function bootstrapPayload_() {
  var body = cached_('bootstrap', CACHE_TTL_SEC, function () {
    var catalog = getCatalog_();
    var settings = publicSettings_();
    var zonesEnabled = toBool_(settings.zones_enabled, false);
    var todayIso = nowParts_().date;
    return {
      version: catalogVersion_({ c: catalog, s: settings, h: getHours_(), sp: getSpecial_() }),
      business: settings,
      hours: getHours_(),
      specialHours: getSpecial_().filter(function (s) {
        return s.active && s.date >= addDays_(todayIso, -1) && s.date <= addDays_(todayIso, 60);
      }),
      zones: zonesEnabled
        ? getZones_().map(function (z) {
            return { id: z.id, name: z.name, areas: z.areas, fee: z.fee, minOrder: deliveryMinimum_(z, settings) };
          })
        : [],
      catalog: catalog,
      recs: getRecsAuto_()
    };
  });
  var out = {};
  Object.keys(body).forEach(function (k) {
    out[k] = body[k];
  });
  out.serverNow = now_().getTime();
  return out;
}
