/* Noah Elements, dynamic product detail page.
 * One template (product.html) serves every product. Reads ?handle=… from the
 * URL, fetches that product from the Shopify Storefront API, and renders a
 * full-height image carousel beside the details (title · price · description ·
 * add to cart), plus an "Other products for you" row from the same element.
 */
(function () {
  'use strict';

  var ELEMENTS = ['fire', 'earth', 'metal', 'water', 'wood'];

  var Q_PRODUCT =
    'query($handle:String!){ product(handle:$handle){ ' +
      'id title handle descriptionHtml availableForSale productType vendor tags ' +
      'featuredImage { url altText } ' +
      'images(first:12){ edges { node { url altText } } } ' +
      'options { name values } ' +
      'collections(first:10){ edges { node { handle title } } } ' +
      'priceRange { minVariantPrice { amount currencyCode } } ' +
      'variants(first:100){ edges { node { ' +
        'id title availableForSale ' +
        'price { amount currencyCode } ' +
        'selectedOptions { name value } ' +
        'image { url altText } ' +
      '} } } } }';

  // Extra info for the accordions, fetched separately so a denied/missing
  // field can never break the main product render.
  var Q_EXTRA =
    'query($handle:String!){ ' +
      'shop { shippingPolicy { body } refundPolicy { body } } ' +
      'product(handle:$handle){ ' +
        'metafields(identifiers:[' +
          '{namespace:"custom",key:"materials"},' +
          '{namespace:"custom",key:"care"},' +
          '{namespace:"custom",key:"shipping"}' +
        ']){ key value } } }';

  var REL_FIELDS =
    'title handle availableForSale ' +
    'featuredImage { url altText } ' +
    'images(first:2){ edges { node { url } } } ' +
    'priceRange { minVariantPrice { amount currencyCode } }';
  var Q_RELATED =
    'query($handle:String!,$first:Int!){ collection(handle:$handle){ products(first:$first){ edges { node { ' + REL_FIELDS + ' } } } } }';
  var Q_LATEST =
    'query($first:Int!){ products(first:$first,sortKey:CREATED_AT,reverse:true){ edges { node { ' + REL_FIELDS + ' } } } }';

  var root = document.getElementById('productRoot');
  var state = { product: null, variants: [], current: null, qty: 1, images: [], slide: 0 };

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
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function getHandle() { return new URLSearchParams(window.location.search).get('handle'); }
  // Request a right-sized image from the Shopify CDN (saves bandwidth).
  function sized(url, w) {
    if (!url || url.indexOf('cdn.shopify') === -1) return url;
    return url + (url.indexOf('?') === -1 ? '?' : '&') + 'width=' + w;
  }

  function isDefaultOnly(product) {
    return product.options.length === 1 &&
      product.options[0].values.length === 1 &&
      /^(Title|Default Title)$/i.test(product.options[0].values[0]);
  }
  function findVariant(selected) {
    return state.variants.find(function (v) {
      return v.selectedOptions.every(function (o) { return selected[o.name] === o.value; });
    }) || null;
  }
  function notFound(msg) {
    root.innerHTML =
      '<div class="pdp-empty"><p>' + esc(msg || '') + '</p>' +
      '<a class="pdp-back" href="/index.html"><span class="en-only">Return home</span><span class="cn-only">返回首页</span></a></div>';
  }

  /* ---------- Render ---------- */
  function render() {
    var p = state.product;
    var imgs = (p.images && p.images.edges || []).map(function (e) { return e.node; });
    if (!imgs.length && p.featuredImage) imgs = [p.featuredImage];
    state.images = imgs;
    var many = imgs.length > 1;
    var showOptions = !isDefaultOnly(p);

    var slides = imgs.map(function (im) {
      return '<div class="pdp-slide"><img src="' + esc(sized(im.url, 1400)) + '" alt="' + esc(im.altText || p.title) + '"></div>';
    }).join('');
    var dots = !many ? '' : '<div class="pdp-dots">' + imgs.map(function (_, i) {
      return '<button class="pdp-dot' + (i === 0 ? ' active' : '') + '" data-i="' + i + '" aria-label="Image ' + (i + 1) + '"></button>';
    }).join('') + '</div>';
    var arrows = !many ? '' :
      '<button class="pdp-nav pdp-prev" aria-label="Previous">‹</button>' +
      '<button class="pdp-nav pdp-next" aria-label="Next">›</button>';

    var optionsHTML = !showOptions ? '' : p.options.map(function (opt) {
      var current = state.current ? (state.current.selectedOptions.find(function (o) { return o.name === opt.name; }) || {}).value : null;
      var sw = opt.values.map(function (val) {
        return '<button class="pdp-option' + (val === current ? ' active' : '') + '" data-opt="' + esc(opt.name) + '" data-val="' + esc(val) + '">' + esc(val) + '</button>';
      }).join('');
      return '<div class="pdp-option-group"><div class="pdp-option-name">' + esc(opt.name) + '</div>' +
        '<div class="pdp-option-values">' + sw + '</div></div>';
    }).join('');

    root.innerHTML =
      '<div class="pdp">' +
        '<div class="pdp-gallery">' +
          '<div class="pdp-carousel">' +
            '<div class="pdp-slides" id="pdpSlides">' + slides + '</div>' +
            arrows + dots +
          '</div>' +
        '</div>' +
        '<div class="pdp-info">' +
          '<h2 class="pdp-title">' + esc(p.title) + '</h2>' +
          '<div class="pdp-price" id="pdpPrice"></div>' +
          (p.descriptionHtml ? '<div class="pdp-desc">' + p.descriptionHtml + '</div>' : '') +
          (showOptions ? '<div class="pdp-options">' + optionsHTML + '</div>' : '') +
          '<div class="pdp-buy">' +
            '<div class="pdp-qty">' +
              '<button class="pdp-qty-btn" id="qtyMinus" aria-label="Decrease">−</button>' +
              '<span class="pdp-qty-val" id="qtyVal">1</span>' +
              '<button class="pdp-qty-btn" id="qtyPlus" aria-label="Increase">+</button>' +
            '</div>' +
            '<button class="pdp-add" id="pdpAdd"><span class="add-label">' +
              '<span class="en-only">Add to cart</span><span class="cn-only">加入购物车</span></span></button>' +
          '</div>' +
          '<div class="pdp-blessing">' +
            '<p class="pdp-blessing-note">' +
              '<span class="en-only">Every piece is blessed at Putuo Mountain before shipping, the earthly home of Guanyin, the Buddhist goddess of mercy. She has been asked to watch over the person who will carry this stone.</span>' +
              '<span class="cn-only">每一件作品在发货前都会送往普陀山开光，观音菩萨的人间道场。我们祈请她护佑佩戴此石的人。</span>' +
            '</p>' +
            '<p class="pdp-certificate">' +
              '<span class="en-only">Includes a personal blessing certificate: your name, your stone, the date it was carried to the mountain.</span>' +
              '<span class="cn-only">附赠专属开光证书：你的名字、你的灵石、以及送往山上的日期。</span>' +
            '</p>' +
          '</div>' +
          '<div class="pdp-accordions" id="pdpAccordions"></div>' +
        '</div>' +
      '</div>' +
      '<section class="pdp-related" id="pdpRelated">' +
        '<h2 class="pdp-related-title"><span class="en-only">Other Stones for You</span><span class="cn-only">为你推荐的灵石</span></h2>' +
        '<div class="pdp-related-grid" id="pdpRelatedGrid"></div>' +
      '</section>';

    bind();
    goSlide(0);
    syncVariant();
  }

  /* ---------- Carousel ---------- */
  function goSlide(i) {
    var n = state.images.length;
    if (!n) return;
    state.slide = (i + n) % n;
    var track = document.getElementById('pdpSlides');
    if (track) track.style.transform = 'translateX(' + (-state.slide * 100) + '%)';
    root.querySelectorAll('.pdp-dot').forEach(function (d, di) { d.classList.toggle('active', di === state.slide); });
  }

  function syncVariant() {
    var v = state.current;
    var priceEl = document.getElementById('pdpPrice');
    var addBtn = document.getElementById('pdpAdd');
    if (priceEl) priceEl.textContent = v ? money(v.price) : (state.product.priceRange ? money(state.product.priceRange.minVariantPrice) : '');
    var soldOut = !v || v.availableForSale === false;
    if (addBtn) {
      addBtn.classList.toggle('is-sold-out', soldOut);
      addBtn.disabled = soldOut;
      var label = addBtn.querySelector('.add-label');
      if (label) label.innerHTML = soldOut
        ? '<span class="en-only">Sold out</span><span class="cn-only">已售罄</span>'
        : '<span class="en-only">Add to cart</span><span class="cn-only">加入购物车</span>';
    }
  }

  function bind() {
    root.querySelectorAll('.pdp-dot').forEach(function (d) {
      d.addEventListener('click', function () { goSlide(parseInt(d.getAttribute('data-i'), 10)); });
    });
    var prev = root.querySelector('.pdp-prev'), next = root.querySelector('.pdp-next');
    if (prev) prev.addEventListener('click', function () { goSlide(state.slide - 1); });
    if (next) next.addEventListener('click', function () { goSlide(state.slide + 1); });

    root.querySelectorAll('.pdp-option').forEach(function (b) {
      b.addEventListener('click', function () {
        var selected = {};
        state.current && state.current.selectedOptions.forEach(function (o) { selected[o.name] = o.value; });
        selected[b.getAttribute('data-opt')] = b.getAttribute('data-val');
        var match = findVariant(selected);
        if (match) state.current = match;
        root.querySelectorAll('.pdp-option[data-opt="' + b.getAttribute('data-opt') + '"]').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        syncVariant();
      });
    });

    var qv = document.getElementById('qtyVal');
    var setQty = function (n) { state.qty = Math.max(1, n); qv.textContent = state.qty; };
    var minus = document.getElementById('qtyMinus'), plus = document.getElementById('qtyPlus');
    if (minus) minus.addEventListener('click', function () { setQty(state.qty - 1); });
    if (plus) plus.addEventListener('click', function () { setQty(state.qty + 1); });

    var add = document.getElementById('pdpAdd');
    if (add) add.addEventListener('click', function () {
      if (!state.current || add.disabled) return;
      add.classList.add('loading');
      window.NoahCart.addVariant(state.current.id, state.qty)
        .catch(function (e) { alert(e.message); })
        .finally(function () { add.classList.remove('loading'); });
    });
  }

  /* ---------- Accordions (shipping & other info) ---------- */
  function accItem(titleEn, titleCn, contentHTML) {
    return '<div class="pdp-acc">' +
      '<button class="pdp-acc-head" type="button" aria-expanded="false">' +
        '<span><span class="en-only">' + titleEn + '</span><span class="cn-only">' + titleCn + '</span></span>' +
        '<span class="pdp-acc-icon" aria-hidden="true"></span>' +
      '</button>' +
      '<div class="pdp-acc-panel"><div class="pdp-acc-body">' + contentHTML + '</div></div>' +
    '</div>';
  }

  async function loadAccordions() {
    var p = state.product;
    var sections = [];

    // Details, from product type / vendor / tags
    var details = [];
    if (p.productType) details.push(['Type', '类型', esc(p.productType)]);
    if (p.vendor) details.push(['Maker', '品牌', esc(p.vendor)]);
    if (p.tags && p.tags.length) details.push(['Tags', '标签', p.tags.map(esc).join(' · ')]);
    if (details.length) {
      var dl = '<dl class="pdp-spec">' + details.map(function (d) {
        return '<dt><span class="en-only">' + d[0] + '</span><span class="cn-only">' + d[1] + '</span></dt><dd>' + d[2] + '</dd>';
      }).join('') + '</dl>';
      sections.push(accItem('Details', '商品详情', dl));
    }

    // Extra: metafields + shop policies
    try {
      var data = await gql(Q_EXTRA, { handle: p.handle });
      var mf = {};
      ((data.product && data.product.metafields) || []).forEach(function (m) { if (m && m.value) mf[m.key] = m.value; });
      var shop = data.shop || {};

      if (mf.materials) sections.push(accItem('Materials', '材质', '<p>' + esc(mf.materials) + '</p>'));
      if (mf.care) sections.push(accItem('Care', '保养', '<p>' + esc(mf.care) + '</p>'));

      var shippingHtml = mf.shipping ? '<p>' + esc(mf.shipping) + '</p>' : (shop.shippingPolicy && shop.shippingPolicy.body ? shop.shippingPolicy.body : '');
      if (shippingHtml) sections.push(accItem('Shipping', '配送', shippingHtml));

      if (shop.refundPolicy && shop.refundPolicy.body) sections.push(accItem('Returns', '退换货', shop.refundPolicy.body));
    } catch (e) { /* extras unavailable, keep whatever we have */ }

    var host = document.getElementById('pdpAccordions');
    if (!host) return;
    if (!sections.length) { host.remove(); return; }
    host.innerHTML = sections.join('');
    host.querySelectorAll('.pdp-acc-head').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var item = btn.closest('.pdp-acc');
        var open = item.classList.toggle('open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });
  }

  /* ---------- Related (same element) ---------- */
  function relatedCard(p) {
    var imgs = (p.images && p.images.edges || []).map(function (e) { return e.node.url; });
    var imgA = imgs[0] || (p.featuredImage && p.featuredImage.url) || '';
    var imgB = imgs[1] || imgA;
    var price = p.priceRange ? money(p.priceRange.minVariantPrice) : '';
    return '<a href="/product.html?handle=' + encodeURIComponent(p.handle) + '" class="product-card">' +
      '<div class="product-image">' +
        (imgA ? '<img class="product-img-a" src="' + esc(sized(imgA, 600)) + '" alt="' + esc(p.title) + '" loading="lazy">' +
                '<img class="product-img-b" src="' + esc(sized(imgB, 600)) + '" alt="" loading="lazy">' : '') +
      '</div>' +
      '<div class="product-info"><div class="product-name">' + esc(p.title) + '</div>' +
        '<div class="product-price">' + esc(price) + '</div></div></a>';
  }

  async function loadRelated() {
    var p = state.product;
    var handles = (p.collections && p.collections.edges || []).map(function (e) { return e.node.handle; });
    var elementHandle = handles.find(function (h) { return ELEMENTS.indexOf(h) !== -1; });
    var items = [];
    try {
      // 1) other stones from the same element
      if (elementHandle) {
        var data = await gql(Q_RELATED, { handle: elementHandle, first: 8 });
        if (data.collection) {
          items = data.collection.products.edges.map(function (e) { return e.node; })
            .filter(function (x) { return x.handle !== p.handle; });
        }
      }
      // 2) fall back / top up with the latest stones from the store
      if (items.length < 4) {
        var latest = await gql(Q_LATEST, { first: 8 });
        var seen = {}; seen[p.handle] = true;
        items.forEach(function (x) { seen[x.handle] = true; });
        latest.products.edges.map(function (e) { return e.node; }).forEach(function (x) {
          if (!seen[x.handle] && items.length < 4) { seen[x.handle] = true; items.push(x); }
        });
      }
      items = items.slice(0, 4);
      var grid = document.getElementById('pdpRelatedGrid');
      if (!grid) return;
      if (!items.length) {
        grid.innerHTML = '<p class="pdp-related-empty"><span class="en-only">More stones coming soon.</span><span class="cn-only">更多灵石即将上架。</span></p>';
        return;
      }
      grid.innerHTML = items.map(relatedCard).join('');
    } catch (e) { /* silent, title still shows */ }
  }

  function setProductSeo() {
    var p = state.product;
    var origin = location.origin;
    var url = origin + location.pathname + location.search;
    var img = (p.featuredImage && p.featuredImage.url) ||
      (p.images && p.images.edges[0] && p.images.edges[0].node.url) || (origin + '/images/hero-opt.jpg');
    img = sized(img, 1200);
    var descText = (p.descriptionHtml || '').replace(/<[^>]+>/g, '').trim().slice(0, 200) ||
      (p.title + ', Noah Elements');

    function meta(attr, key, val) {
      var el = document.head.querySelector('meta[' + attr + '="' + key + '"]');
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
      el.setAttribute('content', val);
    }
    var link = document.head.querySelector('link[rel="canonical"]');
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
    link.href = url;

    meta('name', 'description', descText);
    meta('property', 'og:type', 'product');
    meta('property', 'og:site_name', 'Noah Elements');
    meta('property', 'og:title', p.title + ' · Noah Elements');
    meta('property', 'og:description', descText);
    meta('property', 'og:image', img);
    meta('property', 'og:url', url);
    meta('name', 'twitter:card', 'summary_large_image');
    meta('name', 'twitter:title', p.title + ' · Noah Elements');
    meta('name', 'twitter:description', descText);
    meta('name', 'twitter:image', img);

    // Product structured data (JSON-LD) for rich results
    var v = state.current;
    var price = v ? v.price : (p.priceRange && p.priceRange.minVariantPrice);
    var ld = {
      '@context': 'https://schema.org/', '@type': 'Product',
      name: p.title, image: [img], description: descText, brand: { '@type': 'Brand', name: p.vendor || 'Noah Elements' },
      offers: {
        '@type': 'Offer', url: url,
        priceCurrency: price ? price.currencyCode : 'GBP',
        price: price ? price.amount : undefined,
        availability: (p.availableForSale ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'),
      },
    };
    var old = document.getElementById('pdpJsonLd'); if (old) old.remove();
    var s = document.createElement('script'); s.type = 'application/ld+json'; s.id = 'pdpJsonLd';
    s.textContent = JSON.stringify(ld);
    document.head.appendChild(s);
  }

  async function init() {
    if (!window.NoahCart || !window.NoahCart.gql) { setTimeout(init, 50); return; }
    var handle = getHandle();
    if (!handle) { notFound('No product specified.'); return; }
    try {
      var data = await gql(Q_PRODUCT, { handle: handle });
      if (!data.product) { notFound('Product not found.'); return; }
      state.product = data.product;
      state.variants = data.product.variants.edges.map(function (e) { return e.node; });
      state.current = state.variants.find(function (v) { return v.availableForSale; }) || state.variants[0] || null;
      document.title = data.product.title + ' · Noah Elements';
      setProductSeo();
      render();
      loadAccordions();
      loadRelated();
    } catch (e) {
      console.error(e);
      notFound('Unable to load this product right now.');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // Re-fetch the product when language or currency (locale) changes.
  window.addEventListener('noah:locale', init);
})();
