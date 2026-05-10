# Catalog API service

- **`Catalog.Api/`** — ASP.NET Core + PostgreSQL (EF Core). See [Catalog.Api/README.md](./Catalog.Api/README.md).
- **`docker-compose.yml`** — local Postgres on port **55432**.
- **`Catalog.slnx`** — `dotnet build` / `dotnet ef` from this folder.

```powershell
docker compose up -d
cd Catalog.Api
dotnet run
```
