using Commerce.Api.Audit;
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
}
