/* Noah Elements — Shopify Storefront integration (frontend).
 * Talks to the Express proxy at /api/shopify so the access token stays
 * server-side. Manages a Shopify cart, renders a slide-out drawer, and
 * redirects to Shopify's hosted checkout.
 */
(function () {
  'use strict';

  var CART_ID_KEY = 'noah_cart_id';
  var API = '/api/shopify';

  /* ---------- GraphQL helper ---------- */
  // Current Shopify language code from the site's language toggle.
  function langCode() { return document.body.classList.contains('lang-zh') ? 'ZH_CN' : 'EN'; }
  function countryCode() { return (window.NoahLocale && window.NoahLocale.country()) || 'GB'; }
  // Inject @inContext(language, country) so titles localise and prices use the
  // visitor's currency (Shopify Markets).
  function withLang(query) {
    if (query.indexOf('@inContext') !== -1) return query; // already localised by caller
    return query.replace(/^(query|mutation)(\([^)]*\))?/, function (m) {
      return m + ' @inContext(language: ' + langCode() + ', country: ' + countryCode() + ')';
    });
  }
  async function gql(query, variables) {
    var res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: withLang(query), variables: variables || {} }),
    });
    var json = await res.json();
    if (json.errors && json.errors.length) {
      console.error('Shopify error:', json.errors);
      throw new Error(json.errors[0].message);
    }
    return json.data;
  }

  /* ---------- GraphQL documents ---------- */
  var CART_FRAGMENT = "\
    id\
    checkoutUrl\
    totalQuantity\
    cost { subtotalAmount { amount currencyCode } }\
    lines(first: 50) {\
      edges { node {\
        id\
        quantity\
        merchandise { ... on ProductVariant {\
          id title\
          image { url altText }\
          price { amount currencyCode }\
          product { title handle }\
        } }\
      } }\
    }";

  var Q_PRODUCT_BY_HANDLE = "query($handle:String!){ product(handle:$handle){ id title handle \
    variants(first:1){ edges { node { id availableForSale price { amount currencyCode } } } } } }";

  var Q_PRODUCTS = "query($first:Int!){ products(first:$first){ edges { node { id title handle \
    featuredImage { url altText } \
    priceRange { minVariantPrice { amount currencyCode } } \
    variants(first:1){ edges { node { id availableForSale } } } } } } }";

  var M_CART_CREATE = "mutation($lines:[CartLineInput!],$country:CountryCode!){ cartCreate(input:{lines:$lines,buyerIdentity:{countryCode:$country}}){ cart {" + CART_FRAGMENT + "} userErrors { message } } }";
  var M_BUYER = "mutation($cartId:ID!,$country:CountryCode!){ cartBuyerIdentityUpdate(cartId:$cartId,buyerIdentity:{countryCode:$country}){ cart {" + CART_FRAGMENT + "} userErrors { message } } }";
  var M_LINES_ADD = "mutation($cartId:ID!,$lines:[CartLineInput!]!){ cartLinesAdd(cartId:$cartId,lines:$lines){ cart {" + CART_FRAGMENT + "} userErrors { message } } }";
  var M_LINES_UPDATE = "mutation($cartId:ID!,$lines:[CartLineUpdateInput!]!){ cartLinesUpdate(cartId:$cartId,lines:$lines){ cart {" + CART_FRAGMENT + "} userErrors { message } } }";
  var M_LINES_REMOVE = "mutation($cartId:ID!,$lineIds:[ID!]!){ cartLinesRemove(cartId:$cartId,lineIds:$lineIds){ cart {" + CART_FRAGMENT + "} userErrors { message } } }";
  var Q_CART = "query($id:ID!){ cart(id:$id){" + CART_FRAGMENT + "} }";

  /* ---------- Cart state ---------- */
  var state = { cart: null };

  function getCartId() { try { return localStorage.getItem(CART_ID_KEY); } catch (e) { return null; } }
  function setCartId(id) { try { id ? localStorage.setItem(CART_ID_KEY, id) : localStorage.removeItem(CART_ID_KEY); } catch (e) {} }

  async function resolveVariantId(handle) {
    var data = await gql(Q_PRODUCT_BY_HANDLE, { handle: handle });
    if (!data.product) throw new Error('Product not found: ' + handle);
    var edge = data.product.variants.edges[0];
    if (!edge) throw new Error('No variant for: ' + handle);
    return edge.node.id;
  }

  async function ensureCart(firstLines) {
    var id = getCartId();
    if (id) {
      try {
        var data = await gql(Q_CART, { id: id });
        if (data.cart) { state.cart = data.cart; return state.cart; }
      } catch (e) { /* fall through to create */ }
      setCartId(null);
    }
    var created = await gql(M_CART_CREATE, { lines: firstLines || [], country: countryCode() });
    state.cart = created.cartCreate.cart;
    setCartId(state.cart.id);
    return state.cart;
  }

  async function addVariant(variantId, quantity) {
    var line = { merchandiseId: variantId, quantity: quantity || 1 };
    var id = getCartId();
    if (!id) {
      await ensureCart([line]);
    } else {
      var data = await gql(M_LINES_ADD, { cartId: id, lines: [line] });
      state.cart = data.cartLinesAdd.cart;
    }
    render();
    openDrawer();
    return state.cart;
  }

  async function addByHandle(handle, quantity) {
    var variantId = await resolveVariantId(handle);
    return addVariant(variantId, quantity);
  }

  async function updateLine(lineId, quantity) {
    var id = getCartId();
    if (!id) return;
    if (quantity <= 0) return removeLine(lineId);
    var data = await gql(M_LINES_UPDATE, { cartId: id, lines: [{ id: lineId, quantity: quantity }] });
    state.cart = data.cartLinesUpdate.cart;
    render();
  }

  async function removeLine(lineId) {
    var id = getCartId();
    if (!id) return;
    var data = await gql(M_LINES_REMOVE, { cartId: id, lineIds: [lineId] });
    state.cart = data.cartLinesRemove.cart;
    render();
  }

  function checkout() {
    if (state.cart && state.cart.checkoutUrl) window.location.href = state.cart.checkoutUrl;
  }

  /* ---------- Drawer UI ---------- */
  var els = {};

  function buildDrawer() {
    var overlay = document.createElement('div');
    overlay.className = 'cart-overlay';
    overlay.innerHTML =
      '<aside class="cart-drawer" role="dialog" aria-label="Cart">' +
        '<div class="cart-head">' +
          '<h2 class="cart-title"><span class="en-only">Cart</span><span class="cn-only">购物车</span></h2>' +
          '<button class="cart-close" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="cart-body"></div>' +
        '<div class="cart-foot">' +
          '<div class="cart-subtotal"><span><span class="en-only">Subtotal</span><span class="cn-only">小计</span></span><span class="cart-subtotal-val">—</span></div>' +
          '<button class="cart-checkout"><span class="en-only">Checkout</span><span class="cn-only">结账</span></button>' +
        '</div>' +
      '</aside>';
    document.body.appendChild(overlay);

    els.overlay = overlay;
    els.drawer = overlay.querySelector('.cart-drawer');
    els.body = overlay.querySelector('.cart-body');
    els.subtotal = overlay.querySelector('.cart-subtotal-val');

    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeDrawer(); });
    overlay.querySelector('.cart-close').addEventListener('click', closeDrawer);
    overlay.querySelector('.cart-checkout').addEventListener('click', checkout);

    els.body.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]');
      if (!btn) return;
      var lineId = btn.getAttribute('data-line');
      var qty = parseInt(btn.getAttribute('data-qty') || '0', 10);
      var act = btn.getAttribute('data-act');
      if (act === 'inc') updateLine(lineId, qty + 1);
      else if (act === 'dec') updateLine(lineId, qty - 1);
      else if (act === 'rm') removeLine(lineId);
    });
  }

  function money(m) {
    if (!m) return '';
    var n = parseFloat(m.amount);
    var symbols = { CNY: '¥', USD: '$', GBP: '£', EUR: '€', JPY: '¥', AUD: '$', CAD: '$' };
    var sym = symbols[m.currencyCode] || '';
    return sym + n.toFixed(2) + (sym ? '' : ' ' + m.currencyCode);
  }

  function render() {
    var badges = document.querySelectorAll('.cart-count');
    var count = state.cart ? (state.cart.totalQuantity || 0) : 0;
    badges.forEach(function (b) { b.textContent = count; b.style.display = count > 0 ? 'flex' : 'none'; });

    if (!els.body) return;
    var lines = state.cart && state.cart.lines ? state.cart.lines.edges : [];
    if (!lines.length) {
      els.body.innerHTML = '<p class="cart-empty"><span class="en-only">Your cart is empty.</span><span class="cn-only">购物车是空的。</span></p>';
      els.subtotal.textContent = '—';
      return;
    }
    els.body.innerHTML = lines.map(function (edge) {
      var n = edge.node, m = n.merchandise, img = m.image ? m.image.url : '';
      return '<div class="cart-line">' +
        '<div class="cart-line-img">' + (img ? '<img src="' + img + '" alt="">' : '') + '</div>' +
        '<div class="cart-line-info">' +
          '<div class="cart-line-name">' + m.product.title + '</div>' +
          '<div class="cart-line-price">' + money(m.price) + '</div>' +
          '<div class="cart-qty">' +
            '<button data-act="dec" data-line="' + n.id + '" data-qty="' + n.quantity + '">−</button>' +
            '<span>' + n.quantity + '</span>' +
            '<button data-act="inc" data-line="' + n.id + '" data-qty="' + n.quantity + '">+</button>' +
            '<button class="cart-rm" data-act="rm" data-line="' + n.id + '">' +
              '<span class="en-only">Remove</span><span class="cn-only">移除</span></button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
    els.subtotal.textContent = state.cart.cost ? money(state.cart.cost.subtotalAmount) : '—';
  }

  function openDrawer() { if (els.overlay) { els.overlay.classList.add('open'); document.body.style.overflow = 'hidden'; } }
  function closeDrawer() { if (els.overlay) { els.overlay.classList.remove('open'); document.body.style.overflow = ''; } }

  /* ---------- Wire up ---------- */
  function bindAddButtons() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-shopify-variant], [data-shopify-handle]');
      if (!btn) return;
      e.preventDefault();
      if (btn.classList.contains('loading')) return;
      var variant = btn.getAttribute('data-shopify-variant');
      var handle = btn.getAttribute('data-shopify-handle');
      btn.classList.add('loading');
      var op = variant ? addVariant(variant, 1) : addByHandle(handle, 1);
      op.catch(function (err) {
        alert(err.message);
      }).finally(function () {
        btn.classList.remove('loading');
      });
    });
    document.addEventListener('click', function (e) {
      if (e.target.closest('.cart-trigger')) { e.preventDefault(); openDrawer(); }
    });
  }

  async function init() {
    buildDrawer();
    bindAddButtons();
    var id = getCartId();
    if (id) {
      try { var data = await gql(Q_CART, { id: id }); if (data.cart) state.cart = data.cart; else setCartId(null); }
      catch (e) {}
    }
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // On locale change: re-localise line titles AND re-price the cart to the
  // selected country's currency (so checkout matches what the visitor sees).
  window.addEventListener('noah:locale', async function () {
    var id = getCartId();
    if (!id) return;
    try {
      var data = await gql(M_BUYER, { cartId: id, country: countryCode() });
      var cart = data && data.cartBuyerIdentityUpdate && data.cartBuyerIdentityUpdate.cart;
      if (!cart) { var q = await gql(Q_CART, { id: id }); cart = q.cart; }
      if (cart) { state.cart = cart; render(); }
    } catch (e) {}
  });

  /* ---------- Public API ---------- */
  window.NoahCart = {
    addByHandle: addByHandle,
    addVariant: addVariant,
    open: openDrawer,
    close: closeDrawer,
    checkout: checkout,
    gql: gql,
    money: money,
    fetchProducts: function (first) { return gql(Q_PRODUCTS, { first: first || 20 }); },
    get state() { return state.cart; },
  };
})();
