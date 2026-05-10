using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using Catalog.Api.Auth;
using Catalog.Api.Data;
using Catalog.Api.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
namespace Catalog.Api.Features;

public static class AuthEndpoints
{
    private const string DefaultTenantId = "t1";

    public static void MapAuthV1(this WebApplication app)
    {
        app.MapPost("/api/v1/auth/register", Register).WithName("AuthRegister");
        app.MapPost("/api/v1/auth/login", Login).WithName("AuthLogin");
    }

    private static async Task<IResult> Register(
        RegisterRequest body,
        CatalogDbContext db,
        IPasswordHasher<PortalUser> passwordHasher,
        PortalJwtIssuer jwtIssuer,
        IOptions<JwtOptions> jwtOptions,
        CancellationToken ct)
    {
        var validation = ValidateRegister(body);
        if (validation is not null)
            return validation;

        var tenantId = DefaultTenantId;
        var norm = NormalizeEmail(body.Email);
        if (await db.PortalUsers.AnyAsync(u => u.TenantId == tenantId && u.NormalizedEmail == norm, ct))
            return Results.Conflict(new { error = "An account with this email already exists." });

        var role = (body.Role?.Trim().ToLowerInvariant() ?? "shopper") == "vendor" ? "vendor" : "shopper";
        var id = "u_" + Guid.NewGuid().ToString("N")[..12];
        var user = new PortalUser
        {
            Id = id,
            TenantId = tenantId,
            Email = body.Email.Trim(),
            NormalizedEmail = norm,
            PasswordHash = "",
            Role = role,
            ProfileJson = body.Profile.HasValue && body.Profile.Value.ValueKind is not JsonValueKind.Null and not JsonValueKind.Undefined
                ? body.Profile.Value.GetRawText()
                : null,
            CreatedAt = DateTimeOffset.UtcNow
        };
        user.PasswordHash = passwordHasher.HashPassword(user, body.Password);

        db.PortalUsers.Add(user);
        await db.SaveChangesAsync(ct);

        var hours = Math.Clamp(jwtOptions.Value.AccessTokenHours, 1, 720);
        var token = jwtIssuer.IssueAccessToken(user.Id, user.Email, user.Role, TimeSpan.FromHours(hours));

        return Results.Created("/api/v1/auth/me", new AuthResponse(
            token.AccessToken,
            "Bearer",
            (token.ExpiresAtUtc - DateTimeOffset.UtcNow).TotalSeconds,
            user.Id,
            user.Email,
            user.Role));
    }

    private static async Task<IResult> Login(
        LoginRequest body,
        CatalogDbContext db,
        IPasswordHasher<PortalUser> passwordHasher,
        PortalJwtIssuer jwtIssuer,
        IOptions<JwtOptions> jwtOptions,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Email) || string.IsNullOrWhiteSpace(body.Password))
            return Results.BadRequest(new { error = "Email and password are required." });

        var norm = NormalizeEmail(body.Email);
        var user = await db.PortalUsers
            .FirstOrDefaultAsync(u => u.TenantId == DefaultTenantId && u.NormalizedEmail == norm, ct);

        if (user is null)
            return Results.Json(new { error = "Invalid email or password." }, statusCode: StatusCodes.Status401Unauthorized);

        var verify = passwordHasher.VerifyHashedPassword(user, user.PasswordHash, body.Password);
        if (verify == PasswordVerificationResult.Failed)
            return Results.Json(new { error = "Invalid email or password." }, statusCode: StatusCodes.Status401Unauthorized);

        if (verify == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = passwordHasher.HashPassword(user, body.Password);
            await db.SaveChangesAsync(ct);
        }

        var hours = Math.Clamp(jwtOptions.Value.AccessTokenHours, 1, 720);
        var token = jwtIssuer.IssueAccessToken(user.Id, user.Email, user.Role, TimeSpan.FromHours(hours));

        return Results.Ok(new AuthResponse(
            token.AccessToken,
            "Bearer",
            (token.ExpiresAtUtc - DateTimeOffset.UtcNow).TotalSeconds,
            user.Id,
            user.Email,
            user.Role));
    }

    private static IResult? ValidateRegister(RegisterRequest body)
    {
        if (string.IsNullOrWhiteSpace(body.Email) || string.IsNullOrWhiteSpace(body.Password))
            return Results.BadRequest(new { error = "Email and password are required." });

        if (body.Password.Length < 8)
            return Results.BadRequest(new { error = "Password must be at least 8 characters." });

        if (!new EmailAddressAttribute().IsValid(body.Email.Trim()))
            return Results.BadRequest(new { error = "Invalid email address." });

        var role = body.Role?.Trim().ToLowerInvariant() ?? "shopper";
        if (role is not ("shopper" or "vendor"))
            return Results.BadRequest(new { error = "Role must be shopper or vendor." });

        return null;
    }

    private static string NormalizeEmail(string email) => email.Trim().ToUpperInvariant();

    public sealed class RegisterRequest
    {
        public string Email { get; set; } = "";
        public string Password { get; set; } = "";
        public string Role { get; set; } = "shopper";
        public JsonElement? Profile { get; set; }
    }

    public sealed class LoginRequest
    {
        public string Email { get; set; } = "";
        public string Password { get; set; } = "";
    }

    private sealed record AuthResponse(
        string AccessToken,
        string TokenType,
        double ExpiresIn,
        string UserId,
        string Email,
        string Role);
}
