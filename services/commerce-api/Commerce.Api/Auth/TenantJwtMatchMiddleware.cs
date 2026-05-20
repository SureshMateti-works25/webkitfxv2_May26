using System.Security.Claims;
using WebkitFx.Platform.Tenancy;

namespace Commerce.Api.Auth;

/// <summary>
/// When a JWT is present, its <c>tenant_id</c> claim must match the request tenant header/query.
/// </summary>
public sealed class TenantJwtMatchMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, ITenantContext tenantContext)
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var jwtTenant = context.User.FindFirstValue(CommerceClaimTypes.TenantId);
            var requestTenant = context.Request.ResolveTenantId(tenantContext);

            if (!string.IsNullOrWhiteSpace(jwtTenant)
                && !string.IsNullOrWhiteSpace(requestTenant)
                && !string.Equals(jwtTenant, requestTenant, StringComparison.Ordinal))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new
                {
                    error = "Token tenant does not match request tenant.",
                    tokenTenantId = jwtTenant,
                    requestTenantId = requestTenant
                });
                return;
            }
        }

        await next(context);
    }
}

public static class TenantJwtMatchMiddlewareExtensions
{
    public static IApplicationBuilder UseTenantJwtMatch(this IApplicationBuilder app)
        => app.UseMiddleware<TenantJwtMatchMiddleware>();
}
