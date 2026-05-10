using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Catalog.Api.Auth;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

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
                IOptions<JwtOptions> jwtOptions) =>
            {
                var opt = jwtOptions.Value;
                var keyBytes = Encoding.UTF8.GetBytes(opt.SigningKey);
                var key = new SymmetricSecurityKey(keyBytes);
                var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
                var sub = string.IsNullOrWhiteSpace(body.Subject) ? "dev-user" : body.Subject.Trim();
                var claims = new List<Claim>
                {
                    new(JwtRegisteredClaimNames.Sub, sub),
                    new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N"))
                };
                if (!string.IsNullOrWhiteSpace(body.Role))
                    claims.Add(new Claim(ClaimTypes.Role, body.Role.Trim()));

                var token = new JwtSecurityToken(
                    issuer: opt.Issuer,
                    audience: opt.Audience,
                    claims: claims,
                    notBefore: DateTime.UtcNow,
                    expires: DateTime.UtcNow.AddHours(body.ExpiresHours is > 0 and <= 168 ? body.ExpiresHours : 8),
                    signingCredentials: creds);

                var jwt = new JwtSecurityTokenHandler().WriteToken(token);
                return Results.Ok(new { access_token = jwt, token_type = "Bearer", expires_in = (token.ValidTo - token.ValidFrom).TotalSeconds });
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
