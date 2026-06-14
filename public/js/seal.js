/*
 * Noah Elements — Seal (印章), scroll-driven "Inscribe".
 * The seal draws itself as the section scrolls through the viewport: the line
 * traces (stroke-dashoffset scrubbed by scroll progress), then the solid fill
 * blooms in near the end. Built from the seal's own vector (seal-line.svg).
 *
 * Usage: <span data-seal-scroll></span>  (colour via CSS `color`).
 * Honours reduced-motion (shows the finished seal, no draw).
 */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setup(el, svgText) {
    el.innerHTML = svgText;
    el.setAttribute('aria-hidden', 'true');
    var stroke = el.querySelector('.seal-stroke');
    var fill = el.querySelector('.seal-fill');
    if (!stroke) return;
    var len = stroke.getTotalLength();
    stroke.style.strokeDasharray = len;

    if (reduce) { stroke.style.strokeDashoffset = 0; if (fill) fill.setAttribute('opacity', '1'); return; }
    stroke.style.strokeDashoffset = len;

    var ticking = false;
    function update() {
      ticking = false;
      var r = el.getBoundingClientRect();
      var vh = window.innerHeight || document.documentElement.clientHeight;
      // 0 when the seal sits at the bottom edge, 1 once it has risen ~75% up.
      var p = (vh - r.top) / (vh * 0.75);
      p = p < 0 ? 0 : p > 1 ? 1 : p;
      stroke.style.strokeDashoffset = len * (1 - p);
      // fill blooms over the last 15% of the draw
      if (fill) {
        var f = (p - 0.85) / 0.15;
        fill.setAttribute('opacity', String(f < 0 ? 0 : f > 1 ? 1 : f));
      }
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  }

  var cache = null;
  function load(cb) {
    if (cache != null) return cb(cache);
    fetch('/images/seal-line.svg?v=5').then(function (r) { return r.text(); })
      .then(function (t) { cache = t; cb(t); })
      .catch(function () {});
  }
  function paint(root) {
    var nodes = (root || document).querySelectorAll('[data-seal-scroll]');
    if (!nodes.length) return;
    load(function (t) { for (var i = 0; i < nodes.length; i++) setup(nodes[i], t); });
  }
  window.NoahSeal = { paint: paint };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { paint(); });
  else paint();
})();
