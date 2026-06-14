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

  // Shared scroll-reveal — one consistent system for every page. Elements with
  // [data-reveal] fade/rise in once when they enter the viewport.
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var revealEls = document.querySelectorAll('[data-reveal]:not(.visible)');
  if (revealEls.length) {
    if (reduce || !('IntersectionObserver' in window)) {
      revealEls.forEach(function (el) { el.classList.add('visible'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('visible'); io.unobserve(en.target); }
        });
      }, { threshold: 0.15, rootMargin: '0px 0px -22% 0px' });
      revealEls.forEach(function (el) { io.observe(el); });
    }
  }
})();
