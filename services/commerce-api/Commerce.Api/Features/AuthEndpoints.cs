using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Text.Json;
using Commerce.Api.Audit;
using Commerce.Api.Auth;
using Commerce.Api.Data;
using Commerce.Api.Entities;
using Commerce.Api.Tenancy;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using WebkitFx.Platform.Tenancy;

namespace Commerce.Api.Features;

public static class AuthEndpoints
{
    public static void MapAuthV1(this WebApplication app)
    {
        app.MapPost("/api/v1/auth/register", Register).WithName("AuthRegister");
        app.MapPost("/api/v1/auth/login", Login).WithName("AuthLogin");
        app.MapGet("/api/v1/auth/me", Me).RequireAuthorization().WithName("AuthMe");
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
        ITenantContext tenantContext,
        IPasswordHasher<PortalUser> passwordHasher,
        PortalJwtIssuer jwtIssuer,
        TenantRbacEvaluator rbac,
        IOptions<JwtOptions> jwtOptions,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var validation = ValidateRegister(body, rbac.Manifest.RegisterableRoles);
        if (validation is not null)
        {
            await audit.RecordAsync(
                AuditActions.AuthRegister,
                "failure",
                null,
                null,
                "portal_user",
                null,
                new { reason = "validation" },
                http,
                ct);
            return validation;
        }

        var tenant = await ResolveAuthTenantAsync(http, db, tenantContext, audit, ct);
        if (tenant.Error is not null)
            return tenant.Error;

        var tenantId = tenant.Tenant!.Id;
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

        var role = body.Role?.Trim().ToLowerInvariant() ?? PortalRoles.Shopper;
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
        var resolved = await AuthRoleResolver.ResolveAsync(db, user, ct);
        var token = jwtIssuer.IssueAccessToken(
            user.Id,
            user.Email,
            resolved.PortalRole,
            tenantId,
            tenant.Tenant!.StorefrontMode,
            TimeSpan.FromHours(hours),
            resolved.PermissionRoleKey);

        await audit.RecordAsync(
            AuditActions.AuthRegister,
            "success",
            tenantId,
            user.Id,
            "portal_user",
            user.Id,
            new { role = resolved.PortalRole, permissionRole = resolved.PermissionRoleKey, emailDomain = EmailDomain(user.Email) },
            http,
            ct);

        return Results.Created(
            "/api/v1/auth/me",
            await BuildAuthResponseAsync(token, user, tenant.Tenant!, rbac, db, ct));
    }

    private static async Task<IResult> Login(
        LoginRequest body,
        HttpContext http,
        CommerceDbContext db,
        ITenantContext tenantContext,
        IPasswordHasher<PortalUser> passwordHasher,
        PortalJwtIssuer jwtIssuer,
        TenantRbacEvaluator rbac,
        IOptions<JwtOptions> jwtOptions,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Email) || string.IsNullOrWhiteSpace(body.Password))
        {
            await audit.RecordAsync(
                AuditActions.AuthLogin,
                "failure",
                null,
                null,
                "portal_user",
                null,
                new { reason = "validation" },
                http,
                ct);
            return Results.BadRequest(new { error = "Email and password are required." });
        }

        var tenant = await ResolveAuthTenantAsync(http, db, tenantContext, audit, ct);
        if (tenant.Error is not null)
            return tenant.Error;

        var tenantId = tenant.Tenant!.Id;
        var norm = NormalizeEmail(body.Email);
        var user = await db.PortalUsers
            .FirstOrDefaultAsync(u => u.TenantId == tenantId && u.NormalizedEmail == norm, ct);

        if (user is null)
        {
            await audit.RecordAsync(
                AuditActions.AuthLogin,
                "failure",
                tenantId,
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
                tenantId,
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
                tenantId,
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
        var resolved = await AuthRoleResolver.ResolveAsync(db, user, ct);
        var token = jwtIssuer.IssueAccessToken(
            user.Id,
            user.Email,
            resolved.PortalRole,
            tenantId,
            tenant.Tenant!.StorefrontMode,
            TimeSpan.FromHours(hours),
            resolved.PermissionRoleKey);

        await audit.RecordAsync(
            AuditActions.AuthLogin,
            "success",
            tenantId,
            user.Id,
            "portal_user",
            user.Id,
            new { role = resolved.PortalRole, permissionRole = resolved.PermissionRoleKey, emailDomain = EmailDomain(user.Email) },
            http,
            ct);

        return Results.Ok(await BuildAuthResponseAsync(token, user, tenant.Tenant!, rbac, db, ct));
    }

    private static async Task<IResult> Me(
        HttpContext http,
        CommerceDbContext db,
        TenantRbacEvaluator rbac,
        CancellationToken ct)
    {
        var tenantId = http.User.FindFirstValue(CommerceClaimTypes.TenantId);
        var userId = http.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? http.User.FindFirstValue("sub");
        if (string.IsNullOrWhiteSpace(tenantId) || string.IsNullOrWhiteSpace(userId))
            return Results.Unauthorized();

        var user = await db.PortalUsers.AsNoTracking()
            .FirstOrDefaultAsync(u => u.TenantId == tenantId && u.Id == userId, ct);
        if (user is null)
            return Results.NotFound(new { error = "Account not found." });

        var tenant = await db.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tenantId, ct);
        if (tenant is null)
            return Results.NotFound(new { error = "Tenant not found." });

        var storefrontMode = http.User.FindFirstValue("storefront_mode") ?? tenant.StorefrontMode;
        var resolved = await AuthRoleResolver.ResolveAsync(db, user, ct);
        var permissions = await AuthRoleResolver.PermissionsForUserAsync(
            rbac, tenantId, resolved.PermissionRoleKey, storefrontMode, ct);
        object? profile = null;
        if (!string.IsNullOrWhiteSpace(user.ProfileJson))
        {
            try
            {
                profile = JsonSerializer.Deserialize<object>(user.ProfileJson);
            }
            catch
            {
                profile = null;
            }
        }

        return Results.Ok(new
        {
            userId = user.Id,
            email = user.Email,
            role = resolved.PortalRole,
            permissionRole = resolved.PermissionRoleKey,
            tenantId = tenant.Id,
            storefrontMode,
            vertical = tenant.Vertical,
            permissions,
            features = await rbac.FeaturesForTenantAsync(tenantId, storefrontMode, ct),
            mustChangePassword = user.MustChangePassword,
            profile
        });
    }

    private static IResult? ValidateRegister(RegisterRequest body, IReadOnlyList<string> registerableRoles)
    {
        if (string.IsNullOrWhiteSpace(body.Email) || string.IsNullOrWhiteSpace(body.Password))
            return Results.BadRequest(new { error = "Email and password are required." });

        if (body.Password.Length < 8)
            return Results.BadRequest(new { error = "Password must be at least 8 characters." });

        if (!new EmailAddressAttribute().IsValid(body.Email.Trim()))
            return Results.BadRequest(new { error = "Invalid email address." });

        var role = body.Role?.Trim().ToLowerInvariant() ?? PortalRoles.Shopper;
        if (!registerableRoles.Contains(role, StringComparer.Ordinal))
            return Results.BadRequest(new { error = "Role must be shopper or vendor." });

        return null;
    }

    private static async Task<IResult> ChangePassword(
        ChangePasswordRequest body,
        HttpContext http,
        CommerceDbContext db,
        AuditLogWriter audit,
        IPasswordHasher<PortalUser> passwordHasher,
        CancellationToken ct)
    {
        var actorUserId = http.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? http.User.FindFirstValue("sub");
        var tenantId = http.User.FindFirstValue(CommerceClaimTypes.TenantId);
        if (string.IsNullOrWhiteSpace(actorUserId) || string.IsNullOrWhiteSpace(tenantId))
            return Results.Unauthorized();

        if (string.IsNullOrWhiteSpace(body.NewPassword))
            return Results.BadRequest(new { error = "New password is required." });
        if (body.NewPassword.Length < 8)
            return Results.BadRequest(new { error = "New password must be at least 8 characters." });

        var user = await db.PortalUsers.FirstOrDefaultAsync(u => u.TenantId == tenantId && u.Id == actorUserId, ct);
        if (user is null)
            return Results.NotFound(new { error = "Account not found." });
        if (user.LoginDisabled)
            return Results.Json(
                new { error = "This account has been disabled. Contact support if you need help." },
                statusCode: StatusCodes.Status403Forbidden);

        var mustChangeOnly = user.MustChangePassword;
        if (!mustChangeOnly && string.IsNullOrWhiteSpace(body.CurrentPassword))
            return Results.BadRequest(new { error = "Current password and new password are required." });

        if (!mustChangeOnly)
        {
            var verify = passwordHasher.VerifyHashedPassword(user, user.PasswordHash, body.CurrentPassword);
            if (verify == PasswordVerificationResult.Failed)
            {
                await audit.RecordAsync(
                    AuditActions.AuthPasswordChange,
                    "failure",
                    tenantId,
                    user.Id,
                    "portal_user",
                    user.Id,
                    new { reason = "bad_current_password" },
                    http,
                    ct);
                return Results.Json(new { error = "Current password is incorrect." }, statusCode: StatusCodes.Status401Unauthorized);
            }
        }

        user.PasswordHash = passwordHasher.HashPassword(user, body.NewPassword);
        user.MustChangePassword = false;
        await db.SaveChangesAsync(ct);

        await audit.RecordAsync(
            AuditActions.AuthPasswordChange,
            "success",
            tenantId,
            user.Id,
            "portal_user",
            user.Id,
            new { via = mustChangeOnly ? "first_login_setup" : "self_service" },
            http,
            ct);

        return Results.Ok(new { message = "Password updated." });
    }

    private static async Task<IResult> ForgotPassword(
        ForgotPasswordRequest body,
        HttpContext http,
        CommerceDbContext db,
        ITenantContext tenantContext,
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

        var tenantId = await TenantResolver.ResolveAuthTenantIdAsync(http, db, tenantContext, ct);
        if (string.IsNullOrWhiteSpace(tenantId))
            return Results.BadRequest(new { error = "Tenant is required (X-Tenant-Id header)." });

        var norm = NormalizeEmail(body.Email);
        var user = await db.PortalUsers
            .FirstOrDefaultAsync(u => u.TenantId == tenantId && u.NormalizedEmail == norm, ct);

        if (user is not null)
        {
            user.PasswordHash = passwordHasher.HashPassword(user, body.NewPassword);
            await db.SaveChangesAsync(ct);
        }

        await audit.RecordAsync(
            AuditActions.AuthPasswordForgot,
            "success",
            tenantId,
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

    private static async Task<(Tenant? Tenant, IResult? Error)> ResolveAuthTenantAsync(
        HttpContext http,
        CommerceDbContext db,
        ITenantContext tenantContext,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var tenantId = await TenantResolver.ResolveAuthTenantIdAsync(http, db, tenantContext, ct);
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            await audit.RecordAsync(
                AuditActions.AuthLogin,
                "failure",
                null,
                null,
                "tenant",
                null,
                new { reason = "missing_tenant" },
                http,
                ct);
            return (null, Results.BadRequest(new
            {
                error = $"Provide {TenantConstants.HeaderName} header for auth."
            }));
        }

        var tenant = await db.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tenantId, ct);
        if (tenant is null)
            return (null, Results.NotFound(new { error = "Unknown tenant.", tenantId }));

        if (!tenant.IsActive)
            return (null, Results.Json(
                new { error = "Tenant is not active.", tenantId },
                statusCode: StatusCodes.Status403Forbidden));

        return (tenant, null);
    }

    private static async Task<AuthResponse> BuildAuthResponseAsync(
        TokenIssueResult token,
        PortalUser user,
        Tenant tenant,
        TenantRbacEvaluator rbac,
        CommerceDbContext db,
        CancellationToken ct)
    {
        var resolved = await AuthRoleResolver.ResolveAsync(db, user, ct);
        var permissions = await AuthRoleResolver.PermissionsForUserAsync(
            rbac, tenant.Id, resolved.PermissionRoleKey, tenant.StorefrontMode, ct);
        return new AuthResponse(
            token.AccessToken,
            "Bearer",
            (token.ExpiresAtUtc - DateTimeOffset.UtcNow).TotalSeconds,
            user.Id,
            user.Email,
            resolved.PortalRole,
            resolved.PermissionRoleKey,
            tenant.Id,
            tenant.StorefrontMode,
            permissions.ToArray(),
            (await rbac.FeaturesForTenantAsync(tenant.Id, tenant.StorefrontMode, ct)).ToArray(),
            user.MustChangePassword);
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

    public sealed record AuthResponse(
        string AccessToken,
        string TokenType,
        double ExpiresIn,
        string UserId,
        string Email,
        string Role,
        string PermissionRole,
        string TenantId,
        string StorefrontMode,
        string[] Permissions,
        string[] Features,
        bool MustChangePassword);
}
