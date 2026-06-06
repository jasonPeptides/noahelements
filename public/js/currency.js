/* Noah Elements — region / currency.
 * Currency follows the visitor's country (Shopify Markets), independent of the
 * language toggle. Auto-detects on first visit, with a selector to override.
 * The chosen country is passed into every Shopify @inContext query (see the
 * langCtx helpers in catalog.js / product.js / shopify.js, which read it here).
 */
(function () {
  'use strict';
  var KEY = 'noah_country';
  var DEFAULT = 'GB';

  function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function write(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  // Public accessor used by the query wrappers.
  window.NoahLocale = window.NoahLocale || {};
  window.NoahLocale.country = function () { return (read() || DEFAULT).toUpperCase(); };

  var countries = [];   // [{isoCode, name, currency:{isoCode,symbol}}]

  async function gql(q, v) {
    if (window.NoahCart && window.NoahCart.gql) return window.NoahCart.gql(q, v);
    var r = await fetch('/api/shopify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q, variables: v || {} }) });
    var j = await r.json(); if (j.errors) throw new Error(j.errors[0].message); return j.data;
  }

  function currentLabel() {
    var c = window.NoahLocale.country();
    var found = countries.find(function (x) { return x.isoCode === c; });
    if (found) return found.currency.isoCode + ' ' + found.currency.symbol;
    return c;
  }

  function injectSelector() {
    document.querySelectorAll('.footer-bottom').forEach(function (bar) {
      if (bar.querySelector('.currency-select-wrap')) return;
      var wrap = document.createElement('div');
      wrap.className = 'currency-select-wrap';
      var sel = document.createElement('select');
      sel.className = 'currency-select';
      sel.setAttribute('aria-label', 'Region and currency');
      sel.innerHTML = countries.map(function (c) {
        return '<option value="' + c.isoCode + '">' + c.name + ' · ' + c.currency.isoCode + ' ' + c.currency.symbol + '</option>';
      }).join('');
      sel.value = window.NoahLocale.country();
      sel.addEventListener('change', function () {
        write(sel.value);
        // keep any other selectors in sync
        document.querySelectorAll('.currency-select').forEach(function (s) { s.value = sel.value; });
        // tell Shopify-driven views (grids, product, cart) to re-price
        window.dispatchEvent(new CustomEvent('noah:locale', { detail: { country: sel.value } }));
      });
      wrap.appendChild(sel);
      bar.insertBefore(wrap, bar.firstChild);
    });
  }

  async function init() {
    try {
      var data = await gql('{ localization { availableCountries { isoCode name currency { isoCode symbol } } } }');
      countries = (data && data.localization && data.localization.availableCountries) || [];
    } catch (e) { countries = []; }
    if (!countries.length) return; // markets not configured → stay on store default

    var saved = read();
    if (!saved) {
      // Auto-detect from the server's geo header on first visit.
      try {
        var geo = await fetch('/api/geo').then(function (r) { return r.json(); });
        var detected = geo && geo.country;
        var ok = detected && countries.some(function (c) { return c.isoCode === detected; });
        write(ok ? detected : DEFAULT);
        if (ok) window.dispatchEvent(new CustomEvent('noah:locale', { detail: { country: detected } }));
      } catch (e) { write(DEFAULT); }
    }
    injectSelector();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
