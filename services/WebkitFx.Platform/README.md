# WebkitFx.Platform

Shared **.NET 10** building blocks for every WebkitFx HTTP service (catalog, orders, admin, BFFs).

## What is included

| Area | Purpose |
|------|---------|
| **Tenancy** | `X-Tenant-Id` header + `tenantId` query fallback; `ITenantContext`; `UseTenantResolution()` |
| **Errors** | `IExceptionHandler` → RFC 7807 `ProblemDetails` (register domain-specific handlers **before** `AddWebkitFxPlatform` so they run first) |
| **Paging** | `PagedResult<T>`, `PageRequest.Normalize` (shared list contract) |
| **Media** | `IMediaStorage` + `LocalMediaStorage` (swap for S3/Azure without changing upload endpoints) |

## Usage

```csharp
builder.Services.AddExceptionHandler<MyDomainHandler>(); // optional, first in chain
builder.Services.AddWebkitFxPlatform();
builder.Services.Configure<LocalMediaStorageOptions>(builder.Configuration.GetSection("Media"));

var app = builder.Build();
app.UseWebkitFxPlatform(); // exception handler + tenant middleware
```

Reference this project from any service under `services/`.
