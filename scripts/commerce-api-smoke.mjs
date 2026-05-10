/**
 * Smoke tests for Commerce.Api: health, signup, login, catalogue reads.
 *
 * Usage:
 *   node scripts/commerce-api-smoke.mjs           # full flow (register → login → catalog)
 *   node scripts/commerce-api-smoke.mjs auth      # health + register + login only
 *   node scripts/commerce-api-smoke.mjs catalog   # catalog GETs + optional login if SMOKE_EMAIL set
 *
 * Env:
 *   COMMERCE_API_URL   default http://localhost:5055 (CATALOG_API_URL still accepted)
 *   TENANT_ID          default t1
 *   SMOKE_EMAIL        optional; if set, register is skipped and this email is used for login
 *   SMOKE_PASSWORD     default SmokeTest_Passw0rd!
 */

const BASE = (process.env.COMMERCE_API_URL ?? process.env.CATALOG_API_URL ?? "http://localhost:5055").replace(
  /\/$/,
  ""
);
const TENANT = process.env.TENANT_ID ?? "t1";
const FIXED_EMAIL = process.env.SMOKE_EMAIL?.trim();
const PASSWORD = process.env.SMOKE_PASSWORD ?? "SmokeTest_Passw0rd!";

function log(step, msg, extra) {
  const line = extra !== undefined ? `${msg} ${JSON.stringify(extra)}` : msg;
  console.log(`[${step}] ${line}`);
}

function fail(step, msg, res, body) {
  console.error(`[${step}] FAIL: ${msg}`, res ? `HTTP ${res.status}` : "", body ?? "");
  process.exit(1);
}

async function json(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { _raw: text };
  }
}

const tenantHeaders = {
  "X-Tenant-Id": TENANT,
  Accept: "application/json",
};

async function testHealth() {
  const res = await fetch(`${BASE}/health`);
  const data = await json(res);
  if (!res.ok) fail("health", "expected 200", res, data);
  if (data.status !== "ok") fail("health", "expected status ok", res, data);
  if (data.service && data.service !== "commerce-api") {
    fail("health", `expected service commerce-api, got ${data.service}`, res, data);
  }
  log("health", "ok", data);
}

async function testRegister(email) {
  const res = await fetch(`${BASE}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      email,
      password: PASSWORD,
      role: "shopper",
      profile: { source: "commerce-api-smoke" },
    }),
  });
  const data = await json(res);
  if (res.status === 409) {
    log("signup", "email already exists (ok for re-runs)");
    return null;
  }
  if (!res.ok) fail("signup", "register failed", res, data);
  if (!data.accessToken) fail("signup", "missing accessToken", res, data);
  log("signup", "registered", { email, userId: data.userId, role: data.role });
  return data;
}

async function testLogin(email) {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const data = await json(res);
  if (!res.ok) fail("login", "login failed", res, data);
  if (!data.accessToken) fail("login", "missing accessToken", res, data);
  log("login", "ok", { email, role: data.role });
  return data.accessToken;
}

async function testCatalog(accessToken) {
  const withBearer = {
    ...tenantHeaders,
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };

  let res = await fetch(`${BASE}/api/v1/catalog/categories`, { headers: tenantHeaders });
  let data = await json(res);
  if (!res.ok) fail("catalog", "categories", res, data);
  log("catalog", `categories: ${Array.isArray(data) ? data.length : "?"} rows`);

  res = await fetch(`${BASE}/api/v1/catalog/collections`, { headers: tenantHeaders });
  data = await json(res);
  if (!res.ok) fail("catalog", "collections", res, data);
  log("catalog", `collections: ${Array.isArray(data) ? data.length : "?"} rows`);

  const qs = new URLSearchParams({
    categoryId: "cat_kan",
    includeSubtree: "true",
    view: "card",
    page: "1",
    pageSize: "10",
  });
  res = await fetch(`${BASE}/api/v1/catalog/products?${qs}`, { headers: tenantHeaders });
  data = await json(res);
  if (!res.ok) fail("catalog", "products", res, data);
  const total = data.totalCount ?? data.TotalCount;
  const items = data.items ?? data.Items ?? [];
  log("catalog", "products (cat_kan subtree)", { totalCount: total, pageItems: items.length });

  res = await fetch(
    `${BASE}/api/v1/catalog/facet-options?categoryId=cat_silk&includeSubtree=true`,
    { headers: tenantHeaders }
  );
  data = await json(res);
  if (!res.ok) fail("catalog", "facet-options", res, data);
  const facets = data.facets ?? data.Facets ?? [];
  log("catalog", `facet-options: ${facets.length} groups`);

  res = await fetch(`${BASE}/api/v1/locations`, { headers: tenantHeaders });
  data = await json(res);
  if (!res.ok) fail("catalog", "locations", res, data);
  log("catalog", `locations: ${Array.isArray(data) ? data.length : "?"} rows`);

  if (accessToken) {
    res = await fetch(`${BASE}/api/v1/inventory/positions?skuId=sku_kj_mar_g3`, {
      headers: withBearer,
    });
    data = await json(res);
    if (!res.ok) fail("catalog", "inventory (bearer)", res, data);
    log("catalog", `inventory positions: ${Array.isArray(data) ? data.length : "?"} rows`);
  } else {
    log("catalog", "inventory (bearer) skipped — no token");
  }
}

async function runAuth(email) {
  await testHealth();
  if (!FIXED_EMAIL) await testRegister(email);
  return testLogin(FIXED_EMAIL || email);
}

async function main() {
  const mode = (process.argv[2] ?? "all").toLowerCase();
  console.log(`Commerce.Api smoke — ${BASE} tenant=${TENANT} mode=${mode}\n`);

  const email =
    FIXED_EMAIL ||
    `smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.webkitfx.local`;

  if (mode === "auth") {
    await runAuth(email);
    console.log("\nAuth checks passed.");
    return;
  }

  if (mode === "catalog") {
    const token = FIXED_EMAIL ? await testLogin(FIXED_EMAIL) : null;
    await testCatalog(token);
    console.log("\nCatalog checks passed.");
    return;
  }

  if (mode === "all") {
    const token = await runAuth(email);
    await testCatalog(token);
    console.log("\nAll checks passed.");
    return;
  }

  console.error("Unknown mode. Use: all | auth | catalog");
  process.exit(1);
}

main().catch((e) => {
  const refused = e?.cause?.code === "ECONNREFUSED" || e?.code === "ECONNREFUSED";
  if (refused) {
    console.error(
      `Cannot reach ${BASE}. Start Postgres (docker compose in services/commerce-api), then: npm run api:commerce`
    );
  } else {
    console.error(e);
  }
  process.exit(1);
});
