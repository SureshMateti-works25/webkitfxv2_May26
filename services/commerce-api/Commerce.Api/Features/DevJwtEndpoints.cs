using Commerce.Api.Audit;
using Commerce.Api.Auth;
using Microsoft.Extensions.Options;

namespace Commerce.Api.Features;

/// <summary>Local-only helper to mint HS256 JWTs. Disabled outside Development.</summary>
public static class DevJwtEndpoints
{
    public static void MapDevJwt(this WebApplication app)
    {
        if (!app.Environment.IsDevelopment())
            return;

        app.MapPost("/api/v1/dev/jwt", async (
                DevJwtRequest body,
                HttpContext http,
                PortalJwtIssuer jwtIssuer,
                AuditLogWriter audit,
                CancellationToken ct) =>
            {
                var sub = string.IsNullOrWhiteSpace(body.Subject) ? "dev-user" : body.Subject.Trim();
                var role = string.IsNullOrWhiteSpace(body.Role) ? "admin" : body.Role.Trim();
                var tenantId = string.IsNullOrWhiteSpace(body.TenantId) ? "t1" : body.TenantId.Trim();
                var storefrontMode = string.IsNullOrWhiteSpace(body.StorefrontMode)
                    ? Tenancy.StorefrontModes.IsolatedShop
                    : body.StorefrontMode.Trim();
                var hours = body.ExpiresHours is > 0 and <= 168 ? body.ExpiresHours : 8;
                var token = jwtIssuer.IssueAccessToken(
                    sub,
                    $"{sub}@dev.local",
                    role,
                    tenantId,
                    storefrontMode,
                    TimeSpan.FromHours(hours));

                await audit.RecordAsync(
                    AuditActions.AuthDevJwt,
                    "success",
                    tenantId: null,
                    actorUserId: sub,
                    resourceType: "jwt",
                    resourceId: sub,
                    detail: new { role, expiresHours = hours },
                    http,
                    ct);

                return Results.Ok(new
                {
                    access_token = token.AccessToken,
                    token_type = "Bearer",
                    expires_in = (token.ExpiresAtUtc - DateTimeOffset.UtcNow).TotalSeconds
                });
            })
            .WithTags("Development")
            .WithDescription("Development only. Returns a signed JWT for Authorization: Bearer …");
    }

    public sealed class DevJwtRequest
    {
        public string? Subject { get; set; }
        public string? Role { get; set; }
        public string? TenantId { get; set; }
        public string? StorefrontMode { get; set; }
        /// <summary>1–168 hours; default 8.</summary>
        public int ExpiresHours { get; set; } = 8;
    }
}
