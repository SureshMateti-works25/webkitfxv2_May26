# Catalog API service

- **`../WebkitFx.Platform/`** — shared tenancy, errors, paging, `IMediaStorage` (reference from any new .NET service).
- **`Catalog.Api/`** — ASP.NET Core + PostgreSQL (EF Core). See [Catalog.Api/README.md](./Catalog.Api/README.md).
- **`docker-compose.yml`** — local Postgres on port **55432**.
- **`Catalog.slnx`** — builds Platform + Catalog.Api; run `dotnet ef` from `Catalog.Api/`.

```powershell
docker compose up -d
cd Catalog.Api
dotnet run
```
