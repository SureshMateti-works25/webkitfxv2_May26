using Commerce.Api.Data;
using Commerce.Api.Entities;
using Microsoft.EntityFrameworkCore;
using WebkitFx.Platform.Tenancy;

namespace Commerce.Api.Tenancy;

public static class TenantResolver
{
    public static string? ResolveRequestTenantId(HttpContext http, ITenantContext? tenantContext = null) =>
        http.Request.ResolveTenantId(tenantContext);

    public static async Task<(Tenant? Tenant, IResult? Error)> ResolveActiveTenantAsync(
        HttpContext http,
        CommerceDbContext db,
        ITenantContext tenantContext,
        CancellationToken ct)
    {
        var tenantId = ResolveRequestTenantId(http, tenantContext);
        var missing = TenantResolutionExtensions.RequireTenant(tenantId);
        if (missing is not null)
            return (null, missing);

        var tenant = await db.Tenants.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == tenantId, ct);

        if (tenant is null)
        {
            return (null, Results.NotFound(new
            {
                error = "Unknown tenant.",
                tenantId
            }));
        }

        if (!tenant.IsActive)
        {
            return (null, Results.Json(
                new { error = "Tenant is not active.", tenantId = tenant.Id },
                statusCode: StatusCodes.Status403Forbidden));
        }

        return (tenant, null);
    }

    public static async Task<string?> ResolveAuthTenantIdAsync(
        HttpContext http,
        CommerceDbContext db,
        ITenantContext tenantContext,
        CancellationToken ct)
    {
        var fromRequest = ResolveRequestTenantId(http, tenantContext);
        if (!string.IsNullOrWhiteSpace(fromRequest))
            return fromRequest.Trim();

        var defaultId = http.RequestServices.GetService<IConfiguration>()?["Commerce:DefaultTenantId"];
        if (!string.IsNullOrWhiteSpace(defaultId))
            return defaultId.Trim();

        var fallback = await db.Tenants.AsNoTracking()
            .Where(t => t.IsActive)
            .OrderBy(t => t.Slug)
            .Select(t => t.Id)
            .FirstOrDefaultAsync(ct);

        return fallback;
    }
}
