/* Noah Elements — finalises canonical + Open Graph/Twitter URLs at runtime.
 * Static og:title/description/image live in each page's <head>; this fills the
 * absolute URL bits (which depend on the deployed domain) so they're correct
 * wherever the site is hosted.
 */
(function () {
  'use strict';
  var origin = location.origin;
  // canonical includes ?handle on the product page, otherwise just the path
  var isProduct = /\/product\.html$/.test(location.pathname);
  var canonicalUrl = origin + location.pathname + (isProduct ? location.search : '');

  function setMeta(attr, name, content) {
    var el = document.head.querySelector('meta[' + attr + '="' + name + '"]');
    if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el); }
    el.setAttribute('content', content);
  }

  // canonical link
  var link = document.head.querySelector('link[rel="canonical"]');
  if (!link) { link = document.createElement('link'); link.setAttribute('rel', 'canonical'); document.head.appendChild(link); }
  link.setAttribute('href', canonicalUrl);

  setMeta('property', 'og:url', canonicalUrl);

  // absolutise relative image URLs for og/twitter
  ['og:image', 'twitter:image'].forEach(function (key) {
    var attr = key.indexOf('og:') === 0 ? 'property' : 'name';
    var el = document.head.querySelector('meta[' + attr + '="' + key + '"]');
    if (el) {
      var v = el.getAttribute('content') || '';
      if (v && v.indexOf('http') !== 0) el.setAttribute('content', origin + (v[0] === '/' ? '' : '/') + v);
    }
  });
})();
