// Server-side proxy for the Shopify Storefront API.
//
// Token strategy (in priority order):
//   1. If SHOPIFY_STOREFRONT_TOKEN is set, use it directly (manual override).
//   2. Otherwise, use the app's Client ID + secret (SHOPIFY_CLIENT_ID /
//      SHOPIFY_CLIENT_SECRET) to:
//        a. obtain an Admin API token via the client-credentials grant, then
//        b. reuse or mint a Storefront API access token via the Admin API.
//      Both tokens are cached in memory and refreshed automatically.
//
// All tokens stay server-side; the browser only ever talks to /api/shopify.

const SHOP_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN || 'noah-elements.myshopify.com';
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-01';

const MANUAL_TOKEN = process.env.SHOPIFY_STOREFRONT_TOKEN || '';
const PRIVATE_TOKEN = process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN || '';
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID || '';
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET || '';

const STOREFRONT_ENDPOINT = `https://${SHOP_DOMAIN}/api/${API_VERSION}/graphql.json`;
const ADMIN_ENDPOINT = `https://${SHOP_DOMAIN}/admin/api/${API_VERSION}/graphql.json`;
const OAUTH_ENDPOINT = `https://${SHOP_DOMAIN}/admin/oauth/access_token`;
const SF_TOKENS_REST = `https://${SHOP_DOMAIN}/admin/api/${API_VERSION}/storefront_access_tokens.json`;

// In-memory caches.
let adminToken = null;
let adminTokenExpiry = 0;          // epoch ms
let storefrontToken = MANUAL_TOKEN || null;
let inflightStorefront = null;     // de-dupe concurrent resolution

function nowMs() { return Date.parse(new Date().toUTCString()); }

async function getAdminToken() {
  if (adminToken && nowMs() < adminTokenExpiry) return adminToken;
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('No SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET configured.');
  }
  const res = await fetch(OAUTH_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error('Client-credentials grant failed: ' + JSON.stringify(data));
  }
  adminToken = data.access_token;
  // Refresh a minute before the stated expiry (default ~24h).
  const ttl = (data.expires_in ? data.expires_in : 86400) * 1000;
  adminTokenExpiry = nowMs() + ttl - 60000;
  return adminToken;
}

// Reuse an existing Storefront access token, or mint a new one via the Admin API.
async function resolveStorefrontToken() {
  if (storefrontToken) return storefrontToken;
  if (inflightStorefront) return inflightStorefront;

  inflightStorefront = (async () => {
    const admin = await getAdminToken();

    // 1. Try to reuse an existing storefront access token (REST list).
    const listRes = await fetch(SF_TOKENS_REST, {
      headers: { 'X-Shopify-Access-Token': admin },
    });
    if (listRes.ok) {
      const list = await listRes.json();
      const existing = (list.storefront_access_tokens || [])[0];
      if (existing && existing.access_token) {
        storefrontToken = existing.access_token;
        return storefrontToken;
      }
    }

    // 2. None exist — create one.
    const createRes = await fetch(SF_TOKENS_REST, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': admin },
      body: JSON.stringify({ storefront_access_token: { title: 'Noah Elements Headless' } }),
    });
    const created = await createRes.json();
    if (created.storefront_access_token && created.storefront_access_token.access_token) {
      storefrontToken = created.storefront_access_token.access_token;
      return storefrontToken;
    }
    throw new Error('Could not obtain a Storefront access token: ' + JSON.stringify(created));
  })();

  try {
    return await inflightStorefront;
  } finally {
    inflightStorefront = null;
  }
}

async function shopifyProxy(req, res) {
  const { query, variables } = req.body || {};
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ errors: [{ message: 'Missing GraphQL "query" string.' }] });
  }

  // Prefer the private (delegate) token with its dedicated header. Otherwise
  // fall back to a public token (manual, or auto-minted from client creds).
  let authHeader;
  if (PRIVATE_TOKEN) {
    authHeader = { 'Shopify-Storefront-Private-Token': PRIVATE_TOKEN };
  } else {
    let token;
    try {
      token = await resolveStorefrontToken();
    } catch (err) {
      console.error('Shopify token resolution failed:', err.message);
      return res.status(500).json({
        errors: [{
          message: 'Shopify is not configured yet. Set SHOPIFY_STOREFRONT_PRIVATE_TOKEN, ' +
            'SHOPIFY_STOREFRONT_TOKEN, or SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET with ' +
            'Storefront API scopes enabled on the app. (' + err.message + ')',
        }],
      });
    }
    authHeader = { 'X-Shopify-Storefront-Access-Token': token };
  }

  try {
    const upstream = await fetch(STOREFRONT_ENDPOINT, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeader),
      body: JSON.stringify({ query, variables: variables || {} }),
    });
    const data = await upstream.json();
    // If the cached storefront token was revoked, drop it so the next call re-mints.
    if (data && data.errors && data.errors.some(e => e.extensions && e.extensions.code === 'UNAUTHORIZED') && !MANUAL_TOKEN) {
      storefrontToken = null;
    }
    return res.status(upstream.status).json(data);
  } catch (err) {
    console.error('Shopify proxy error:', err);
    return res.status(502).json({ errors: [{ message: 'Failed to reach Shopify Storefront API.' }] });
  }
}

// Lightweight health/diagnostic endpoint — runs a trivial Storefront query and
// reports whether the configured token can actually read the store.
async function shopifyHealth(req, res) {
  const headers = { 'Content-Type': 'application/json' };
  if (PRIVATE_TOKEN) headers['Shopify-Storefront-Private-Token'] = PRIVATE_TOKEN;
  else if (MANUAL_TOKEN) headers['X-Shopify-Storefront-Access-Token'] = MANUAL_TOKEN;
  else {
    try { headers['X-Shopify-Storefront-Access-Token'] = await resolveStorefrontToken(); }
    catch (e) { return res.json({ ok: false, stage: 'token', error: e.message }); }
  }
  try {
    const r = await fetch(STOREFRONT_ENDPOINT, {
      method: 'POST', headers,
      body: JSON.stringify({ query: '{ shop { name } products(first:1){ edges { node { title handle } } } }' }),
    });
    const data = await r.json();
    const denied = data.errors && data.errors.some(e => e.extensions && /ACCESS_DENIED|UNAUTHORIZED/.test(e.extensions.code));
    return res.json({
      ok: !data.errors,
      tokenType: PRIVATE_TOKEN ? 'private' : (MANUAL_TOKEN ? 'public' : 'auto-minted'),
      shop: data.data && data.data.shop ? data.data.shop.name : null,
      productSample: data.data && data.data.products ? data.data.products.edges.map(e => e.node) : null,
      hint: denied ? 'Token reached Shopify but scopes are not live yet — Save + Release a version with the unauthenticated_* scopes, then regenerate the token.' : undefined,
      errors: data.errors,
    });
  } catch (e) {
    return res.json({ ok: false, stage: 'network', error: e.message });
  }
}

// Server-side Storefront query (used by the sitemap route). Returns data or null.
async function storefrontQuery(query, variables) {
  let authHeader;
  if (PRIVATE_TOKEN) authHeader = { 'Shopify-Storefront-Private-Token': PRIVATE_TOKEN };
  else if (MANUAL_TOKEN) authHeader = { 'X-Shopify-Storefront-Access-Token': MANUAL_TOKEN };
  else {
    try { authHeader = { 'X-Shopify-Storefront-Access-Token': await resolveStorefrontToken() }; }
    catch (e) { return null; }
  }
  try {
    const r = await fetch(STOREFRONT_ENDPOINT, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeader),
      body: JSON.stringify({ query, variables: variables || {} }),
    });
    const json = await r.json();
    return json.errors ? null : json.data;
  } catch (e) { return null; }
}

module.exports = { shopifyProxy, shopifyHealth, storefrontQuery, STOREFRONT_ENDPOINT, SHOP_DOMAIN, API_VERSION };
