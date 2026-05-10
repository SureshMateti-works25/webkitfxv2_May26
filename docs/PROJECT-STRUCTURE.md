# Project structure: app, core engine, and API

This document maps **folders**, **where screens and rules live**, **data model artifacts**, and how **`@webkitfxv2/core-engine`**, **`@webkitfxv2/react-renderer`**, and **`Commerce.Api`** fit together.

For backend service boundaries only, see [`services/ARCHITECTURE.md`](../services/ARCHITECTURE.md). **Audit trail (DB + action codes):** [`AUDIT-LOGGING.md`](./AUDIT-LOGGING.md).

---

## 1. Monorepo layout (top level)

| Path | Role |
|------|------|
| `apps/sarees` | SareeCart host: routes, shell chrome, JSON-driven forms & copy |
| `apps/demo` | Small Vite demo for `JsonForm` |
| `packages/core-engine` | **`@webkitfxv2/core-engine`** — form model, paths, validation, conditions, engine |
| `packages/react-renderer` | **`@webkitfxv2/react-renderer`** — `JsonForm`, layout renderer, default widgets |
| `services/WebkitFx.Platform` | Shared .NET: tenancy, errors, paging, `IMediaStorage` |
| `services/commerce-api` | **`Commerce.Api`** — commerce / portal HTTP API (auth, product catalog routes, media, inventory) |
| `scripts/` | Automation (e.g. `commerce-api-smoke.mjs`) |
| `docs/` | This and other technical docs |

---

## 2. Sarees app (`apps/sarees`)

### 2.1 Screens vs chrome

| Area | Folder | What lives here |
|------|--------|-----------------|
| **Screens (route bodies)** | `src/pages/` | One component per primary route: `HomePage`, `LoginPage`, `ShopperSignupPage`, `VendorSignupPage`, `LandingSections`, `DocStubPage` (placeholders). Screens compose **shell copy**, **`JsonForm`**, and **API clients** (`src/lib/commerceApi.ts`). |
| **App chrome** | `src/shell/` | `AppChrome` (outlet + layout), `Header`, `Footer`, `Breadcrumbs` — navigation, branding, auth menu; driven by config where possible. |
| **Auth glue** | `src/auth/` | `AuthContext` — session state (anonymous / guest / signed-in), token holder, `sessionStorage` when “remember me”; not a replacement for server-side auth. |

Routes are declared in `src/App.tsx` (`react-router-dom`). Anything under `<Route element={<AppChrome />}>` shares header/footer/breadcrumbs.

### 2.2 Business rules and validations (JSON-first)

Business and field rules for **forms** are expressed in **`src/config/forms/*.json`**, not in React components.

| File | Purpose |
|------|---------|
| `login.json` | Sign-in: `credentials.loginName`, `credentials.password`, `session.rememberMe`; **rules** on fields (`required`, `minLength`, …). |
| `shopper-signup.json` | Shopper: credentials + profile + address; includes **`eqPath`** (confirm password), **patterns** (mobile, PIN). |
| `vendor-signup.json` | Vendor: credentials + GST, address, contacts; same rule kinds. |
| `forms/index.ts` | Exports typed `FormDefinition` objects for pages to import. |

At **submit** time, `@webkitfxv2/react-renderer`’s `JsonForm` uses **`@webkitfxv2/core-engine`** to validate; invalid forms do not call `onSubmit`. **Server-side** validation for auth and catalog data remains in **Commerce.Api** (HTTP 400, etc.).

**Summary:** *Client validation / visibility* → JSON + core-engine; *authoritative rules* → API + database.

### 2.3 Data model in the app (two layers)

| Artifact | Location | Nature |
|----------|----------|--------|
| **Canonical example / contract** | `src/config/catalog-domain-model.example.json` | Rich **v2.x** catalog document: `source` (products, SKUs, facets, promotions, …), `derived`, `analytics`, `engagement`, `localization`. **Not** loaded by the shell at runtime; use as spec or seed reference. |
| **Runtime commerce data** | **Commerce.Api** + Postgres | Live tenants, catalog listing entities, `portal_users`, media keys, inventory, JWT auth. The Sarees app talks to the API via **`src/lib/commerceApi.ts`** (auth today; catalog calls can follow the same pattern). |
| **Shell & marketing model** | `src/config/shell.json` + `getShell.ts` / `shell.types.ts` | App name, nav, breadcrumbs, footer, landing sections, **screen titles and login marketing copy** — UI content and IA, not OLTP catalog rows. |

---

## 3. Core engine (`packages/core-engine`)

Package name: **`@webkitfxv2/core-engine`**. Framework-agnostic **TypeScript** (no React).

| Module (`src/`) | Responsibility |
|-----------------|----------------|
| **`types.ts`** | `FormDefinition`, field defs, layout nodes, rule/condition shapes. |
| **`paths.ts`** | Dot-path read/write into nested values (e.g. `credentials.password`). |
| **`layout.ts`** | Layout tree helpers (stack, grid, regions, field ids). |
| **`defaults.ts`** | Initial values from field defaults and structure. |
| **`validation.ts`** | **Field rules**: `required`, `minLength`, `maxLength`, `pattern`, `eqPath`, etc.; produces issues for `JsonForm`. |
| **`conditions.ts`** | **`visibleWhen` / `enabledWhen`** — evaluate predicates against current values. |
| **`engine.ts`** | **`createJsonEngine`** — wires form + templates + context (rules, conditions); **`validate`**, **`initialValues`**, etc. |
| **Tests** | `*.test.ts` — Vitest coverage for validation, conditions, paths. |

**Rule of thumb:** Anything you can express as **JSON field rules** or **conditions** should live in the form definition; extend **`validation.ts`** / **`conditions.ts`** only when a *new* rule **kind** is needed.

---

## 4. React renderer (`packages/react-renderer`)

Package name: **`@webkitfxv2/react-renderer`**.

| Module (`src/`) | Responsibility |
|-----------------|----------------|
| **`JsonForm.tsx`** | Hosts engine, runs validation on submit, renders layout + actions slot. |
| **`LayoutRenderer.tsx`** / **`FieldBlock.tsx`** | Maps layout JSON to React structure. |
| **`defaultWidgets.tsx`** | Built-in widgets (`text`, `password`, `email`, `checkbox`, …) keyed by `field.widget`. |
| **`FormContext.tsx`** | Field values and setters for custom children. |
| **`fieldProps.ts`** / **`widgetTypes.ts`** | Allowed props and typing for widgets. |
| **`injectedStyles.ts`** | Minimal default CSS hooks (e.g. checkbox row). |

The **app** supplies **form JSON** and optional **custom widget registry** (Sarees uses defaults today).

---

## 5. API layer (`services/`)

### 5.1 Layer names vs what actually runs

| Layer (by purpose) | Where it lives | Exposes HTTP? |
|--------------------|----------------|---------------|
| **Shared API infrastructure** | `services/WebkitFx.Platform/` (class library referenced by services) | No — not a host; middleware/helpers only |
| **Domain commerce backend** | `services/commerce-api/Commerce.Api/` | **Yes** — JWT auth, Postgres, `/api/v1/...` |
| **Form model + validation** | `packages/core-engine` → **`@webkitfxv2/core-engine`** | **No** — TypeScript library used by the SPA (and tests); form JSON is bundled or static |
| **Form UI** | `packages/react-renderer` → **`@webkitfxv2/react-renderer`** | **No** — React components |

**`Commerce.Api` vs `/api/v1/catalog/*`:** the **assembly** is the commerce/portal host. **`Commerce.Api.Catalog`** is the **code namespace** for product listing (PLP, facets). Public routes under `/api/v1/catalog/...` are the browsable catalog API surface — not the old service folder name.

**There is no `JsonCoreEngine.Api` (and usually none is required):** validation and `FormDefinition` shape are handled **in the browser** by `core-engine`. You would add a **separate** HTTP surface only for scenarios such as: loading form JSON from a CMS/DB, server-side validation of the same rules, or a **BFF** that aggregates many backends for one SPA. That service would not be “the core engine” renamed — it would be an **application or integration layer** that might *call* or *embed* similar rules if you choose.

**“App API” in typical architectures:** often means a **backend-for-frontend (BFF)** per client. Sarees today calls **`Commerce.Api` directly** for auth; there is no dedicated BFF in the monorepo.

### 5.2 `WebkitFx.Platform`

Shared **.NET 10** library for *all* HTTP services:

- **Tenancy:** `X-Tenant-Id`, `ITenantContext`, middleware.
- **Errors:** `ProblemDetails` / `IExceptionHandler` pipeline.
- **Paging:** `PagedResult<T>`, `PageRequest`.
- **Media:** `IMediaStorage` + local disk implementation (swap for cloud in production).

No EF Core, no domain tables — **cross-cutting only**.

### 5.3 `Commerce.Api` (commerce HTTP service)

ASP.NET Core **minimal API** + **EF Core** + **PostgreSQL**.

| Area | Folder / pattern | Contents |
|------|------------------|----------|
| **Bootstrap** | `Program.cs` | Middleware, CORS, JWT, static files, endpoint registration. |
| **Auth** | `Auth/` | JWT options, issuer, `AddCommerceJwtAuthentication`, `PortalJwtIssuer`. |
| **Persistence** | `Data/` | `CommerceDbContext`, `CommerceDevDataSeeder`. |
| **Domain tables** | `Entities/` | Tenants, categories, products, facets, collections, SKUs, media, inventory, `PortalUser`, … |
| **HTTP features** | `Features/` | `AuthEndpoints`, `MediaEndpoints`, `LocationInventoryEndpoints`, `DevJwtEndpoints`. |
| **Catalog reads** | `Catalog/` | PLP queries, DTOs, `MapCatalogV1` (product **catalog** bounded context). |
| **Infrastructure** | `Infrastructure/` | e.g. EF-specific exception handler. |
| **Migrations** | `Migrations/` | EF schema history. |

**Public surface:** `/api/v1/auth/*`, `/api/v1/catalog/*`, `/api/v1/media/*`, `/api/v1/locations`, `/api/v1/inventory/*`, etc. Details and smoke tests: `services/commerce-api/Commerce.Api/README.md`.

---

## 6. End-to-end data flow (mental model)

```text
shell.json / forms/*.json  ──►  core-engine (validate, conditions)
                                    │
                                    ▼
                              react-renderer (JsonForm UI)
                                    │
                                    ▼
         commerceApi.ts  ────────►  Commerce.Api  ──►  PostgreSQL
         (auth; PLP later)

catalog-domain-model.example.json  ──►  documentation / parity target for DB + API evolution (not read by Vite shell today)
```

---

## 7. Where to add what (quick reference)

| Need | Put it in |
|------|-----------|
| New **route / screen** | `apps/sarees/src/pages/`, route in `App.tsx` |
| New **nav / footer / screen title** | `apps/sarees/src/config/shell.json` + types if needed |
| New **form** or field **rules** | `apps/sarees/src/config/forms/*.json` + `forms/index.ts` |
| New **rule kind** (e.g. new validator) | `packages/core-engine/src/validation.ts` (+ tests) |
| New **widget** | Prefer extend `packages/react-renderer`; register from app if custom |
| **Catalog contract / example** | `apps/sarees/src/config/catalog-domain-model.example.json` (or split docs later) |
| **REST + DB** (auth, catalog, media, inventory) | `services/commerce-api/Commerce.Api` (+ migration) |
| **Optional BFF / form-definition API** | New service under `services/` (not `core-engine` — that stays a TS library) |
| **Shared API behavior** | `services/WebkitFx.Platform` |

---

## 8. Related commands

| Command | Purpose |
|---------|---------|
| `npm run dev:sarees` | Sarees + Vite |
| `npm run api:commerce` | Run Commerce.Api (`api:catalog` → same) |
| `npm run test:commerce-api` | Smoke: signup, login, catalogue HTTP checks (`test:catalog-api` → same) |
| `npm run test` | Core-engine unit tests |
