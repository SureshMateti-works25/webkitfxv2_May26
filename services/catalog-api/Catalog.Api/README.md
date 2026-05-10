# Catalog.Api

ASP.NET Core **.NET 10** minimal API with **PostgreSQL** via **EF Core** + **Npgsql**. Uses shared **`WebkitFx.Platform`** (tenancy, errors, `IMediaStorage`).

## Prerequisites

- [.NET SDK](https://dotnet.microsoft.com/download) 10.x
- Docker (optional, for local Postgres)

## Database

From `services/catalog-api`:

```powershell
docker compose up -d
```

Postgres listens on **localhost:55432** (see `docker-compose.yml`). Connection string name: **`Catalog`** (`ConnectionStrings:Catalog`).

## Run API

```powershell
cd services/catalog-api/Catalog.Api
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

Responses use camelCase: `accessToken`, `tokenType`, `expiresIn`, `userId`, `email`, `role`.  
Users are stored in **`portal_users`** (tenant **`t1`** for now) with ASP.NET Core **password hashing**.

**CORS:** configured for `http://localhost:5175` (Sarees Vite dev). Add origins under **`Cors:Origins`**.

## Authentication (JWT)

- **HS256** with symmetric key from config: **`Jwt:SigningKey`** (UTF-8, **≥ 32 bytes**), **`Jwt:Issuer`**, **`Jwt:Audience`**.
- Override in production with **User Secrets** or **`Jwt__SigningKey`** (environment).
- **Protected routes:** `POST /api/v1/media/assets`, `POST /api/v1/tenants` require a valid **`Authorization: Bearer`** token. Catalog reads (PLP, facets, locations, inventory GET) stay **anonymous** unless you add policies later.
- **Development only:** `POST /api/v1/dev/jwt` with optional JSON `{ "subject": "u1", "role": "admin", "expiresHours": 8 }` returns `{ "access_token", "token_type", "expires_in" }` signed with the same key as the API.

## Tenant resolution

Prefer header **`X-Tenant-Id: t1`**. `tenantId` query still works for quick tests. Catalog routes return **400** if neither is set.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness |
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
| POST | `/api/v1/media/assets` | Multipart upload (`file`); optional form `productId`, `role` |
| GET | `/api/v1/media/assets` | List assets for tenant |
| GET | `/api/v1/products/{productId}/media` | Product media rows + public URLs |

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

## Smoke tests (from monorepo root)

Requires **Catalog.Api running** and **Postgres migrated** (dev seed with `p_kj001` / `cat_kan` for catalog assertions).

```powershell
# Full: health → register (unique email) → login → catalog + inventory (bearer)
npm run test:catalog-api

# Auth only
npm run test:catalog-api:auth

# Catalogue only (no register; optional login if SMOKE_EMAIL is set)
npm run test:catalog-api:catalog
```

Environment:

| Variable | Default |
|----------|---------|
| `CATALOG_API_URL` | `http://localhost:5055` |
| `TENANT_ID` | `t1` |
| `SMOKE_EMAIL` | _(unset — register uses a unique email)_ |
| `SMOKE_PASSWORD` | `SmokeTest_Passw0rd!` |

Script: `scripts/catalog-api-smoke.mjs`.

## Migrations

```powershell
cd services/catalog-api/Catalog.Api
dotnet ef migrations add <Name>
dotnet ef database update
```

Install tool once: `dotnet tool install -g dotnet-ef`

## Configuration

- `ConnectionStrings__Catalog`
- `Media__RootPath`, `Media__PublicPathPrefix`
- `Jwt__SigningKey`, `Jwt__Issuer`, `Jwt__Audience`

See also: `services/ARCHITECTURE.md`.
