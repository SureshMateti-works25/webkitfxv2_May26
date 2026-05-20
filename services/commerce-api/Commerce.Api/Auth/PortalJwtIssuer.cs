using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Commerce.Api.Auth;

public sealed class PortalJwtIssuer(IOptions<JwtOptions> jwtOptions)
{
    public TokenIssueResult IssueAccessToken(
        string userId,
        string email,
        string role,
        string tenantId,
        string storefrontMode,
        TimeSpan lifetime,
        string? permissionRoleKey = null)
    {
        var opt = jwtOptions.Value;
        var keyBytes = Encoding.UTF8.GetBytes(opt.SigningKey);
        var key = new SymmetricSecurityKey(keyBytes);
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var now = DateTime.UtcNow;
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, userId),
            new(JwtRegisteredClaimNames.Email, email),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
            new(ClaimTypes.Role, role),
            new(CommerceClaimTypes.TenantId, tenantId),
            new("storefront_mode", storefrontMode)
        };
        var permRole = (permissionRoleKey ?? role).Trim().ToLowerInvariant();
        claims.Add(new Claim(CommerceClaimTypes.PermissionRole, permRole));

        var token = new JwtSecurityToken(
            issuer: opt.Issuer,
            audience: opt.Audience,
            claims: claims,
            notBefore: now,
            expires: now.Add(lifetime),
            signingCredentials: creds);

        var jwt = new JwtSecurityTokenHandler().WriteToken(token);
        return new TokenIssueResult(jwt, new DateTimeOffset(token.ValidTo));
    }
}

public sealed record TokenIssueResult(string AccessToken, DateTimeOffset ExpiresAtUtc);
