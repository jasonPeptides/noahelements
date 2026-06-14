/*
 * Noah Elements — brand SVG defs.
 * Injects the paper-grain feTurbulence filters once per page, so any
 * element with .paper-rice / .paper-handmade / .paper-laid / .paper-garnet
 * can reference them. Desaturated grain over a flat colour.
 *
 * Production note: feTurbulence over large full-page areas is mildly
 * GPU-heavy — bake the chosen texture into a small tiling PNG for prod and
 * keep the live filter for prototyping (per brand spec §5).
 */
(function () {
  if (document.getElementById('noah-brand-defs')) return;
  var svg =
    '<svg id="noah-brand-defs" width="0" height="0" aria-hidden="true" ' +
    'style="position:absolute;width:0;height:0;overflow:hidden">' +
    '<filter id="paper-rice">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>' +
      '<feColorMatrix type="saturate" values="0"/>' +
    '</filter>' +
    '<filter id="paper-handmade">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.012 0.016" numOctaves="4" stitchTiles="stitch"/>' +
      '<feColorMatrix type="saturate" values="0"/>' +
    '</filter>' +
    '<filter id="paper-garnet">' +
      '<feTurbulence type="turbulence" baseFrequency="0.006 0.12" numOctaves="3" stitchTiles="stitch"/>' +
      '<feColorMatrix type="saturate" values="0"/>' +
    '</filter>' +
    '</svg>';
  function inject() {
    if (document.getElementById('noah-brand-defs')) return;
    var wrap = document.createElement('div');
    wrap.innerHTML = svg;
    document.body.insertBefore(wrap.firstChild, document.body.firstChild);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
