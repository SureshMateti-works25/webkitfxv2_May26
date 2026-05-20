# Commerce tenant & RBAC (Phase 1)

Canonical JSON for multi-tenant storefronts:

| File | Purpose |
|------|---------|
| `tenants.catalog.json` | Demo tenants upserted into PostgreSQL on Commerce.Api startup |
| `tenant-rbac.json` | Platform-wide roles, permissions, and storefront mode features |
| `rbac-overlays/*.json` | Vertical-specific permission catalog + mode features (merged by tenant `vertical`) |

## Storefront modes

- `marketplace` — shared catalog, multiple vendors (e.g. `t_foodhall`)
- `isolated_shop` — single-tenant shop (e.g. `t1`, `t_cornercup`, `t_brewlab`)

## API

- `GET /api/v1/tenants/{slug}/bootstrap` — public storefront config
- `GET /api/v1/tenants/by-host?host=` — hostname routing (Phase 1 seed)
- `GET /api/v1/tenants/{tenantId}/rbac` — RBAC manifest (includes `permissionCatalog`)
- `GET/POST/PUT/DELETE /api/v1/tenant-roles` — tenant custom roles (requires `roles:read` / `roles:manage`)
- `POST /api/v1/tenant-roles/seed-defaults` — seed app workspace default roles
- `GET/POST/PUT/DELETE /api/v1/portal-users/{id}/role-assignments` — per-user role assignment (primary drives login)
- Auth requires `X-Tenant-Id`; JWT includes `tenant_id` and `storefront_mode`

## Frontend env

```env
VITE_COMMERCE_TENANT_ID=t_cornercup
VITE_STOREFRONT_MODE=isolated_shop
VITE_STOREFRONT_VERTICAL=cafe
```
