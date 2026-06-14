/* Noah Elements — dynamic catalog rendering.
 * Populates product grids from the Shopify Storefront API:
 *   - [data-shopify-collection="<handle>"]  → that collection's products
 *   - [data-shopify-featured]               → latest store products
 * Cards reuse the site's existing classes and wire add-to-cart to the real
 * variant ID. Gracefully handles any inventory size, including zero.
 */
(function () {
  'use strict';

  // Localisation context: language (toggle) + country (currency).
  function langCode() { return document.body.classList.contains('lang-zh') ? 'ZH_CN' : 'EN'; }
  function countryCode() { return (window.NoahLocale && window.NoahLocale.country()) || 'GB'; }
  function withLang(q) {
    if (q.indexOf('@inContext') !== -1) return q;
    return q.replace(/^query(\([^)]*\))?/, function (m) {
      return m + ' @inContext(language: ' + langCode() + ', country: ' + countryCode() + ')';
    });
  }
  function gql(q, v) { return window.NoahCart.gql(withLang(q), v); }
  function money(m) { return window.NoahCart.money(m); }

  var PRODUCT_FIELDS =
    'id title handle availableForSale ' +
    'featuredImage { url altText } ' +
    'images(first:2){ edges { node { url altText } } } ' +
    'priceRange { minVariantPrice { amount currencyCode } } ' +
    'variants(first:1){ edges { node { id availableForSale } } } ' +
    'collections(first:5){ edges { node { handle } } }';

  var Q_COLLECTION =
    'query($handle:String!,$first:Int!){ collection(handle:$handle){ id title ' +
    'products(first:$first){ edges { node { ' + PRODUCT_FIELDS + ' } } } } }';

  var Q_LATEST =
    'query($first:Int!){ products(first:$first,sortKey:CREATED_AT,reverse:true){ edges { node { ' +
    PRODUCT_FIELDS + ' } } } }';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  // Request a right-sized image from the Shopify CDN.
  function sized(url, w) {
    if (!url || url.indexOf('cdn.shopify') === -1) return url;
    return url + (url.indexOf('?') === -1 ? '?' : '&') + 'width=' + w;
  }

  var ELEMENT_LABELS = {
    fire:  { en: 'Spirit of Fire',  zh: '火之灵' },
    water: { en: 'Spirit of Water', zh: '水之灵' },
    wood:  { en: 'Spirit of Wood',  zh: '木之灵' },
    earth: { en: 'Spirit of Earth', zh: '土之灵' },
    metal: { en: 'Spirit of Metal', zh: '金之灵' },
  };

  function detectElement(p) {
    var cols = p.collections && p.collections.edges || [];
    for (var i = 0; i < cols.length; i++) {
      var h = cols[i].node.handle;
      if (ELEMENTS.indexOf(h) !== -1) return h;
    }
    return null;
  }

  function cardHTML(p, i, showLabel) {
    var variant = p.variants && p.variants.edges[0] ? p.variants.edges[0].node : null;
    var imgs = (p.images && p.images.edges || []).map(function (e) { return e.node.url; });
    var imgA = imgs[0] || (p.featuredImage && p.featuredImage.url) || '';
    var imgB = imgs[1] || imgA;
    var price = p.priceRange ? money(p.priceRange.minVariantPrice) : '';
    // Product-level availableForSale is true when ANY variant is purchasable —
    // the authoritative sold-out signal, correct for multi-variant products too.
    var soldOut = p.availableForSale === false || !variant;
    var delay = (i % 4) + 1;

    var soldOutBadge = soldOut
      ? '<span class="sold-out-badge"><span class="en-only">Sold out</span><span class="cn-only">已售罄</span></span>'
      : '';
    var imgBlock = imgA
      ? '<img class="product-img-a" src="' + esc(sized(imgA, 600)) + '" alt="' + esc(p.title) + '" loading="lazy" decoding="async">' +
        '<img class="product-img-b" src="' + esc(sized(imgB, 600)) + '" alt="" loading="lazy" decoding="async">'
      : '';

    var elementLabel = '';
    if (showLabel) {
      var element = detectElement(p);
      var lbl = element && ELEMENT_LABELS[element];
      if (lbl) {
        elementLabel =
          '<div class="product-element-label">' +
            '<span class="product-element-glyph" data-oracle="' + element + '"></span>' +
            '<span class="en-only">' + lbl.en + '</span>' +
            '<span class="cn-only">' + lbl.zh + '</span>' +
          '</div>';
      }
    }

    return '<a href="/product.html?handle=' + encodeURIComponent(p.handle) + '" class="product-card' + (soldOut ? ' is-sold-out' : '') + '" data-reveal data-delay="' + delay + '">' +
      '<div class="product-image">' + imgBlock + soldOutBadge + '</div>' +
      '<div class="product-info">' +
        elementLabel +
        '<div class="product-name">' + esc(p.title) + '</div>' +
        '<div class="product-price">' + esc(price) + '</div>' +
      '</div>' +
    '</a>';
  }

  function renderEmpty(grid) {
    grid.innerHTML =
      '<p class="catalog-empty">' +
        '<span class="en-only">No products available yet — check back soon.</span>' +
        '<span class="cn-only">暂无商品，敬请期待。</span>' +
      '</p>';
  }

  function renderError(grid) {
    grid.innerHTML =
      '<p class="catalog-empty">' +
        '<span class="en-only">Unable to load products right now.</span>' +
        '<span class="cn-only">暂时无法加载商品。</span>' +
      '</p>';
  }

  var ELEMENTS = ['fire', 'water', 'wood', 'earth', 'metal'];

  function paint(grid, products, showLabel) {
    if (!products || !products.length) { renderEmpty(grid); return; }
    grid.innerHTML = products.map(function (p, i) { return cardHTML(p, i, showLabel); }).join('');
    if (window.OracleGlyphs && window.OracleGlyphs.paint) window.OracleGlyphs.paint(grid);
  }

  async function loadCollection(grid, handle, first) {
    try {
      var data = await gql(Q_COLLECTION, { handle: handle, first: first || 24 });
      var col = data.collection;
      if (!col) { renderEmpty(grid); return; }
      paint(grid, col.products.edges.map(function (e) { return e.node; }), false);
    } catch (e) { console.error(e); renderError(grid); }
  }

  async function loadFeatured(grid, first) {
    try {
      var data = await gql(Q_LATEST, { first: first || 6 });
      // Show element labels on featured grid only if opted in via attribute
      var showLabel = grid.hasAttribute('data-show-element-label');
      paint(grid, data.products.edges.map(function (e) { return e.node; }), showLabel);
    } catch (e) { console.error(e); renderError(grid); }
  }

  function init() {
    if (!window.NoahCart || !window.NoahCart.gql) { setTimeout(init, 50); return; }
    document.querySelectorAll('[data-shopify-collection]').forEach(function (grid) {
      loadCollection(grid, grid.getAttribute('data-shopify-collection'),
        parseInt(grid.getAttribute('data-shopify-limit') || '24', 10));
    });
    document.querySelectorAll('[data-shopify-featured]').forEach(function (grid) {
      loadFeatured(grid, parseInt(grid.getAttribute('data-shopify-limit') || '6', 10));
    });
  }

  // Public API — lets other pages (e.g. the quiz results) render real cards.
  window.NoahCatalog = { loadCollection: loadCollection, loadFeatured: loadFeatured };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // Re-fetch grids when language or currency (locale) changes.
  window.addEventListener('noah:locale', init);
})();
