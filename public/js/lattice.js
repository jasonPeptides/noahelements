/*
 * Noah Elements — lattice (花窗), opening-outline method.
 * Geometry is LOCKED (p=22, rd=2.2, rw=1.7, angle=45°, N=14 → tile 308).
 * Only three dials ever change: stroke colour, scale, opacity.
 *
 * Inline <pattern> is the only form that tiles seamlessly WITH the 45° rotation
 * (a flat background-image cannot). This injects that pattern into any element
 * carrying [data-lattice]. Dials via data-attributes:
 *   data-lattice="garnet" | "bone"   (stroke colourway; default garnet)
 *   data-lattice-opacity="0.2"        (layer opacity; default 1)
 *   data-lattice-scale="1.4"          (pattern scale; default 1)
 */
(function () {
  var RECTS = '<rect x="2.2" y="2.2" width="39.6" height="39.6"/><rect x="46.2" y="2.2" width="17.6" height="39.6"/><rect x="68.2" y="2.2" width="39.6" height="39.6"/><rect x="112.2" y="2.2" width="39.6" height="17.6"/><rect x="156.2" y="2.2" width="61.6" height="17.6"/><rect x="222.2" y="2.2" width="61.6" height="17.6"/><rect x="288.2" y="2.2" width="17.6" height="61.6"/><rect x="112.2" y="24.2" width="39.6" height="17.6"/><rect x="156.2" y="24.2" width="61.6" height="17.6"/><rect x="222.2" y="24.2" width="39.6" height="39.6"/><rect x="266.2" y="24.2" width="17.6" height="39.6"/><rect x="2.2" y="46.2" width="39.6" height="39.6"/><rect x="46.2" y="46.2" width="39.6" height="17.6"/><rect x="90.2" y="46.2" width="61.6" height="17.6"/><rect x="156.2" y="46.2" width="61.6" height="17.6"/><rect x="46.2" y="68.2" width="39.6" height="17.6"/><rect x="90.2" y="68.2" width="61.6" height="17.6"/><rect x="156.2" y="68.2" width="39.6" height="39.6"/><rect x="200.2" y="68.2" width="17.6" height="39.6"/><rect x="222.2" y="68.2" width="39.6" height="39.6"/><rect x="266.2" y="68.2" width="17.6" height="39.6"/><rect x="288.2" y="68.2" width="17.6" height="61.6"/><rect x="2.2" y="90.2" width="17.6" height="17.6"/><rect x="24.2" y="90.2" width="61.6" height="17.6"/><rect x="90.2" y="90.2" width="61.6" height="17.6"/><rect x="2.2" y="112.2" width="17.6" height="17.6"/><rect x="24.2" y="112.2" width="61.6" height="17.6"/><rect x="90.2" y="112.2" width="61.6" height="17.6"/><rect x="156.2" y="112.2" width="39.6" height="39.6"/><rect x="200.2" y="112.2" width="17.6" height="39.6"/><rect x="222.2" y="112.2" width="39.6" height="39.6"/><rect x="266.2" y="112.2" width="17.6" height="39.6"/><rect x="2.2" y="134.2" width="17.6" height="17.6"/><rect x="24.2" y="134.2" width="61.6" height="17.6"/><rect x="90.2" y="134.2" width="39.6" height="39.6"/><rect x="134.2" y="134.2" width="17.6" height="39.6"/><rect x="288.2" y="134.2" width="17.6" height="17.6"/><rect x="2.2" y="156.2" width="17.6" height="17.6"/><rect x="24.2" y="156.2" width="61.6" height="17.6"/><rect x="156.2" y="156.2" width="39.6" height="39.6"/><rect x="200.2" y="156.2" width="17.6" height="39.6"/><rect x="222.2" y="156.2" width="39.6" height="39.6"/><rect x="266.2" y="156.2" width="39.6" height="17.6"/><rect x="2.2" y="178.2" width="17.6" height="17.6"/><rect x="24.2" y="178.2" width="39.6" height="39.6"/><rect x="68.2" y="178.2" width="17.6" height="39.6"/><rect x="90.2" y="178.2" width="39.6" height="39.6"/><rect x="134.2" y="178.2" width="17.6" height="39.6"/><rect x="266.2" y="178.2" width="39.6" height="17.6"/><rect x="2.2" y="200.2" width="17.6" height="17.6"/><rect x="156.2" y="200.2" width="39.6" height="39.6"/><rect x="200.2" y="200.2" width="39.6" height="17.6"/><rect x="244.2" y="200.2" width="61.6" height="17.6"/><rect x="2.2" y="222.2" width="17.6" height="39.6"/><rect x="24.2" y="222.2" width="39.6" height="39.6"/><rect x="68.2" y="222.2" width="17.6" height="39.6"/><rect x="90.2" y="222.2" width="39.6" height="39.6"/><rect x="134.2" y="222.2" width="17.6" height="61.6"/><rect x="200.2" y="222.2" width="39.6" height="17.6"/><rect x="244.2" y="222.2" width="61.6" height="17.6"/><rect x="156.2" y="244.2" width="17.6" height="17.6"/><rect x="178.2" y="244.2" width="61.6" height="17.6"/><rect x="244.2" y="244.2" width="39.6" height="39.6"/><rect x="288.2" y="244.2" width="17.6" height="39.6"/><rect x="2.2" y="266.2" width="17.6" height="39.6"/><rect x="24.2" y="266.2" width="39.6" height="39.6"/><rect x="68.2" y="266.2" width="17.6" height="39.6"/><rect x="90.2" y="266.2" width="17.6" height="17.6"/><rect x="112.2" y="266.2" width="17.6" height="39.6"/><rect x="156.2" y="266.2" width="17.6" height="17.6"/><rect x="178.2" y="266.2" width="61.6" height="17.6"/><rect x="90.2" y="288.2" width="17.6" height="17.6"/><rect x="134.2" y="288.2" width="39.6" height="17.6"/><rect x="178.2" y="288.2" width="61.6" height="17.6"/><rect x="244.2" y="288.2" width="61.6" height="17.6"/>';
  var COLOURS = { garnet: '#6E1C2A', bone: '#EDE7DC', charcoal: '#2A2723' };
  var seq = 0;

  function build(el) {
    if (el.querySelector(':scope > .lattice-bg')) return;
    var key = el.getAttribute('data-lattice') || 'garnet';
    var stroke = COLOURS[key] || key;
    var opacity = el.getAttribute('data-lattice-opacity') || '1';
    var scale = parseFloat(el.getAttribute('data-lattice-scale') || '1');
    // keep the rail visually fine if scaled up
    var rw = (1.7 / (scale > 1 ? scale : 1)).toFixed(3);
    var id = 'ne-lattice-' + (++seq);
    var transform = 'rotate(45)' + (scale !== 1 ? ' scale(' + scale + ')' : '');

    var wrap = document.createElement('div');
    wrap.className = 'lattice-bg';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.opacity = opacity;
    wrap.innerHTML =
      '<svg width="100%" height="100%" preserveAspectRatio="xMidYMid slice">' +
        '<defs><pattern id="' + id + '" width="308" height="308" ' +
          'patternUnits="userSpaceOnUse" patternTransform="' + transform + '">' +
          '<g fill="none" stroke="' + stroke + '" stroke-width="' + rw + '">' +
            RECTS +
          '</g></pattern></defs>' +
        '<rect width="100%" height="100%" fill="url(#' + id + ')"/>' +
      '</svg>';

    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.insertBefore(wrap, el.firstChild);
  }

  function paint(root) {
    var nodes = (root || document).querySelectorAll('[data-lattice]');
    for (var i = 0; i < nodes.length; i++) build(nodes[i]);
  }
  window.NoahLattice = { paint: paint };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { paint(); });
  } else { paint(); }
})();
