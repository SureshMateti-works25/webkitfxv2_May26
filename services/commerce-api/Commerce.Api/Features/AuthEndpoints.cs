using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using Commerce.Api.Audit;
using Commerce.Api.Auth;
using Commerce.Api.Data;
using Commerce.Api.Entities;
using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Commerce.Api.Features;

public static class AuthEndpoints
{
    private const string DefaultTenantId = "t1";

    public static void MapAuthV1(this WebApplication app)
    {
        app.MapPost("/api/v1/auth/register", Register).WithName("AuthRegister");
        app.MapPost("/api/v1/auth/login", Login).WithName("AuthLogin");
        app.MapPost("/api/v1/auth/password/change", ChangePassword)
            .RequireAuthorization()
            .WithName("AuthChangePassword");
        app.MapPost("/api/v1/auth/password/forgot", ForgotPassword)
            .WithName("AuthForgotPassword");
    }

    private static async Task<IResult> Register(
        RegisterRequest body,
        HttpContext http,
        CommerceDbContext db,
        IPasswordHasher<PortalUser> passwordHasher,
        PortalJwtIssuer jwtIssuer,
        IOptions<JwtOptions> jwtOptions,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var validation = ValidateRegister(body);
        if (validation is not null)
        {
            await audit.RecordAsync(
                AuditActions.AuthRegister,
                "failure",
                DefaultTenantId,
                null,
                "portal_user",
                null,
                new { reason = "validation" },
                http,
                ct);
            return validation;
        }

        var tenantId = DefaultTenantId;
        var norm = NormalizeEmail(body.Email);
        if (await db.PortalUsers.AnyAsync(u => u.TenantId == tenantId && u.NormalizedEmail == norm, ct))
        {
            await audit.RecordAsync(
                AuditActions.AuthRegister,
                "failure",
                tenantId,
                null,
                "portal_user",
                null,
                new { reason = "email_exists", emailDomain = EmailDomain(body.Email) },
                http,
                ct);
            return Results.Conflict(new { error = "An account with this email already exists." });
        }

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
            CreatedAt = DateTimeOffset.UtcNow,
            LoginDisabled = false
        };
        user.PasswordHash = passwordHasher.HashPassword(user, body.Password);

        db.PortalUsers.Add(user);
        await db.SaveChangesAsync(ct);

        var hours = Math.Clamp(jwtOptions.Value.AccessTokenHours, 1, 720);
        var token = jwtIssuer.IssueAccessToken(user.Id, user.Email, user.Role, TimeSpan.FromHours(hours));

        await audit.RecordAsync(
            AuditActions.AuthRegister,
            "success",
            tenantId,
            user.Id,
            "portal_user",
            user.Id,
            new { role = user.Role, emailDomain = EmailDomain(user.Email) },
            http,
            ct);

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
        HttpContext http,
        CommerceDbContext db,
        IPasswordHasher<PortalUser> passwordHasher,
        PortalJwtIssuer jwtIssuer,
        IOptions<JwtOptions> jwtOptions,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Email) || string.IsNullOrWhiteSpace(body.Password))
        {
            await audit.RecordAsync(
                AuditActions.AuthLogin,
                "failure",
                DefaultTenantId,
                null,
                "portal_user",
                null,
                new { reason = "validation" },
                http,
                ct);
            return Results.BadRequest(new { error = "Email and password are required." });
        }

        var norm = NormalizeEmail(body.Email);
        var user = await db.PortalUsers
            .FirstOrDefaultAsync(u => u.TenantId == DefaultTenantId && u.NormalizedEmail == norm, ct);

        if (user is null)
        {
            await audit.RecordAsync(
                AuditActions.AuthLogin,
                "failure",
                DefaultTenantId,
                null,
                "portal_user",
                null,
                new { reason = "unknown_user", emailDomain = EmailDomain(body.Email) },
                http,
                ct);
            return Results.Json(new { error = "Invalid email or password." }, statusCode: StatusCodes.Status401Unauthorized);
        }

        var verify = passwordHasher.VerifyHashedPassword(user, user.PasswordHash, body.Password);
        if (verify == PasswordVerificationResult.Failed)
        {
            await audit.RecordAsync(
                AuditActions.AuthLogin,
                "failure",
                DefaultTenantId,
                null,
                "portal_user",
                null,
                new { reason = "bad_password", emailDomain = EmailDomain(body.Email) },
                http,
                ct);
            return Results.Json(new { error = "Invalid email or password." }, statusCode: StatusCodes.Status401Unauthorized);
        }

        if (user.LoginDisabled)
        {
            await audit.RecordAsync(
                AuditActions.AuthLogin,
                "failure",
                DefaultTenantId,
                user.Id,
                "portal_user",
                user.Id,
                new { reason = "login_disabled", emailDomain = EmailDomain(body.Email) },
                http,
                ct);
            return Results.Json(
                new { error = "This account has been disabled. Contact support if you need help." },
                statusCode: StatusCodes.Status403Forbidden);
        }

        if (verify == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = passwordHasher.HashPassword(user, body.Password);
            await db.SaveChangesAsync(ct);
        }

        var hours = Math.Clamp(jwtOptions.Value.AccessTokenHours, 1, 720);
        var token = jwtIssuer.IssueAccessToken(user.Id, user.Email, user.Role, TimeSpan.FromHours(hours));

        await audit.RecordAsync(
            AuditActions.AuthLogin,
            "success",
            DefaultTenantId,
            user.Id,
            "portal_user",
            user.Id,
            new { role = user.Role, emailDomain = EmailDomain(user.Email) },
            http,
            ct);

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

    private static async Task<IResult> ChangePassword(
        ChangePasswordRequest body,
        HttpContext http,
        CommerceDbContext db,
        IPasswordHasher<PortalUser> passwordHasher,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var actorUserId = http.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? http.User.FindFirstValue("sub");
        if (string.IsNullOrWhiteSpace(actorUserId))
            return Results.Unauthorized();

        if (string.IsNullOrWhiteSpace(body.CurrentPassword) || string.IsNullOrWhiteSpace(body.NewPassword))
            return Results.BadRequest(new { error = "Current password and new password are required." });
        if (body.NewPassword.Length < 8)
            return Results.BadRequest(new { error = "New password must be at least 8 characters." });

        var user = await db.PortalUsers.FirstOrDefaultAsync(u => u.TenantId == DefaultTenantId && u.Id == actorUserId, ct);
        if (user is null)
            return Results.NotFound(new { error = "Account not found." });
        if (user.LoginDisabled)
            return Results.Json(
                new { error = "This account has been disabled. Contact support if you need help." },
                statusCode: StatusCodes.Status403Forbidden);

        var verify = passwordHasher.VerifyHashedPassword(user, user.PasswordHash, body.CurrentPassword);
        if (verify == PasswordVerificationResult.Failed)
        {
            await audit.RecordAsync(
                AuditActions.AuthPasswordChange,
                "failure",
                DefaultTenantId,
                user.Id,
                "portal_user",
                user.Id,
                new { reason = "bad_current_password" },
                http,
                ct);
            return Results.Json(new { error = "Current password is incorrect." }, statusCode: StatusCodes.Status401Unauthorized);
        }

        user.PasswordHash = passwordHasher.HashPassword(user, body.NewPassword);
        await db.SaveChangesAsync(ct);

        await audit.RecordAsync(
            AuditActions.AuthPasswordChange,
            "success",
            DefaultTenantId,
            user.Id,
            "portal_user",
            user.Id,
            new { via = "self_service" },
            http,
            ct);

        return Results.Ok(new { message = "Password updated." });
    }

    private static async Task<IResult> ForgotPassword(
        ForgotPasswordRequest body,
        HttpContext http,
        CommerceDbContext db,
        IPasswordHasher<PortalUser> passwordHasher,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Email) || string.IsNullOrWhiteSpace(body.NewPassword))
            return Results.BadRequest(new { error = "Email and new password are required." });
        if (body.NewPassword.Length < 8)
            return Results.BadRequest(new { error = "New password must be at least 8 characters." });
        if (!new EmailAddressAttribute().IsValid(body.Email.Trim()))
            return Results.BadRequest(new { error = "Invalid email address." });

        var norm = NormalizeEmail(body.Email);
        var user = await db.PortalUsers
            .FirstOrDefaultAsync(u => u.TenantId == DefaultTenantId && u.NormalizedEmail == norm, ct);

        if (user is not null)
        {
            user.PasswordHash = passwordHasher.HashPassword(user, body.NewPassword);
            await db.SaveChangesAsync(ct);
        }

        await audit.RecordAsync(
            AuditActions.AuthPasswordForgot,
            "success",
            DefaultTenantId,
            null,
            "portal_user",
            null,
            new { emailDomain = EmailDomain(body.Email), userFound = user is not null },
            http,
            ct);

        return Results.Ok(new
        {
            message = "If the account exists, the password has been reset. You can now sign in with the new password."
        });
    }

    private static string NormalizeEmail(string email) => email.Trim().ToUpperInvariant();

    private static string? EmailDomain(string email)
    {
        var t = email.Trim();
        var i = t.LastIndexOf('@');
        return i > 0 && i < t.Length - 1 ? t[(i + 1)..] : null;
    }

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

    public sealed class ChangePasswordRequest
    {
        public string CurrentPassword { get; set; } = "";
        public string NewPassword { get; set; } = "";
    }

    public sealed class ForgotPasswordRequest
    {
        public string Email { get; set; } = "";
        public string NewPassword { get; set; } = "";
    }

    private sealed record AuthResponse(
        string AccessToken,
        string TokenType,
        double ExpiresIn,
        string UserId,
        string Email,
        string Role);
}
