/*
 * Oracle-bone (甲骨文 / 金文) five-element glyphs.
 * Hand-traced from the brand reference set (古老五行甲骨文象形图案集, 2026-06-11)
 * into a single unified ink-line style. Each glyph inherits `currentColor`,
 * so the surrounding element/accent colour drives its tone.
 *
 * fire  — three rising flame tongues, forked central tongue (倒V + 两侧火苗)
 * water — central wavy stream with droplet/branch strokes either side
 * wood  — a tree: trunk, two branches reaching up, two roots splaying down
 * earth — a mound / altar bud rising from the ground line
 * metal — bronze-script 金: roof, ore nuggets, layered base (矿石藏于土中)
 */
(function () {
  function wrap(inner) {
    return (
      '<svg class="oracle-glyph" viewBox="0 0 100 100" fill="none" ' +
      'stroke="currentColor" stroke-width="5" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      inner +
      '</svg>'
    );
  }

  var GLYPHS = {
    fire: wrap(
      '<path d="M50,86 C44,64 56,54 50,30"/>' +
      '<path d="M50,36 L42,16"/>' +
      '<path d="M50,36 L58,16"/>' +
      '<path d="M34,82 C30,66 36,58 35,44"/>' +
      '<path d="M66,82 C70,66 64,58 65,44"/>'
    ),
    water: wrap(
      '<path d="M50,12 C58,30 42,42 50,56 C58,70 44,80 50,92"/>' +
      '<path d="M32,32 C28,40 30,46 33,50"/>' +
      '<path d="M30,58 C26,66 28,72 31,76"/>' +
      '<path d="M68,32 C72,40 70,46 67,50"/>' +
      '<path d="M70,58 C74,66 72,72 69,76"/>'
    ),
    wood: wrap(
      '<path d="M50,10 L50,90"/>' +
      '<path d="M50,40 L30,16"/>' +
      '<path d="M50,40 L70,16"/>' +
      '<path d="M50,60 L28,90"/>' +
      '<path d="M50,60 L72,90"/>'
    ),
    earth: wrap(
      '<path d="M20,84 L80,84"/>' +
      '<path d="M50,84 C34,60 44,30 50,18 C56,30 66,60 50,84"/>' +
      '<path d="M30,54 L30,64"/>' +
      '<path d="M70,54 L70,64"/>'
    ),
    metal: wrap(
      '<path d="M32,30 L50,14 L68,30"/>' +
      '<path d="M50,14 L50,84"/>' +
      '<path d="M34,56 L66,56"/>' +
      '<path d="M28,84 L72,84"/>' +
      '<circle cx="40" cy="44" r="2.6" fill="currentColor" stroke="none"/>' +
      '<circle cx="60" cy="44" r="2.6" fill="currentColor" stroke="none"/>'
    )
  };

  window.OracleGlyphs = GLYPHS;

  // Auto-populate any element with [data-oracle="<element>"].
  function paint(root) {
    var nodes = (root || document).querySelectorAll('[data-oracle]');
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute('data-oracle');
      if (GLYPHS[key]) nodes[i].innerHTML = GLYPHS[key];
    }
  }
  window.OracleGlyphs.paint = paint;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { paint(); });
  } else {
    paint();
  }
})();
