# Backend architecture (WebkitFx)

This document locks in boundaries so new apps (Sarees, future marketplaces, admin tools) **extend** the stack instead of reinventing it.

## Layers

1. **`WebkitFx.Platform`** (class library)  
   Cross-cutting HTTP concerns only: tenancy resolution, consistent errors, list envelopes, **object storage abstraction** (`IMediaStorage`).  
   **No** EF Core, no business rules.

2. **Domain services** (e.g. **`Catalog.Api`**)  
   EF Core + Postgres, REST modules under `Features/`, infrastructure under `Infrastructure/`, entities co-located or split later if a service grows.

3. **Frontends** (`apps/*` in the monorepo)  
   **JSON engine** (`@webkitfxv2/core-engine`, `@webkitfxv2/react-renderer`) for forms and shell UI. They call domain APIs for data; the platform does not parse form JSON at runtime unless you add a dedicated BFF.

## Conventions (do not break without versioning)

- **Auth:** Catalog (and future services) use **JWT Bearer** (HS256 in dev; rotate to OIDC / asymmetric keys in production). Writes that mutate data require `Authorization: Bearer <token>`. Store **`Jwt:SigningKey`** in secrets in production (`Jwt__SigningKey` env).
- **Tenant:** `X-Tenant-Id` (preferred) or `tenantId` query for dev tools. Handlers use `ITenantContext` / `HttpRequest.ResolveTenantId`. (Optional later: align JWT `tid` / custom claim with tenant.)
- **API surface:** `/api/v1/...` per service; new breaking shapes → `/api/v2/...`.
- **Media:** Persist **storage keys** in DB; serve files via configured static path (`/media/...`). Production: implement `IMediaStorage` for S3-compatible or Azure Blob and keep the same interface.
- **Persistence:** Postgres per service (or schema-per-module in one cluster). Migrations live with the service that owns the tables.

## Adding a new service

1. New folder `services/<name>-api`, reference `WebkitFx.Platform`.
2. Register `AddWebkitFxPlatform`, `UseWebkitFxPlatform`, own `DbContext`, map endpoints under `/api/v1`.
3. Add the project path to `services/catalog-api/Catalog.slnx` or a future root `WebkitFx.slnx` if you split solutions.

## Future modules (same pattern)

- **Orders / payments:** new API project, same platform; no changes to Platform except optional shared packages (e.g. idempotency helpers).
- **Search:** read models fed by events or ETL; catalog remains source of truth for writes.
- **Auth:** platform may later add `AddWebkitFxAuthentication` — keep JWT/OIDC outside Platform until requirements stabilize.
