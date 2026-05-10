# Catalog.Api

ASP.NET Core **.NET 10** minimal API with **PostgreSQL** via **EF Core** + **Npgsql**.

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

- **Development:** applies EF migrations on startup, seeds tenant **`t1`** when empty, then seeds **sample categories / products / collection / facets** when `categories` is empty.
- **OpenAPI:** `/openapi/v1.json` in Development.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness |
| GET | `/api/v1/tenants` | List tenants |
| POST | `/api/v1/tenants` | Create tenant (JSON body: `id`, `name`, `slug`) |
| GET | `/api/v1/catalog/categories` | Category tree data (`tenantId` required) |
| GET | `/api/v1/catalog/collections` | Active collections for tenant |
| GET | `/api/v1/catalog/products` | **PLP:** list/card payload (paged); see query params below |
| GET | `/api/v1/catalog/categories/{categoryId}/products` | Same as products with `categoryId` preset |
| GET | `/api/v1/catalog/collections/{collectionId}/products` | Same as products with `collectionId` preset |
| GET | `/api/v1/catalog/facet-options` | Filter metadata + value counts for current scope |

### `GET /api/v1/catalog/products` query parameters

| Param | Description |
|-------|-------------|
| `tenantId` | **Required.** e.g. `t1` |
| `categoryId` | Filter by category (use with `includeSubtree` for PLP under a nav branch) |
| `collectionId` | Filter by manual collection |
| `includeSubtree` | `true` / `1` — include descendant categories when `categoryId` is set |
| `q` | Search (case-insensitive) over `TitleDisplay` and `SearchText` |
| `filters` | Facets: comma-separated `attributeDefId:attributeValueId`, e.g. `attr_color:av_maroon` |
| `sort` | `published_desc` (default), `published_asc`, `title_asc`, `price_asc`, `price_desc` |
| `view` | Echo only: `list` or `card` (same JSON; client chooses layout) |
| `page` | 1-based (default `1`) |
| `pageSize` | Default `24`, max `100` |

**Examples**

- Card/list PLP for Kanjeevaram subtree:  
  `/api/v1/catalog/products?tenantId=t1&categoryId=cat_kan&includeSubtree=true`
- Collection rail:  
  `/api/v1/catalog/collections/col_pongal/products?tenantId=t1`
- Search + colour facet:  
  `/api/v1/catalog/products?tenantId=t1&q=zari&filters=attr_color:av_maroon`
- Facet chips (counts respect category/collection/search, not other facets):  
  `/api/v1/catalog/facet-options?tenantId=t1&categoryId=cat_silk&includeSubtree=true`

## Migrations

```powershell
cd services/catalog-api/Catalog.Api
dotnet ef migrations add <Name>
dotnet ef database update
```

Install tool once: `dotnet tool install -g dotnet-ef`

## Configuration overrides

- Environment variable: `ConnectionStrings__Catalog`
