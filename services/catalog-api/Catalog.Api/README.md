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

- **Development:** applies EF migrations on startup and seeds tenant `t1` / Acme Sarees if the table is empty.
- **OpenAPI:** `/openapi/v1.json` in Development.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness |
| GET | `/api/v1/tenants` | List tenants |
| POST | `/api/v1/tenants` | Create tenant (JSON body: `id`, `name`, `slug`) |

## Migrations

```powershell
cd services/catalog-api/Catalog.Api
dotnet ef migrations add <Name>
dotnet ef database update
```

Install tool once: `dotnet tool install -g dotnet-ef`

## Configuration overrides

- Environment variable: `ConnectionStrings__Catalog`
