using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Text.Json;
using Commerce.Api.Audit;
using Commerce.Api.Auth;
using Commerce.Api.Data;
using Commerce.Api.Entities;
using Commerce.Api.Infrastructure;
using Commerce.Api.Tenancy;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using WebkitFx.Platform.Tenancy;

namespace Commerce.Api.Features;

/// <summary>Site administration: portal accounts (create, profile, login flags).</summary>
public static class AdminPortalEndpoints
{
    public static void MapAdminPortalV1(this WebApplication app)
    {
        const string tag = "admin";
        app.MapGet("/api/v1/admin/portal-users", ListPortalUsers)
            .RequireAuthorization("Admin")
            .WithTags(tag)
            .WithName("AdminListPortalUsers");

        app.MapPost("/api/v1/admin/portal-users", CreatePortalUser)
            .RequireAuthorization("Admin")
            .WithTags(tag)
            .WithName("AdminCreatePortalUser");

        app.MapGet("/api/v1/admin/portal-users/{userId}", GetPortalUser)
            .RequireAuthorization("Admin")
            .WithTags(tag)
            .WithName("AdminGetPortalUser");

        app.MapPatch("/api/v1/admin/portal-users/{userId}", PatchPortalUser)
            .RequireAuthorization("Admin")
            .WithTags(tag)
            .WithName("AdminPatchPortalUser");
    }

    private static string? ActorId(ClaimsPrincipal user) =>
        user.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? user.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);

    private static async Task<IResult> ListPortalUsers(
        string? role,
        HttpRequest request,
        ClaimsPrincipal user,
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(request.HttpContext, tenantContext, audit, ct);
        if (tenantFail is not null)
            return tenantFail;
        var tenantId = request.ResolveTenantId(tenantContext)!;
        if (string.IsNullOrWhiteSpace(ActorId(user)))
            return Results.Unauthorized();

        var filter = role?.Trim().ToLowerInvariant();
        if (filter is { Length: > 0 } && filter is not ("shopper" or "vendor" or "admin"))
            return Results.BadRequest(new { error = "invalid_role_filter", allowed = new[] { "shopper", "vendor", "admin" } });

        var q = db.PortalUsers.AsNoTracking().Where(u => u.TenantId == tenantId);
        if (!string.IsNullOrEmpty(filter))
            q = q.Where(u => u.Role == filter);

        var rows = await q
            .OrderBy(u => u.Role)
            .ThenBy(u => u.Email)
            .Select(u => new PortalUserDirectoryRow(
                u.Id,
                u.Email,
                u.Role,
                u.CreatedAt,
                u.LoginDisabled,
                u.MustChangePassword))
            .ToListAsync(ct);

        return Results.Ok(rows);
    }

    private static async Task<IResult> GetPortalUser(
        string userId,
        HttpRequest request,
        ClaimsPrincipal user,
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(request.HttpContext, tenantContext, audit, ct);
        if (tenantFail is not null)
            return tenantFail;
        var tenantId = request.ResolveTenantId(tenantContext)!;
        if (string.IsNullOrWhiteSpace(ActorId(user)))
            return Results.Unauthorized();

        userId = userId.Trim();
        var row = await db.PortalUsers.AsNoTracking()
            .FirstOrDefaultAsync(u => u.TenantId == tenantId && u.Id == userId, ct);
        if (row is null)
            return Results.NotFound();

        return Results.Ok(ToDetailDto(row));
    }

    private static async Task<IResult> CreatePortalUser(
        CreatePortalUserRequest body,
        HttpRequest request,
        ClaimsPrincipal user,
        ITenantContext tenantContext,
        CommerceDbContext db,
        IPasswordHasher<PortalUser> passwordHasher,
        TenantRbacEvaluator rbac,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(request.HttpContext, tenantContext, audit, ct);
        if (tenantFail is not null)
            return tenantFail;
        var tenantId = request.ResolveTenantId(tenantContext)!;
        var actor = ActorId(user);
        if (string.IsNullOrWhiteSpace(actor))
            return Results.Unauthorized();

        var validation = ValidateCreate(body);
        if (validation is not null)
            return validation;

        var portalRole = AuthRoleResolver.NormalizePortalRole(body.PortalRole!);
        if (portalRole is PortalRoles.Admin)
            return Results.BadRequest(new { error = "Cannot provision site admin accounts via this endpoint." });

        var email = body.Email!.Trim();
        var norm = email.ToUpperInvariant();
        if (await db.PortalUsers.AnyAsync(u => u.TenantId == tenantId && u.NormalizedEmail == norm, ct))
            return Results.Conflict(new { error = "An account with this email already exists." });

        var profileJson = SerializeProfile(body.Profile);
        var id = "u_" + Guid.NewGuid().ToString("N")[..12];
        var portalUser = new PortalUser
        {
            Id = id,
            TenantId = tenantId,
            Email = email,
            NormalizedEmail = norm,
            PasswordHash = "",
            Role = portalRole,
            ProfileJson = profileJson,
            CreatedAt = DateTimeOffset.UtcNow,
            LoginDisabled = false,
            MustChangePassword = true
        };
        portalUser.PasswordHash = passwordHasher.HashPassword(portalUser, body.TemporaryPassword!);

        db.PortalUsers.Add(portalUser);

        if (body.PrimaryAssignment is not null
            && !string.IsNullOrWhiteSpace(body.PrimaryAssignment.RoleKey)
            && !string.IsNullOrWhiteSpace(body.PrimaryAssignment.PortalBaseRole))
        {
            var roleKey = body.PrimaryAssignment.RoleKey.Trim().ToLowerInvariant();
            var portalBase = AuthRoleResolver.NormalizePortalRole(body.PrimaryAssignment.PortalBaseRole);
            if (!await RoleKeyExistsAsync(rbac, db, tenantId, roleKey, ct))
            {
                return Results.BadRequest(new { error = "Unknown permission role.", roleKey });
            }

            portalUser.Role = portalBase;
            db.PortalUserRoleAssignments.Add(new PortalUserRoleAssignment
            {
                Id = Guid.NewGuid().ToString("N"),
                TenantId = tenantId,
                PortalUserId = id,
                RoleKey = roleKey,
                PortalBaseRole = portalBase,
                IsPrimary = true,
                CreatedAt = DateTimeOffset.UtcNow
            });
        }

        await db.SaveChangesAsync(ct);

        await audit.RecordAsync(
            AuditActions.PortalUserMutate,
            "success",
            tenantId,
            actor,
            "portal_user",
            id,
            new { op = "create", portalRole, mustChangePassword = true },
            request.HttpContext,
            ct);

        return Results.Created($"/api/v1/admin/portal-users/{id}", ToDetailDto(portalUser));
    }

    private static async Task<IResult> PatchPortalUser(
        string userId,
        PatchPortalUserRequest body,
        HttpRequest request,
        ClaimsPrincipal user,
        ITenantContext tenantContext,
        CommerceDbContext db,
        IPasswordHasher<PortalUser> passwordHasher,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(request.HttpContext, tenantContext, audit, ct);
        if (tenantFail is not null)
            return tenantFail;
        var tenantId = request.ResolveTenantId(tenantContext)!;
        var actor = ActorId(user);
        if (string.IsNullOrWhiteSpace(actor))
            return Results.Unauthorized();

        userId = userId.Trim();
        if (userId.Length is < 1 or > 64)
            return Results.BadRequest(new { error = "invalid_user_id" });

        var row = await db.PortalUsers.FirstOrDefaultAsync(u => u.TenantId == tenantId && u.Id == userId, ct);
        if (row is null)
            return Results.NotFound();

        var isSelf = string.Equals(userId, actor, StringComparison.Ordinal);
        var detail = new Dictionary<string, object?>();

        if (body.LoginDisabled is not null)
        {
            if (isSelf)
                return Results.BadRequest(new { error = "cannot_change_own_login_flag" });
            detail["loginDisabled"] = new { previous = row.LoginDisabled, next = body.LoginDisabled.Value };
            row.LoginDisabled = body.LoginDisabled.Value;
        }

        if (body.Profile.HasValue
            && body.Profile.Value.ValueKind is not JsonValueKind.Null
            && body.Profile.Value.ValueKind is not JsonValueKind.Undefined)
        {
            row.ProfileJson = SerializeProfile(body.Profile);
            detail["profile"] = true;
        }

        if (!string.IsNullOrWhiteSpace(body.ResetTemporaryPassword))
        {
            if (body.ResetTemporaryPassword.Length < 8)
                return Results.BadRequest(new { error = "Temporary password must be at least 8 characters." });
            row.PasswordHash = passwordHasher.HashPassword(row, body.ResetTemporaryPassword);
            row.MustChangePassword = true;
            detail["resetPassword"] = true;
        }

        if (detail.Count == 0)
            return Results.BadRequest(new { error = "No supported fields to update." });

        await db.SaveChangesAsync(ct);

        await audit.RecordAsync(
            AuditActions.PortalUserMutate,
            "success",
            tenantId,
            actor,
            "portal_user",
            row.Id,
            detail,
            request.HttpContext,
            ct);

        return Results.Ok(ToDetailDto(row));
    }

    private static IResult? ValidateCreate(CreatePortalUserRequest body)
    {
        if (string.IsNullOrWhiteSpace(body.Email) || string.IsNullOrWhiteSpace(body.TemporaryPassword))
            return Results.BadRequest(new { error = "Email and temporaryPassword are required." });
        if (body.TemporaryPassword!.Length < 8)
            return Results.BadRequest(new { error = "Temporary password must be at least 8 characters." });
        if (!new EmailAddressAttribute().IsValid(body.Email.Trim()))
            return Results.BadRequest(new { error = "Invalid email address." });
        if (string.IsNullOrWhiteSpace(body.PortalRole))
            return Results.BadRequest(new { error = "portalRole is required (shopper or vendor)." });
        var role = body.PortalRole.Trim().ToLowerInvariant();
        if (role is not (PortalRoles.Shopper or PortalRoles.Vendor))
            return Results.BadRequest(new { error = "portalRole must be shopper or vendor." });
        return null;
    }

    private static async Task<bool> RoleKeyExistsAsync(
        TenantRbacEvaluator rbac,
        CommerceDbContext db,
        string tenantId,
        string roleKey,
        CancellationToken ct)
    {
        var manifest = await rbac.GetEffectiveManifestAsync(tenantId, ct);
        if (manifest.Roles.ContainsKey(roleKey))
            return true;
        return await db.TenantCustomRoles.AnyAsync(
            r => r.TenantId == tenantId && r.RoleKey == roleKey,
            ct);
    }

    private static string? SerializeProfile(JsonElement? profile)
    {
        if (!profile.HasValue
            || profile.Value.ValueKind is JsonValueKind.Null
            || profile.Value.ValueKind is JsonValueKind.Undefined)
            return null;
        return profile.Value.GetRawText();
    }

    private static PortalUserDetailDto ToDetailDto(PortalUser row)
    {
        object? profile = null;
        if (!string.IsNullOrWhiteSpace(row.ProfileJson))
        {
            try
            {
                profile = JsonSerializer.Deserialize<object>(row.ProfileJson);
            }
            catch
            {
                profile = null;
            }
        }

        return new PortalUserDetailDto(
            row.Id,
            row.Email,
            row.Role,
            row.CreatedAt,
            row.LoginDisabled,
            row.MustChangePassword,
            profile);
    }

    private sealed record PortalUserDirectoryRow(
        string Id,
        string Email,
        string Role,
        DateTimeOffset CreatedAt,
        bool LoginDisabled,
        bool MustChangePassword);

    private sealed record PortalUserDetailDto(
        string Id,
        string Email,
        string Role,
        DateTimeOffset CreatedAt,
        bool LoginDisabled,
        bool MustChangePassword,
        object? Profile);

    public sealed class CreatePortalUserRequest
    {
        public string? Email { get; set; }
        public string? TemporaryPassword { get; set; }
        public string? PortalRole { get; set; }
        public JsonElement? Profile { get; set; }
        public PrimaryAssignmentRequest? PrimaryAssignment { get; set; }
    }

    public sealed class PrimaryAssignmentRequest
    {
        public string? RoleKey { get; set; }
        public string? PortalBaseRole { get; set; }
    }

    public sealed class PatchPortalUserRequest
    {
        public bool? LoginDisabled { get; set; }
        public JsonElement? Profile { get; set; }
        public string? ResetTemporaryPassword { get; set; }
    }
}
