# Local development (stable stack)

## One command (recommended)

From repo root (Docker Desktop running):

```powershell
npm run dev:stack
```

This will:

1. Free port **5055** (stop stale Commerce.Api)
2. Start **Postgres** on host port **54330**
3. Open **Commerce.Api** in a new terminal (`http://localhost:5055`)
4. Wait for `/health`, then verify tenant **t1** + auth smoke
5. Build workspaces and run **Sarees** (5175), **Groceries** (5183), **Café** (5190)

### Variants

| Command | What runs |
|---------|-----------|
| `npm run dev:local` | Same as `dev:stack` |
| `npm run dev:sarees:stack` | API + Sarees + Groceries (no Café) |
| `npm run dev:cafe:stack` | API + Café only |
| `npm run dev:api` | API only (Postgres + migrate + seed) |
| `npm run verify:local` | Health + tenant bootstrap + auth smoke (API must be up) |

## Prerequisites

- **Node 18+**, **.NET 10 SDK**, **Docker Desktop**
- No `COMMERCE_DATABASE_CONNECTION_STRING` in your shell pointing at Azure (run-commerce-api clears it for local)

## Ports

| Service | URL |
|---------|-----|
| Commerce.Api | http://localhost:5055 |
| Postgres | `localhost:54330` (db `catalog` / user `catalog`) |
| Sarees Vite | http://localhost:5175 |
| Groceries Vite | http://localhost:5183 |
| Café Vite | http://localhost:5190 |

## Tenant & auth (Phase 1)

- Demo data lives under tenant **`t1`** (slug `acme`).
- API default tenant: `Commerce:DefaultTenantId` = `t1` in `appsettings.Development.json`.
- Storefront apps send `X-Tenant-Id: t1` unless overridden in `.env.development`.
- In dev, API calls use **same-origin** `/api/...` (Vite proxy) — no CORS setup required.

Copy env templates (optional — café has an in-app switcher):

```powershell
copy apps\sarees\.env.example apps\sarees\.env.development
copy apps\cafe\.env.example apps\cafe\.env.development
```

### Café dev tenant switcher

In **development**, a **Tenant: …** pill appears at the bottom-left of the café app. Open it to pick `t1`, `t_cornercup`, `t_foodhall`, etc., preview bootstrap mode/features, then **Apply & reload**. Override is stored in `localStorage` (`webkitfx.cafe.devTenant`). **Reset to .env** clears the override.

## Admin login (local)

From `appsettings.Development.json` / DevSeed:

- Email: `siteadmin@example.local`
- Password: `LocalSiteAdmin!1`
- Use the storefront’s tenant (`t1` sarees/café default, `t_grocery` groceries). Dev seed creates this admin on **every active tenant**; login must match the app’s `X-Tenant-Id`.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Port 5055 in use | `npm run stop:commerce-api` then `npm run api:commerce:exec:fresh` |
| Empty catalog / 400 tenant | `npm run verify:local` — migration + catalog bootstrap on API start |
| Vite proxy errors | Start API first; check Commerce.Api window for EF/migration errors |
| Wrong database | Remove `COMMERCE_DATABASE_CONNECTION_STRING` from env; use Docker Postgres |
| DLL locked on build | `npm run stop:commerce-api` before `dotnet build` |

## Reset demo data

```powershell
npm run reset:commerce:local
npm run api:commerce:exec:fresh
```
