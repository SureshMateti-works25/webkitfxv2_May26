namespace Catalog.Api.Auth;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    /// <summary>Symmetric key for HS256 (UTF-8; use at least 32 characters in production).</summary>
    public string SigningKey { get; set; } = "";

    public string Issuer { get; set; } = "webkitfx-catalog";
    public string Audience { get; set; } = "webkitfx-clients";

    /// <summary>Access token lifetime for login/register (hours).</summary>
    public int AccessTokenHours { get; set; } = 168;
}
