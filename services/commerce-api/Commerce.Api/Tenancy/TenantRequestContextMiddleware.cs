using Commerce.Api.Data;
using Microsoft.EntityFrameworkCore;
using WebkitFx.Platform.Tenancy;

namespace Commerce.Api.Tenancy;

/// <summary>Loads tenant storefront mode into <c>HttpContext.Items</c> for RBAC and UI bootstrap.</summary>
public sealed class TenantRequestContextMiddleware(RequestDelegate next)
{
    public const string StorefrontModeItemKey = "webkitfx.storefront_mode";
    public const string TenantActiveItemKey = "webkitfx.tenant_active";

    public async Task InvokeAsync(HttpContext context, CommerceDbContext db, ITenantContext tenantContext)
    {
        var tenantId = context.Request.ResolveTenantId(tenantContext);
        if (!string.IsNullOrWhiteSpace(tenantId))
        {
            var tenant = await db.Tenants.AsNoTracking()
                .Where(t => t.Id == tenantId)
                .Select(t => new { t.StorefrontMode, t.IsActive })
                .FirstOrDefaultAsync(context.RequestAborted);

            if (tenant is not null)
            {
                context.Items[StorefrontModeItemKey] = tenant.StorefrontMode;
                context.Items[TenantActiveItemKey] = tenant.IsActive;
            }
        }

        await next(context);
    }
}

public static class TenantRequestContextMiddlewareExtensions
{
    public static IApplicationBuilder UseTenantRequestContext(this IApplicationBuilder app)
        => app.UseMiddleware<TenantRequestContextMiddleware>();
}
