# Sarees storefront + Commerce.Api (local)

## One command (recommended)

From the **repo root**:

```powershell
npm run dev:sarees:stack
```

This script (`scripts/dev-sarees-stack.ps1`):

1. Starts **Postgres** via `services/commerce-api/docker-compose.yml` (host port **54330**).
2. Opens **Commerce.Api** in a **separate** PowerShell window at **http://localhost:5055**.
3. Runs **Sarees Vite** in the current terminal (default **http://localhost:5175**).

Use the **Vite URL** in the browser for the React app. Do not bookmark `http://localhost:<vite-port>/api/...` for manual browsing: the UI uses `fetch("/api/...")`, which Vite **proxies** to the API.

## Ports

| Service        | URL                      |
|----------------|--------------------------|
| Sarees (Vite)  | http://localhost:5175    |
| Commerce.Api   | http://localhost:5055    |
| Postgres       | localhost:**54330**      |

## If `/api/...` returns 404 in the browser

- **Commerce.Api not running:** Start it on **http://localhost:5055** (`npm run api:commerce:exec`). Watch the **Vite terminal** for `[vite] /api proxy -> … failed` if the proxy cannot connect.
- **Dev:** Vite `server.proxy` forwards `/api` → `5055`. Restart Vite after changing `vite.config.ts`.
- **Preview:** `vite preview` uses `preview.proxy` in `apps/sarees/vite.config.ts` (same `/api` rule). Without it, `/api` hits the static server and returns **404**.
- **Bypass proxy:** copy `apps/sarees/.env.development.example` to `.env.development`, set `VITE_COMMERCE_API_URL=http://localhost:5055`, restart Vite (uses CORS instead of the proxy).

## API without the proxy (optional)

Set in `apps/sarees/.env`:

```env
VITE_COMMERCE_API_URL=http://127.0.0.1:5055
```

Commerce.Api **CORS** must include your Vite origin (see `Commerce.Api/appsettings.Development.json` — includes 5175–5177).

## Manual steps (same as the script)

```powershell
docker compose -f services/commerce-api/docker-compose.yml up -d
npm run api:commerce:exec
# other terminal:
npm run dev -w sarees-market
```

## Commerce.Api already running?

If a second start fails with **MSB3027 / file is locked by ".NET Host"**, stop the existing API (the other PowerShell window or the background `dotnet` process), then start again. To run **without** rebuilding (same binary): `.\scripts\run-commerce-api.ps1 -SkipBuild`.
