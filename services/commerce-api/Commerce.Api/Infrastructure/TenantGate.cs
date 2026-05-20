using Commerce.Api.Audit;
using Commerce.Api.Data;
using Commerce.Api.Tenancy;
using Microsoft.AspNetCore.Http;
using WebkitFx.Platform.Tenancy;

namespace Commerce.Api.Infrastructure;

public static class TenantGate
{
    public static async Task<IResult?> RequireTenantAsync(
        HttpContext http,
        ITenantContext tenantContext,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var tenantId = http.Request.ResolveTenantId(tenantContext);
        var fail = TenantResolutionExtensions.RequireTenant(tenantId);
        if (fail is not null)
        {
            await audit.RecordAsync(
                AuditActions.TenantMissing,
                "failure",
                tenantId: null,
                actorUserId: AuditLogWriter.ActorFromPrincipal(http.User),
                resourceType: "http",
                resourceId: http.Request.Path.Value,
                detail: new { reason = "missing_tenant", method = http.Request.Method },
                http,
                ct);
        }

        return fail;
    }

    public static async Task<IResult?> RequireActiveTenantAsync(
        HttpContext http,
        CommerceDbContext db,
        ITenantContext tenantContext,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var missing = await RequireTenantAsync(http, tenantContext, audit, ct);
        if (missing is not null)
            return missing;

        if (http.Items.TryGetValue(TenantRequestContextMiddleware.TenantActiveItemKey, out var activeObj)
            && activeObj is false)
        {
            var tenantId = http.Request.ResolveTenantId(tenantContext);
            await audit.RecordAsync(
                AuditActions.TenantMissing,
                "failure",
                tenantId,
                AuditLogWriter.ActorFromPrincipal(http.User),
                "tenant",
                tenantId,
                new { reason = "inactive_tenant" },
                http,
                ct);
            return Results.Json(
                new { error = "Tenant is not active.", tenantId },
                statusCode: StatusCodes.Status403Forbidden);
        }

        var (_, error) = await TenantResolver.ResolveActiveTenantAsync(http, db, tenantContext, ct);
        if (error is not null)
        {
            await audit.RecordAsync(
                AuditActions.TenantMissing,
                "failure",
                http.Request.ResolveTenantId(tenantContext),
                AuditLogWriter.ActorFromPrincipal(http.User),
                "tenant",
                http.Request.ResolveTenantId(tenantContext),
                new { reason = "unknown_or_inactive_tenant" },
                http,
                ct);
        }

        return error;
    }
}
