/* Noah Elements — shared language persistence + nav behaviour.
 * Keeps the ZH/EN choice consistent across every page via localStorage,
 * and applies the saved language on load (overriding each page's hardcoded
 * default). Also toggles the .scrolled class on the fixed nav.
 */
(function () {
  'use strict';
  var KEY = 'noah_lang';
  var body = document.body;

  function read() {
    try { var v = localStorage.getItem(KEY); return (v === 'zh' || v === 'en') ? v : null; } catch (e) { return null; }
  }
  function write(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  function apply(lang) {
    body.classList.remove('lang-zh', 'lang-en');
    body.classList.add('lang-' + lang);
    document.documentElement.setAttribute('lang', lang === 'zh' ? 'zh' : 'en');
    var toggle = document.getElementById('langToggle');
    if (toggle) {
      toggle.querySelectorAll('.opt').forEach(function (o) {
        o.classList.toggle('active', o.getAttribute('data-lang') === lang);
      });
    }
  }

  // Initial language: saved choice, else the page's existing default.
  var initial = read() || (body.classList.contains('lang-zh') ? 'zh' : 'en');
  apply(initial);
  write(initial);

  // Persist whenever the language changes (runs after each page's own toggle
  // handler has already swapped the body class).
  var toggle = document.getElementById('langToggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      // Single source of truth: flip the language here.
      var next = body.classList.contains('lang-zh') ? 'en' : 'zh';
      write(next);
      apply(next);
      // Tell Shopify-driven views to re-fetch in the new locale.
      window.dispatchEvent(new CustomEvent('noah:locale', { detail: { lang: next } }));
    });
  }

  // Sync across open tabs.
  window.addEventListener('storage', function (e) {
    if (e.key === KEY && (e.newValue === 'zh' || e.newValue === 'en')) apply(e.newValue);
  });

  // Fixed nav: transparent only at the very top of the page; as soon as the
  // user begins scrolling, the solid bar fills in.
  var nav = document.querySelector('.nav');
  if (nav) {
    var ticking = false;
    var syncNav = function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        if (window.scrollY > 8) nav.classList.add('scrolled');
        else nav.classList.remove('scrolled');
        ticking = false;
      });
    };
    window.addEventListener('scroll', syncNav, { passive: true });
    syncNav();
  }

  // Menu button → element list panel (click to toggle, click-away / Esc to close).
  var menuBtn = document.getElementById('menuBtn');
  var menuPanel = document.getElementById('menuPanel');
  if (menuBtn && menuPanel) {
    var closeMenu = function () { menuPanel.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); };
    var openMenu = function () { menuPanel.classList.add('open'); menuBtn.setAttribute('aria-expanded', 'true'); };
    menuBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      menuPanel.classList.contains('open') ? closeMenu() : openMenu();
    });
    document.addEventListener('click', function (e) {
      if (!menuPanel.contains(e.target) && !menuBtn.contains(e.target)) closeMenu();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  }

  // Scroll-scrubbed reveal — progress driven by scroll position so animations
  // enter AND exit. MutationObserver picks up dynamically injected elements.
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduce) {
    document.querySelectorAll('[data-reveal]').forEach(function (el) {
      el.style.opacity = '1'; el.style.transform = 'none';
    });
  } else {
    var revealEls = [];
    var revealState = [];

    function addRevealEl(el) {
      if (revealEls.indexOf(el) !== -1) return;
      var r = el.getBoundingClientRect();
      var vh = window.innerHeight;
      var raw = (vh - r.top) / (vh * 0.45);
      var init = raw < 0 ? 0 : raw > 1 ? 1 : raw;
      revealEls.push(el);
      revealState.push({ op: init, ty: (1 - init) * 24 });
    }

    document.querySelectorAll('[data-reveal]').forEach(addRevealEl);

    // Catch dynamically added elements (product cards, etc.)
    new MutationObserver(function (records) {
      records.forEach(function (rec) {
        rec.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.hasAttribute && node.hasAttribute('data-reveal')) addRevealEl(node);
          if (node.querySelectorAll) node.querySelectorAll('[data-reveal]').forEach(addRevealEl);
        });
      });
    }).observe(document.body, { childList: true, subtree: true });

    function tickReveal() {
      var vh = window.innerHeight;
      for (var i = 0; i < revealEls.length; i++) {
        var el = revealEls[i];
        var r = el.getBoundingClientRect();
        var raw = (vh - r.top) / (vh * 0.45);
        var target = raw < 0 ? 0 : raw > 1 ? 1 : raw;
        var s = revealState[i];
        s.op += (target - s.op) * 0.14;
        s.ty += ((1 - target) * 24 - s.ty) * 0.14;
        el.style.opacity = s.op.toFixed(3);
        el.style.transform = s.ty > 0.3 ? 'translateY(' + s.ty.toFixed(2) + 'px)' : 'none';
      }
      requestAnimationFrame(tickReveal);
    }
    requestAnimationFrame(tickReveal);
  }
})();
