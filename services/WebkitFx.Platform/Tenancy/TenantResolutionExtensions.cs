using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;

namespace WebkitFx.Platform.Tenancy;

public static class TenantResolutionExtensions
{
    public static IApplicationBuilder UseTenantResolution(this IApplicationBuilder app)
        => app.UseMiddleware<TenantResolutionMiddleware>();

    /// <summary>Effective tenant: header/query middleware first, then explicit query fallback.</summary>
    public static string? ResolveTenantId(this HttpRequest request, ITenantContext? tenantContext = null)
    {
        var fromContext = tenantContext?.TenantId;
        if (!string.IsNullOrWhiteSpace(fromContext))
            return fromContext;

        var q = request.Query["tenantId"].FirstOrDefault();
        return string.IsNullOrWhiteSpace(q) ? null : q.Trim();
    }

    public static IResult? RequireTenant(string? tenantId, string? message = null)
    {
        if (!string.IsNullOrWhiteSpace(tenantId))
            return null;

        return Results.BadRequest(new ProblemBody(
            "https://webkitfx.dev/problems/missing-tenant",
            "Missing tenant",
            StatusCodes.Status400BadRequest,
            message ?? $"Provide {TenantConstants.HeaderName} or tenantId query parameter."));
    }

    private sealed record ProblemBody(string Type, string Title, int Status, string Detail);
}
