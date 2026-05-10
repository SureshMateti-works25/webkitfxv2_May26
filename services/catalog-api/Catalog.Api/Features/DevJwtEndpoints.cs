using Catalog.Api.Auth;
using Microsoft.Extensions.Options;

namespace Catalog.Api.Features;

/// <summary>Local-only helper to mint HS256 JWTs. Disabled outside Development.</summary>
public static class DevJwtEndpoints
{
    public static void MapDevJwt(this WebApplication app)
    {
        if (!app.Environment.IsDevelopment())
            return;

        app.MapPost("/api/v1/dev/jwt", (
                DevJwtRequest body,
                PortalJwtIssuer jwtIssuer,
                IOptions<JwtOptions> jwtOptions) =>
            {
                var sub = string.IsNullOrWhiteSpace(body.Subject) ? "dev-user" : body.Subject.Trim();
                var role = string.IsNullOrWhiteSpace(body.Role) ? "admin" : body.Role.Trim();
                var hours = body.ExpiresHours is > 0 and <= 168 ? body.ExpiresHours : 8;
                var token = jwtIssuer.IssueAccessToken(sub, $"{sub}@dev.local", role, TimeSpan.FromHours(hours));
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
        /// <summary>1–168 hours; default 8.</summary>
        public int ExpiresHours { get; set; } = 8;
    }
}
