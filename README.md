# webkitfxv2_May26

Working folder for the **JSON core engine** (`@webkitfxv2/core-engine`): layouts + templates, validation rules, conditions (`visibleWhen` / `enabledWhen`), path helpers.

## Prerequisites

- Node.js 18+
- [.NET SDK](https://dotnet.microsoft.com/download) 10.x (for **Catalog.Api** + PostgreSQL)

## Commands

```powershell
cd D:\workspace\personal\Reactjs\webkitfxv2_May26
npm install
npm run build
npm run test
```

`npm run check` runs build then tests.

**Catalog.Api smoke** (with API + Postgres up): `npm run test:catalog-api` — see `services/catalog-api/Catalog.Api/README.md`.

**Demo UI:** `npm run dev` builds the libraries, then starts Vite for `apps/demo` (sample `JsonForm` in the browser).

**SareeCart app:** `npm run dev:sarees` builds libraries then runs `apps/sarees` (vendor/shopper signup, login, guest, JSON-driven shell).

**Catalog API (.NET + Postgres):** start Postgres with `docker compose -f services/catalog-api/docker-compose.yml up -d`, then `npm run api:catalog` or `dotnet run --project services/catalog-api/Catalog.Api/Catalog.Api.csproj`. Details in `services/catalog-api/Catalog.Api/README.md`.

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
