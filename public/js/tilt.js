/* Subtle 3D tilt for the Putuo blessing card.
 * Desktop: follows mouse position. Mobile: device orientation (accelerometer).
 * Honours prefers-reduced-motion. */
(function () {
  'use strict';
  var card = document.querySelector('.blessing-card');
  if (!card) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var MAX = 8;          // max tilt in degrees
  card.style.transition = 'transform 0.25s cubic-bezier(0.16,1,0.3,1)';
  card.style.willChange = 'transform';

  function apply(rx, ry) {
    card.style.transform = 'perspective(900px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
  }
  function reset() { apply(0, 0); }
  var clamp = function (v) { return Math.max(-MAX, Math.min(MAX, v)); };

  /* ---- Desktop: mouse position over the band ---- */
  var area = card.closest('.band-blessing') || document;
  area.addEventListener('mousemove', function (e) {
    var r = card.getBoundingClientRect();
    var dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);   // -1..1
    var dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);  // -1..1
    apply(clamp(-dy * MAX), clamp(dx * MAX));
  }, { passive: true });
  area.addEventListener('mouseleave', reset, { passive: true });

  /* ---- Mobile: accelerometer / device orientation ---- */
  function startOrientation() {
    window.addEventListener('deviceorientation', function (ev) {
      if (ev.beta == null || ev.gamma == null) return;
      apply(clamp(-(ev.beta - 45) / 4), clamp(ev.gamma / 4));
    }, { passive: true });
  }
  if (window.DeviceOrientationEvent) {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      // iOS 13+ needs a user gesture to grant motion access.
      window.addEventListener('touchend', function once() {
        window.removeEventListener('touchend', once);
        DeviceOrientationEvent.requestPermission().then(function (s) {
          if (s === 'granted') startOrientation();
        }).catch(function () {});
      }, { once: true });
    } else {
      startOrientation();
    }
  }
})();
