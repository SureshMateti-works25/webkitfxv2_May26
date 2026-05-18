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

## Azure Static Web App

| Resource | Value |
|----------|--------|
| SWA name | `swa-cafe-dev` |
| URL | https://icy-bay-016ba6000.7.azurestaticapps.net |
| Resource group | `rg-nistta-prod` |
| Workflows | `.github/workflows/azure-swa-cafe.yml`, `azure-static-web-apps-icy-bay-016ba6000.yml` |

Provision (or re-print token instructions):

```powershell
.\scripts\create-azure-swa-cafe.ps1 -SetGitHubSecrets
```

GitHub secrets: `AZURE_STATIC_WEB_APPS_API_TOKEN_CAFE`, `AZURE_STATIC_WEB_APPS_API_TOKEN_ICY_BAY_016BA6000`, plus shared `VITE_COMMERCE_API_URL`. Build sets `VITE_CATALOG_APPLICATION_TYPE_ID=app_cafe`.

Add the SWA URL to **Commerce.Api** CORS (`appsettings.Production.json`) **and** App Service platform CORS:

```powershell
.\scripts\sync-commerce-api-cors-azure.ps1
```

Set GitHub secret `VITE_COMMERCE_API_URL` to your App Service URL (e.g. `https://commerce-api-webkitfx-dev-a6asafebfmgcctak.southindia-01.azurewebsites.net`), then redeploy the storefront.

## Application type (storefront scope)

Default storefront scope: **`application_type`** lookup row **`app_cafe`** (`VITE_CATALOG_APPLICATION_TYPE_ID`). Products store the resolved **`pt_cafe`** on `product_type_id` (override with `VITE_STOREFRONT_PRODUCT_TYPE_ID`). Seed **Application type → Categories → menu products** in Admin → Lookups.

## Extending

1. Add screen copy in `config/screens/<id>.json`.
2. Register route in `config/routes.json`.
3. Add implementation in `implementations/registry.tsx` (or use `template: "shellCopy"`).
4. New form: `config/forms/<id>.json` + `getForm()` entry.
