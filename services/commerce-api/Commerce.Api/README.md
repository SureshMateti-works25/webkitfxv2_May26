# Commerce.Api

ASP.NET Core **.NET 10** minimal API with **PostgreSQL** via **EF Core** + **Npgsql**. Uses shared **`WebkitFx.Platform`** (tenancy, errors, `IMediaStorage`).

**Role:** the monorepo **commerce / portal HTTP API** — auth, browsable **catalog** (`/api/v1/catalog/*`), **media**, **inventory / locations**. Route prefix `/api/v1/catalog/*` is the **product-catalog** bounded context, not the old service name. Form JSON and `@webkitfxv2/core-engine` stay **client-side** unless you add a BFF.

**Audit trail:** security-relevant events are written to PostgreSQL **`audit_logs`** (register/login, JWT failures, missing tenant, media upload, tenant create, dev JWT, bootstrap migrate/seed in Development, EF constraint conflicts). See [`docs/AUDIT-LOGGING.md`](../../../docs/AUDIT-LOGGING.md).

## Prerequisites

- [.NET SDK](https://dotnet.microsoft.com/download) 10.x
- Docker (optional, for local Postgres)

## Database

From `services/commerce-api`:

```powershell
docker compose up -d
```

Postgres listens on **localhost:54330** (see `docker-compose.yml`; port avoids Windows reserved ranges that block 55432). Connection string key: **`Commerce`** (`ConnectionStrings:Commerce`). The database name remains **`catalog`** in docker (data volume unchanged).

## Run API

```powershell
cd services/commerce-api/Commerce.Api
dotnet run
```

- **Development:** applies EF migrations on startup; seeds tenant **`t1`**, catalog demo rows, then **locations / SKU / media rows / inventory** when those tables are empty.
- **OpenAPI:** `/openapi/v1.json` in Development.
- **Static files:** uploaded blobs under `Media:RootPath` (default `uploads/media`), URL prefix `Media:PublicPathPrefix` (default `/media/...`).

## Auth API (portal users)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/register` | No | `{ "email", "password", "role": "shopper"\|"vendor", "profile"?: object }` → JWT + user |
| POST | `/api/v1/auth/login` | No | `{ "email", "password" }` → JWT |

**Responses (register/login):** camelCase `accessToken`, `tokenType`, `expiresIn`, `userId`, `email`, `role`. Users are stored in **`portal_users`** (tenant **`t1`**) with ASP.NET Core **password hashing**. Optional **`loginDisabled`** (admin-set) blocks password login with HTTP **403** and a support message until cleared.

**Roles:** self-service registration allows **`shopper`** and **`vendor`** only. **`admin`** accounts are not created through the public register API; use Development seeding (below), database operations, or your own provisioning pipeline.

### Development: seeded site administrator

When **`DevSeed:AdminEmail`** and **`DevSeed:AdminPassword`** are set (see `appsettings.Development.json`), startup creates one **`portal_users`** row with **`role`: `admin`** if that email is not already registered. Remove or clear those keys to skip. Rotate the password before any shared environment.

### Admin API (JWT role `admin`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/admin/portal-users` | Bearer, `Admin` policy | Optional query `role=shopper\|vendor\|admin`; returns `id`, `email`, `role`, `createdAt`, `loginDisabled` for `X-Tenant-Id` |
| PATCH | `/api/v1/admin/portal-users/{userId}` | Bearer, `Admin` policy | Body `{ "loginDisabled": true \| false }` toggles password login; cannot target your own user id |

**CORS:** In **Development**, `Program.cs` allows Vite on **http://localhost:5170–5209** and **http://127.0.0.1:5170–5209** (Sarees, Groceries, alternate ports). Add more under **`Cors:Origins`** in `appsettings.Development.json` if needed.

## Authentication (JWT)

- **HS256** with symmetric key from config: **`Jwt:SigningKey`** (UTF-8, **≥ 32 bytes**), **`Jwt:Issuer`** (default `webkitfx-commerce`), **`Jwt:Audience`**.
- Override in production with **User Secrets** or **`Jwt__SigningKey`** (environment).
- **Protected routes:** `POST /api/v1/media/assets`, `POST /api/v1/tenants` require a valid **`Authorization: Bearer`** token. Catalog reads (PLP, facets, locations, inventory GET) stay **anonymous** unless you add policies later.
- **Development only:** `POST /api/v1/dev/jwt` with optional JSON `{ "subject": "u1", "role": "admin", "expiresHours": 8 }` returns `{ "access_token", "token_type", "expires_in" }` signed with the same key as the API.

## Tenant resolution

Prefer header **`X-Tenant-Id: t1`**. `tenantId` query still works for quick tests. Catalog routes return **400** if neither is set.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness (`service`: `commerce-api`) |
| GET | `/api/v1/tenants` | List tenants |
| POST | `/api/v1/tenants` | Create tenant (JSON body: `id`, `name`, `slug`) |
| GET | `/api/v1/catalog/categories` | Category tree |
| GET | `/api/v1/catalog/collections` | Active collections |
| GET | `/api/v1/catalog/products` | PLP (paged); query params below |
| GET | `/api/v1/catalog/categories/{categoryId}/products` | Category-scoped PLP |
| GET | `/api/v1/catalog/collections/{collectionId}/products` | Collection-scoped PLP |
| GET | `/api/v1/catalog/facet-options` | Facet metadata + counts |
| GET | `/api/v1/locations` | Warehouses / stores for tenant |
| GET | `/api/v1/inventory/positions` | Optional `skuId`, `locationId` filters |
| GET | `/api/v1/skus/{skuId}/inventory` | ATP by location for one SKU |
| POST | `/api/v1/media/assets` | Multipart `file`; optional `productId`, `role` (max 64 chars), `skuId` (variant image; must belong to `productId`). When `productId` is set, the JWT subject must own the product (`vendorPortalUserId`). |
| GET | `/api/v1/media/assets` | List assets for tenant |
| GET | `/api/v1/products/{productId}/media` | Product media rows + public URLs (includes `skuId` when variant-scoped) |

### Vendor products (JWT, role `vendor`)

All routes require `Authorization: Bearer` and tenant (`X-Tenant-Id` or `tenantId` query). Only rows with `vendorPortalUserId` matching the token subject are returned or mutated.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/vendor/products` | Paged list of your products (`page`, `pageSize`) |
| GET | `/api/v1/vendor/products/{productId}` | Detail |
| POST | `/api/v1/vendor/products` | Create (`title`, optional `slug`, `status` draft\|active, `categoryId`, `minPriceMinor`, `currency`) |
| PUT | `/api/v1/vendor/products/{productId}` | Update same fields; `categoryId` `""` clears category links |
| DELETE | `/api/v1/vendor/products/{productId}` | Delete |

`draft` products are omitted from the public catalogue (`GET /api/v1/catalog/products` only lists `active`).

### `GET /api/v1/catalog/products` query parameters

| Param | Description |
|-------|-------------|
| `tenantId` | Required if `X-Tenant-Id` not sent |
| `categoryId` | Filter by category (`includeSubtree` for nav branch) |
| `collectionId` | Filter by collection |
| `includeSubtree` | `true` / `1` |
| `q` | Search (`ILIKE` on title + `SearchText`) |
| `filters` | `attr_color:av_maroon,...` |
| `sort` | `published_desc` (default), `published_asc`, `title_asc`, `price_asc`, `price_desc` |
| `view` | `list` or `card` (echo only) |
| `page`, `pageSize` | Pagination (pageSize max 100) |

**Examples**

- `GET /api/v1/catalog/products` with header `X-Tenant-Id: t1` and query `categoryId=cat_kan&includeSubtree=true`
- Upload: `POST /api/v1/media/assets` header `X-Tenant-Id: t1`, body multipart `file=@photo.jpg`, optional `productId`, `role=hero`

## Troubleshooting

**`GET /api/v1/vendor/products` returns 404 (Sarees “My products” / vendor UI).** The process listening on your API port is almost certainly an **old build** that predates vendor routes. Open `/openapi/v1.json` in Development: if you do **not** see paths under `/api/v1/vendor/`, stop every `dotnet` / Commerce.Api window on that port, rebuild, and start again (from repo root: `.\scripts\run-commerce-api.ps1`, or `npm run api:commerce`). A long-running API also **locks** `bin/.../Commerce.Api.dll`, which blocks `dotnet build` until you stop it.

## Smoke tests (from monorepo root)

Requires **Commerce.Api running** and **Postgres migrated** (dev seed with `p_kj001` / `cat_kan` for catalog assertions).

```powershell
# Full: health → register (unique email) → login → catalog + inventory (bearer)
npm run test:commerce-api

# Auth only
npm run test:commerce-api:auth

# Catalogue only (no register; optional login if SMOKE_EMAIL is set)
npm run test:commerce-api:catalog
```

`npm run test:catalog-api` still forwards to the same script (deprecated alias).

Environment:

| Variable | Default |
|----------|---------|
| `COMMERCE_API_URL` | `http://localhost:5055` (`CATALOG_API_URL` still accepted) |
| `TENANT_ID` | `t1` |
| `SMOKE_EMAIL` | _(unset — register uses a unique email)_ |
| `SMOKE_PASSWORD` | `SmokeTest_Passw0rd!` |

Script: `scripts/commerce-api-smoke.mjs`.

## Migrations

```powershell
cd services/commerce-api/Commerce.Api
dotnet ef migrations add <Name>
dotnet ef database update
```

Install tool once: `dotnet tool install -g dotnet-ef`

Open solution: `services/commerce-api/Commerce.slnx`.

## Configuration

- `ConnectionStrings__Commerce` (replaces former `ConnectionStrings__Catalog`)
- `Media__RootPath`, `Media__PublicPathPrefix`
- `Jwt__SigningKey`, `Jwt__Issuer`, `Jwt__Audience`

**Rename note:** existing **JWTs** issued before this rename used issuer `webkitfx-catalog`; new default is `webkitfx-commerce`. Re-login after upgrade. Set `Jwt__Issuer` explicitly if you need to keep validating old tokens during a transition.

See also: `services/ARCHITECTURE.md`.

## One-time demo data + media (Azure or any Postgres)

Production **does not** run `CommerceDevDataSeeder` on startup. To copy the **same demo catalog** you get locally (tenant `t1`, saree + grocery rows, lookups, tiny JPEGs for `/media` keys):

1. **GitHub secret:** `COMMERCE_DATABASE_CONNECTION_STRING` — full Npgsql string to the target Postgres (`catalog` DB). The DB must accept inbound connections from **GitHub-hosted runners** (public access + firewall; see workflow comments if using Azure).

2. **Recommended — GitHub Actions (migrate + seed in one run):**  
   **Actions → “Commerce Azure bootstrap (migrate + seed)” → Run workflow.**  
   This applies **EF migrations**, runs **Commerce.OneTimeSeed**, then uploads artifact **`commerce-seed-media-for-azure`**.  
   Download the artifact, deploy its contents under the App Service **`wwwroot/uploads/media`** tree (or use `scripts/push-commerce-seed-media-to-azure.ps1` locally with the extracted folder as `-LocalMediaRoot`), then **restart** the Web App.

   _Smaller workflows still exist:_ “Apply Commerce DB migrations” (migrate only) and “Commerce one-time demo seed” (seed only, assumes schema is current).

3. **From your machine** (writes DB + files under `SEED_MEDIA_ROOT`):

   Stop any local **Commerce.Api** first (or `npm run stop:commerce-api`), otherwise the Release build can fail with **MSB3027** because `WebkitFx.Platform.dll` is locked. `npm run seed:commerce:remote` runs that stop script on Windows before seeding.

   ```powershell
   $env:ConnectionStrings__Commerce = "Host=....postgres.database.azure.com;...;Database=catalog;..."
   $env:SEED_MEDIA_ROOT = "$(Resolve-Path .\services\commerce-api\Commerce.Api\uploads\media)"
   npm run seed:commerce:remote
   ```

   If `SEED_MEDIA_ROOT` is omitted, JPEGs go under `%TEMP%\commerce-one-time-seed-media`.

   On macOS/Linux, stop the API process yourself, then:  
   `dotnet run --project services/commerce-api/Commerce.OneTimeSeed/Commerce.OneTimeSeed.csproj -c Release`

4. **Optional admin user** (same as local): set `DevSeed__AdminEmail` and `DevSeed__AdminPassword` in the environment before running the seed tool (local or add env vars to the workflow job if you extend it).

5. **Deploy blobs to App Service** so `/media/...` returns 200 (skip if you only used the bootstrap artifact and already deployed it):

   ```powershell
   .\scripts\push-commerce-seed-media-to-azure.ps1 `
     -ResourceGroup rg-nistta-prod `
     -WebAppName commerce-api-webkitfx-dev `
     -LocalMediaRoot (Resolve-Path .\path\to\extracted\artifact\folder)
   ```

6. **Restart** the Web App after media deploy.
