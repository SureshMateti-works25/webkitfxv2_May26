# webkitfxv2_May26

Working folder for the **JSON core engine** (`@webkitfxv2/core-engine`): layouts + templates, validation rules, conditions (`visibleWhen` / `enabledWhen`), path helpers.

**Repo map (Sarees screens, JSON forms/rules, data model artifacts, core engine, API):** [`docs/PROJECT-STRUCTURE.md`](docs/PROJECT-STRUCTURE.md).

## Prerequisites

- Node.js 18+
- [.NET SDK](https://dotnet.microsoft.com/download) 10.x (for **Commerce.Api** + PostgreSQL)

## Commands

```powershell
cd D:\workspace\personal\Reactjs\webkitfxv2_May26
npm install
npm run build
npm run test
```

`npm run check` runs build then tests.

**Commerce.Api smoke** (with API + Postgres up): `npm run test:commerce-api` — see `services/commerce-api/Commerce.Api/README.md`. (`npm run test:catalog-api` is a deprecated alias.)

**Demo UI:** `npm run dev` builds the libraries, then starts Vite for `apps/demo` (sample `JsonForm` in the browser).

**SareeCart app:** `npm run dev:sarees` builds libraries then runs `apps/sarees` (vendor/shopper signup, login, guest, JSON-driven shell).

### Reliable local stack (Windows): Sarees + Commerce.Api + Postgres

Use one command from the repo root (Docker Desktop must be running):

```powershell
npm run dev:local
```

(`dev:local` and `dev:sarees:stack` are the same script.) It will:

1. **Stop whatever is listening on port 5055** so `dotnet build` never hits a locked `Commerce.Api.dll`.
2. Start **Postgres** via `docker compose` (skip with `npm run dev:local -- -SkipDocker` if the DB is already up).
3. Open a **new window** that builds and runs **Commerce.Api** on **http://localhost:5055**.
4. **Wait until `/health` returns 200** before starting Vite (avoids proxy 404 while the API is still starting).
5. Run **Sarees** in the current window; `/api` is proxied to 5055.

Other helpers:

| Command | Purpose |
|--------|---------|
| `npm run stop:commerce-api` | Free port **5055** only (stop stale API) |
| `npm run api:commerce:exec:fresh` | Stop 5055, then build + `dotnet exec` in **this** window |
| `npm run api:commerce:watch` | Stop 5055, then **`dotnet watch run`** — **restarts Commerce.Api automatically** when you save C# changes |
| `npm run api:commerce:exec` | Build + exec without stopping (fails if DLL locked) |

**You still need:** Node 18+, .NET 10 SDK, **Docker Desktop** (for Postgres), and a one-time `npm install`. No extra npm packages are required for this flow.

**Commerce API only:** start Postgres with `docker compose -f services/commerce-api/docker-compose.yml up -d`, then `npm run api:commerce` or `dotnet run --project services/commerce-api/Commerce.Api/Commerce.Api.csproj`. If `dotnet run` fails with **Access denied** on Windows, use **`npm run api:commerce:exec`** or **`npm run api:commerce:exec:fresh`** if the DLL is locked. (`npm run api:catalog` forwards to `api:commerce`.) Details in `services/commerce-api/Commerce.Api/README.md`.

**Shared API platform:** `services/WebkitFx.Platform` (tenancy, errors, paging, `IMediaStorage`). How services fit together: `services/ARCHITECTURE.md`.

## Package

| Path | NPM name |
|------|----------|
| `packages/core-engine` | `@webkitfxv2/core-engine` |
| `packages/react-renderer` | `@webkitfxv2/react-renderer` |
| `apps/demo` | `webkitfxv2-demo` (Vite host) |
| `apps/sarees` | `sarees-market` (e-commerce shell + JSON forms) |

### Usage (after build)

```ts
import { createJsonEngine, type FormDefinition } from "@webkitfxv2/core-engine";

const form: FormDefinition = { /* ... */ };
const engine = createJsonEngine(form, { templates, context: { rules, conditions } });
const values = engine.initialValues();
const issues = await engine.validate(values);
```

Widget and domain-specific rule ids are resolved in your **app** registries only.

### React UI (`@webkitfxv2/react-renderer`)

`JsonForm` renders the resolved layout with a **default widget registry** (text, number, date, select, radio, file, …). See `packages/react-renderer/README.md` for `widget` ids and `field.props` keys.
