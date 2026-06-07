const express = require('express');
const path = require('path');
const fs = require('fs');
const compression = require('compression');
const helmet = require('helmet');

// Minimal .env loader (no dependency) — fills process.env from a local .env file.
(function loadEnv() {
  try {
    const file = path.join(__dirname, '.env');
    if (!fs.existsSync(file)) return;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch (e) { /* ignore */ }
})();

const { shopifyProxy, shopifyHealth, storefrontQuery } = require('./lib/shopify-proxy');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');

app.disable('x-powered-by');
app.set('trust proxy', 1); // honour X-Forwarded-* behind a host/proxy

// ---- Security headers (CSP disabled: the site uses inline scripts/styles,
// Google Fonts and the Shopify CDN, which a strict default CSP would block) ----
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// ---- gzip / brotli compression ----
app.use(compression());

app.use(express.json({ limit: '64kb' }));

// ---- Simple in-memory rate limiter for the API proxy ----
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    let rec = hits.get(ip);
    if (!rec || now > rec.reset) { rec = { count: 0, reset: now + windowMs }; hits.set(ip, rec); }
    rec.count++;
    if (rec.count > max) {
      res.set('Retry-After', Math.ceil((rec.reset - now) / 1000));
      return res.status(429).json({ errors: [{ message: 'Too many requests. Please slow down.' }] });
    }
    // opportunistic cleanup
    if (hits.size > 5000) for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
    next();
  };
}
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 80 });

// ---- Shopify Storefront API proxy (token stays server-side) ----
app.post('/api/shopify', apiLimiter, shopifyProxy);
app.get('/api/shopify/health', shopifyHealth);

// ---- Visitor geo (country) for default currency ----
app.get('/api/geo', (req, res) => {
  // Hosts/CDNs expose the visitor country via a header. Falls back to null.
  var country =
    req.get('cf-ipcountry') ||
    req.get('x-vercel-ip-country') ||
    req.get('x-appengine-country') ||
    req.get('x-country-code') ||
    req.get('fastly-geo-countrycode') || null;
  if (country) country = String(country).toUpperCase();
  if (!country || country === 'XX' || country.length !== 2) country = null;
  res.set('Cache-Control', 'no-store');
  res.json({ country: country });
});

// ---- robots.txt ----
app.get('/robots.txt', (req, res) => {
  const base = `${req.protocol}://${req.get('host')}`;
  res.type('text/plain').send(
    `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${base}/sitemap.xml\n`
  );
});

// ---- Dynamic sitemap.xml (static pages + collections + live product handles) ----
app.get('/sitemap.xml', async (req, res) => {
  const base = `${req.protocol}://${req.get('host')}`;
  const urls = [
    '/', '/custom.html', '/ai-test.html', '/privacy.html',
    '/collections/fire.html', '/collections/earth.html', '/collections/metal.html',
    '/collections/water.html', '/collections/wood.html',
  ];
  try {
    const data = await storefrontQuery('{ products(first:100){ edges { node { handle } } } }');
    const handles = data && data.products ? data.products.edges.map(e => e.node.handle) : [];
    handles.forEach(h => urls.push('/product.html?handle=' + encodeURIComponent(h)));
  } catch (e) { /* products optional */ }

  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(u => `  <url><loc>${base}${u.replace(/&/g, '&amp;')}</loc></url>`).join('\n') +
    '\n</urlset>\n';
  res.type('application/xml').send(xml);
});

// ---- Static assets with sensible caching ----
app.use(express.static(PUBLIC, {
  setHeaders(res, filePath) {
    if (/\.(jpe?g|png|webp|svg|woff2?|ico)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // images/fonts: 1 day
    } else {
      // CSS/JS/HTML: cache but revalidate via ETag so updates are never stale
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

// ---- 404 for anything unmatched ----
app.get('/{*path}', (req, res) => {
  res.status(404).sendFile(path.join(PUBLIC, '404.html'));
});

// Run a real server only when executed directly (local / Node host).
// On Vercel the app is imported and used as a serverless handler instead.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
