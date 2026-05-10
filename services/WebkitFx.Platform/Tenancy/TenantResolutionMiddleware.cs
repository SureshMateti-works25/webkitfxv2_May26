using Microsoft.AspNetCore.Http;

namespace WebkitFx.Platform.Tenancy;

/// <summary>
/// Resolves tenant from <see cref="TenantConstants.HeaderName"/> first, then query <c>tenantId</c> (dev tools / legacy).
/// Does not reject missing tenant — individual endpoints enforce with <see cref="TenantResolutionExtensions.RequireTenant"/>.
/// </summary>
public sealed class TenantResolutionMiddleware(RequestDelegate next)
{
    public Task InvokeAsync(HttpContext context)
    {
        var header = context.Request.Headers[TenantConstants.HeaderName].FirstOrDefault();
        var query = context.Request.Query["tenantId"].FirstOrDefault();
        var id = !string.IsNullOrWhiteSpace(header) ? header.Trim() : query?.Trim();
        if (!string.IsNullOrEmpty(id))
            HttpTenantContext.Attach(context, id);

        return next(context);
    }
}
