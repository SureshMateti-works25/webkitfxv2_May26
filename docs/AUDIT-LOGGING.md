# Audit logging (Commerce.Api)

Security- and operations-relevant events are persisted in PostgreSQL table **`audit_logs`** (append-only from the application’s perspective). This complements **structured logs** (`ILogger`); use **audit rows** for investigations, access review, and alerting.

## Principles

- **No secrets:** passwords, JWTs, API keys, and signing keys are never written to `detail_json` or other columns.
- **PII minimization:** auth events store **`emailDomain`** where useful, not full email (except where an existing column already holds actor identifiers such as portal user id).
- **Resilience:** `AuditLogWriter` uses a **separate DI scope** and `DbContext` per write so a failed business transaction can still emit an audit row when appropriate, and audit persistence failures are logged but do not fail the HTTP request (except where you explicitly chain `await` on the business path—those still succeed if audit fails).

## Table overview

| Column | Purpose |
|--------|---------|
| `id` | Stable row id (`al_…`) |
| `occurred_at` | UTC timestamp |
| `tenant_id` | Tenant context when known |
| `actor_user_id` | JWT `sub` / `NameIdentifier` when authenticated |
| `action` | Stable action code (see below) |
| `resource_type` / `resource_id` | Logical resource (e.g. `tenant`, `media_asset`) |
| `outcome` | `success` or `failure` |
| `detail_json` | Small JSON payload (camelCase, truncated ~8k) |
| `client_ip` | From `X-Forwarded-For` first hop or connection IP |
| `user_agent_snippet` | Truncated `User-Agent` |
| `request_id` | ASP.NET `TraceIdentifier` |

Indexes exist on `occurred_at`, `(tenant_id, occurred_at)`, and `(action, occurred_at)`.

## Action codes (`action`)

| Code | When |
|------|------|
| `auth.register` | Portal registration (success / validation / email_exists) |
| `auth.login` | Portal login (success / validation / unknown_user / bad_password) |
| `auth.jwt_failed` | JWT bearer validation threw (malformed, bad signature, expired, etc.) |
| `auth.jwt_challenge` | Protected route challenged with **no** `Authorization` header |
| `auth.dev_jwt` | **Development only:** `/api/v1/dev/jwt` minted a token |
| `tenant.missing` | Catalog/media/inventory (and similar) returned **400 missing tenant** |
| `tenant.create` | `POST /api/v1/tenants` (success / validation / duplicate) |
| `media.upload` | `POST /api/v1/media/assets` (success / not_multipart / missing_file / tenant gate) |
| `data.constraint_failure` | `DbUpdateException` handled by `EfCoreExceptionHandler` |
| `bootstrap.migrate` | **Development startup:** after `MigrateAsync` and after dev seed phases |

## Query examples (SQL)

```sql
-- Recent auth failures
SELECT occurred_at, action, outcome, detail_json, client_ip
FROM audit_logs
WHERE action LIKE 'auth.%' AND outcome = 'failure'
ORDER BY occurred_at DESC
LIMIT 100;

-- Tenant context missing (client or integration bug)
SELECT occurred_at, resource_id AS path, client_ip, detail_json
FROM audit_logs
WHERE action = 'tenant.missing'
ORDER BY occurred_at DESC
LIMIT 50;
```

## Operational notes

- **Retention / archival:** define policy in your environment (partition by month, export to SIEM, etc.)—not enforced in app code.
- **Read API:** not exposed yet; use SQL, BI, or add a secured admin endpoint in a future change.
- **Duplicates:** `auth.jwt_failed` and `auth.jwt_challenge` are distinct; challenge is limited to **missing bearer** to reduce noise.

## Related code

- `Commerce.Api/Entities/AuditLog.cs`
- `Commerce.Api/Audit/AuditLogWriter.cs`, `AuditActions.cs`
- `Commerce.Api/Infrastructure/TenantGate.cs`
- `Commerce.Api/Auth/CommerceAuthExtensions.cs` (JWT events)
- `Commerce.Api/Infrastructure/EfCoreExceptionHandler.cs`

See also [`PROJECT-STRUCTURE.md`](./PROJECT-STRUCTURE.md) and [`services/commerce-api/Commerce.Api/README.md`](../services/commerce-api/Commerce.Api/README.md).
