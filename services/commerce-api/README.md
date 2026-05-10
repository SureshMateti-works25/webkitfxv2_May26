# Commerce API service

**`Commerce.Api`** — ASP.NET Core + PostgreSQL (EF Core): portal auth, product **catalog** routes, media, inventory. See [Commerce.Api/README.md](./Commerce.Api/README.md).

- **`../WebkitFx.Platform/`** — shared tenancy, errors, paging, `IMediaStorage` (reference from any new .NET service).
- **`Commerce.Api/`** — host project.
- **`docker-compose.yml`** — local Postgres on host port **54330** → container `5432` (database/user `catalog` unchanged).
- **`Commerce.slnx`** — builds Platform + Commerce.Api; run `dotnet ef` from `Commerce.Api/`.

```powershell
docker compose up -d
cd Commerce.Api
dotnet run
```

Docs: [`docs/PROJECT-STRUCTURE.md`](../../docs/PROJECT-STRUCTURE.md), [`services/ARCHITECTURE.md`](../ARCHITECTURE.md).
