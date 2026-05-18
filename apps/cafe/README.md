# Nistta Café (`cafe-market`)

Full café storefront on **`@webkitfxv2/core-engine`**, **`@webkitfxv2/react-renderer`**, and **`@webkitfxv2/commerce-screens`** with **`Commerce.Api`**.

## Architecture

| Layer | Location | Responsibility |
|--------|----------|----------------|
| **Routes** | `src/config/routes.json` | Path → `implementation` or `shellCopy` template |
| **Screen copy** | `src/config/screens/*.json` + `shell.json` | Titles, ledes, PDP sections (no copy in route components) |
| **Forms** | `src/config/forms/*.json` | JsonForm definitions |
| **Templates** | `@webkitfxv2/commerce-screens` | `ShellCopyScreen`, `JsonFormScreen`, `CatalogSectionHost`, `createRouteElements` |
| **Implementations** | `src/implementations/registry.tsx` | Maps id → page component (API + layout only) |
| **Pages** | `src/pages/*` | Host-specific UI; read `getScreenConfig()` / forms JSON |

`App.tsx` only wires providers and the route manifest — no hardcoded route list.

## Theme

Light **coffee** palette (`shell-root--cafe` in `src/cafe-theme.css`). Sarees keeps the default warm brown in `app-shell.css`; groceries uses green overrides in its `index.css`.

## Commands

```powershell
# From repo root
npm run dev:cafe
npm run build:cafe
```

Dev server: **http://localhost:5190** (proxies `/api` and `/media` to Commerce.Api on **5055**).

## Application type (storefront scope)

Default storefront scope: **`application_type`** lookup row **`app_cafe`** (`VITE_CATALOG_APPLICATION_TYPE_ID`). Products store the resolved **`pt_cafe`** on `product_type_id` (override with `VITE_STOREFRONT_PRODUCT_TYPE_ID`). Seed **Application type → Categories → menu products** in Admin → Lookups.

## Extending

1. Add screen copy in `config/screens/<id>.json`.
2. Register route in `config/routes.json`.
3. Add implementation in `implementations/registry.tsx` (or use `template: "shellCopy"`).
4. New form: `config/forms/<id>.json` + `getForm()` entry.
