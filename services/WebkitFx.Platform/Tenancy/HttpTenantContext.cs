using Microsoft.AspNetCore.Http;

namespace WebkitFx.Platform.Tenancy;

public sealed class HttpTenantContext(IHttpContextAccessor httpContextAccessor) : ITenantContext
{
    public string? TenantId =>
        httpContextAccessor.HttpContext?.Items[TenantConstants.HttpContextItemKey] as string;

    public static void Attach(HttpContext httpContext, string tenantId)
    {
        httpContext.Items[TenantConstants.HttpContextItemKey] = tenantId;
    }
}
