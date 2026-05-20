using System.Security.Claims;
using Commerce.Api.Audit;
using Commerce.Api.Auth;
using Commerce.Api.Data;
using Commerce.Api.Entities;
using Commerce.Api.Infrastructure;
using Commerce.Api.Tenancy;
using Microsoft.EntityFrameworkCore;
using WebkitFx.Platform.Tenancy;

namespace Commerce.Api.Features;

public static class TenantRolesEndpoints
{
    private static readonly HashSet<string> ReservedRoleKeys = new(StringComparer.Ordinal)
    {
        "shopper",
        "vendor",
        "admin"
    };

    public static void MapTenantRolesV1(this WebApplication app)
    {
        const string tag = "tenant-roles";
        var group = app.MapGroup("/api/v1/tenant-roles").WithTags(tag);

        group.MapGet("/", ListRoles)
            .RequireAuthorization(PermissionPolicyNames.For("roles:read"))
            .WithName("ListTenantRoles");

        group.MapPost("/", CreateRole)
            .RequireAuthorization(PermissionPolicyNames.For("roles:manage"))
            .WithName("CreateTenantRole");

        group.MapPut("/{roleId}", UpdateRole)
            .RequireAuthorization(PermissionPolicyNames.For("roles:manage"))
            .WithName("UpdateTenantRole");

        group.MapDelete("/{roleId}", DeleteRole)
            .RequireAuthorization(PermissionPolicyNames.For("roles:manage"))
            .WithName("DeleteTenantRole");

        group.MapPost("/seed-defaults", SeedDefaults)
            .RequireAuthorization(PermissionPolicyNames.For("roles:manage"))
            .WithName("SeedTenantRoleDefaults");
    }

    private static string? ActorId(ClaimsPrincipal user) =>
        user.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? user.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);

    private static async Task<IResult> ListRoles(
        HttpRequest request,
        ClaimsPrincipal user,
        ITenantContext tenantContext,
        CommerceDbContext db,
        TenantRbacEvaluator rbac,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(request.HttpContext, tenantContext, audit, ct);
        if (tenantFail is not null)
            return tenantFail;
        var tenantId = request.ResolveTenantId(tenantContext)!;

        var manifest = await rbac.GetEffectiveManifestAsync(tenantId, ct);
        var storefrontMode = await ResolveStorefrontModeAsync(db, tenantId, ct);
        var systemRoles = manifest.Roles.Keys
            .OrderBy(k => k, StringComparer.Ordinal)
            .Select(key => new TenantRoleDto(
                Id: $"system:{key}",
                RoleKey: key,
                DisplayName: TitleCaseRole(key),
                Description: null,
                Permissions: manifest.PermissionsFor(key, storefrontMode).ToArray(),
                IsSystem: true,
                IsBuiltIn: true,
                CreatedAt: null))
            .ToList();

        var custom = await db.TenantCustomRoles.AsNoTracking()
            .Where(r => r.TenantId == tenantId)
            .OrderBy(r => r.RoleKey)
            .Select(r => ToDto(r))
            .ToListAsync(ct);

        return Results.Ok(new
        {
            permissionCatalog = manifest.PermissionCatalog,
            systemRoles,
            customRoles = custom
        });
    }

    private static async Task<IResult> CreateRole(
        TenantRoleUpsertRequest body,
        HttpRequest request,
        ClaimsPrincipal user,
        ITenantContext tenantContext,
        CommerceDbContext db,
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

        var manifest = await rbac.GetEffectiveManifestAsync(tenantId, ct);
        var validation = ValidateUpsert(body, manifest, isUpdate: false);
        if (validation is not null)
            return validation;

        var roleKey = body.RoleKey!.Trim().ToLowerInvariant();
        if (ReservedRoleKeys.Contains(roleKey))
            return Results.BadRequest(new { error = "reserved_role_key", roleKey });

        var exists = await db.TenantCustomRoles.AnyAsync(
            r => r.TenantId == tenantId && r.RoleKey == roleKey,
            ct);
        if (exists)
            return Results.Conflict(new { error = "duplicate_role_key", roleKey });

        var entity = new TenantCustomRole
        {
            Id = Guid.NewGuid().ToString("N"),
            TenantId = tenantId,
            RoleKey = roleKey,
            DisplayName = body.DisplayName!.Trim(),
            Description = string.IsNullOrWhiteSpace(body.Description) ? null : body.Description.Trim(),
            PermissionsJson = TenantRbacEvaluator.SerializePermissions(body.Permissions ?? []),
            IsBuiltIn = body.IsBuiltIn == true,
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedByUserId = actor
        };

        db.TenantCustomRoles.Add(entity);
        await db.SaveChangesAsync(ct);

        await audit.RecordAsync(
            AuditActions.TenantRoleMutate,
            "success",
            tenantId,
            actor,
            "tenant_role",
            entity.Id,
            new { op = "create", roleKey },
            request.HttpContext,
            ct);

        return Results.Created($"/api/v1/tenant-roles/{entity.Id}", ToDto(entity));
    }

    private static async Task<IResult> UpdateRole(
        string roleId,
        TenantRoleUpsertRequest body,
        HttpRequest request,
        ClaimsPrincipal user,
        ITenantContext tenantContext,
        CommerceDbContext db,
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

        roleId = roleId.Trim();
        var row = await db.TenantCustomRoles.FirstOrDefaultAsync(
            r => r.TenantId == tenantId && r.Id == roleId,
            ct);
        if (row is null)
            return Results.NotFound();

        var isAdmin = string.Equals(
            user.FindFirstValue(ClaimTypes.Role),
            PortalRoles.Admin,
            StringComparison.OrdinalIgnoreCase);

        if (row.IsBuiltIn && !isAdmin)
            return Results.Forbid();

        var manifest = await rbac.GetEffectiveManifestAsync(tenantId, ct);
        var validation = ValidateUpsert(body, manifest, isUpdate: true);
        if (validation is not null)
            return validation;

        row.DisplayName = body.DisplayName!.Trim();
        row.Description = string.IsNullOrWhiteSpace(body.Description) ? null : body.Description.Trim();
        row.PermissionsJson = TenantRbacEvaluator.SerializePermissions(body.Permissions ?? []);

        await db.SaveChangesAsync(ct);

        await audit.RecordAsync(
            AuditActions.TenantRoleMutate,
            "success",
            tenantId,
            actor,
            "tenant_role",
            row.Id,
            new { op = "update", roleKey = row.RoleKey },
            request.HttpContext,
            ct);

        return Results.Ok(ToDto(row));
    }

    private static async Task<IResult> DeleteRole(
        string roleId,
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
        var actor = ActorId(user);
        if (string.IsNullOrWhiteSpace(actor))
            return Results.Unauthorized();

        var isAdmin = string.Equals(
            user.FindFirstValue(ClaimTypes.Role),
            PortalRoles.Admin,
            StringComparison.OrdinalIgnoreCase);

        roleId = roleId.Trim();
        var row = await db.TenantCustomRoles.FirstOrDefaultAsync(
            r => r.TenantId == tenantId && r.Id == roleId,
            ct);
        if (row is null)
            return Results.NotFound();

        if (row.IsBuiltIn && !isAdmin)
            return Results.BadRequest(new { error = "cannot_delete_built_in_role" });

        db.TenantCustomRoles.Remove(row);
        await db.SaveChangesAsync(ct);

        await audit.RecordAsync(
            AuditActions.TenantRoleMutate,
            "success",
            tenantId,
            actor,
            "tenant_role",
            row.Id,
            new { op = "delete", roleKey = row.RoleKey },
            request.HttpContext,
            ct);

        return Results.NoContent();
    }

    private static async Task<IResult> SeedDefaults(
        TenantRoleSeedRequest body,
        HttpRequest request,
        ClaimsPrincipal user,
        ITenantContext tenantContext,
        CommerceDbContext db,
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

        if (body.Roles is not { Count: > 0 })
            return Results.BadRequest(new { error = "roles_required" });

        var manifest = await rbac.GetEffectiveManifestAsync(tenantId, ct);
        var created = new List<TenantRoleDto>();
        foreach (var seed in body.Roles)
        {
            if (seed is null)
                continue;
            var upsert = new TenantRoleUpsertRequest
            {
                RoleKey = seed.RoleKey,
                DisplayName = seed.DisplayName,
                Description = seed.Description,
                Permissions = seed.Permissions,
                IsBuiltIn = true
            };
            var validation = ValidateUpsert(upsert, manifest, isUpdate: false);
            if (validation is not null)
                continue;

            var roleKey = upsert.RoleKey!.Trim().ToLowerInvariant();
            if (ReservedRoleKeys.Contains(roleKey))
                continue;

            var exists = await db.TenantCustomRoles.AnyAsync(
                r => r.TenantId == tenantId && r.RoleKey == roleKey,
                ct);
            if (exists)
                continue;

            var entity = new TenantCustomRole
            {
                Id = Guid.NewGuid().ToString("N"),
                TenantId = tenantId,
                RoleKey = roleKey,
                DisplayName = upsert.DisplayName!.Trim(),
                Description = string.IsNullOrWhiteSpace(upsert.Description) ? null : upsert.Description.Trim(),
                PermissionsJson = TenantRbacEvaluator.SerializePermissions(upsert.Permissions ?? []),
                IsBuiltIn = true,
                CreatedAt = DateTimeOffset.UtcNow,
                CreatedByUserId = actor
            };
            db.TenantCustomRoles.Add(entity);
            created.Add(ToDto(entity));
        }

        await db.SaveChangesAsync(ct);

        await audit.RecordAsync(
            AuditActions.TenantRoleMutate,
            "success",
            tenantId,
            actor,
            "tenant_role",
            "seed",
            new { op = "seed_defaults", count = created.Count },
            request.HttpContext,
            ct);

        return Results.Ok(new { created });
    }

    private static IResult? ValidateUpsert(
        TenantRoleUpsertRequest body,
        TenantRbacManifest manifest,
        bool isUpdate)
    {
        if (string.IsNullOrWhiteSpace(body.DisplayName))
            return Results.BadRequest(new { error = "displayName_required" });

        if (!isUpdate && string.IsNullOrWhiteSpace(body.RoleKey))
            return Results.BadRequest(new { error = "roleKey_required" });

        if (!isUpdate)
        {
            var key = body.RoleKey!.Trim().ToLowerInvariant();
            if (key.Length is < 2 or > 48)
                return Results.BadRequest(new { error = "invalid_role_key_length" });
            if (!key.All(c => char.IsLetterOrDigit(c) || c == '_') || !char.IsLetter(key[0]))
                return Results.BadRequest(new { error = "invalid_role_key_format" });
        }

        var catalogIds = manifest.PermissionCatalog
            .Select(p => p.Id.Trim().ToLowerInvariant())
            .Where(p => p.Length > 0)
            .ToHashSet(StringComparer.Ordinal);
        var manifestPerms = manifest.Roles.Values
            .SelectMany(r => r.Permissions)
            .Select(p => p.Trim().ToLowerInvariant())
            .ToHashSet(StringComparer.Ordinal);

        foreach (var perm in body.Permissions ?? [])
        {
            var p = perm.Trim().ToLowerInvariant();
            if (p == "*")
                continue;
            if (!catalogIds.Contains(p) && !manifestPerms.Contains(p))
                return Results.BadRequest(new { error = "unknown_permission", permission = p });
        }

        return null;
    }

    private static async Task<string> ResolveStorefrontModeAsync(
        CommerceDbContext db,
        string tenantId,
        CancellationToken ct)
    {
        var mode = await db.Tenants.AsNoTracking()
            .Where(t => t.Id == tenantId)
            .Select(t => t.StorefrontMode)
            .FirstOrDefaultAsync(ct);
        return string.IsNullOrWhiteSpace(mode) ? StorefrontModes.IsolatedShop : mode;
    }

    private static string TitleCaseRole(string key) =>
        key switch
        {
            "shopper" => "Shopper",
            "vendor" => "Vendor",
            "admin" => "Administrator",
            _ => char.ToUpperInvariant(key[0]) + key[1..].Replace('_', ' ')
        };

    private static TenantRoleDto ToDto(TenantCustomRole r) =>
        new(
            r.Id,
            r.RoleKey,
            r.DisplayName,
            r.Description,
            TenantRbacEvaluator.DeserializePermissions(r.PermissionsJson).ToArray(),
            false,
            r.IsBuiltIn,
            r.CreatedAt);

    public sealed record TenantRoleDto(
        string Id,
        string RoleKey,
        string DisplayName,
        string? Description,
        string[] Permissions,
        bool IsSystem,
        bool IsBuiltIn,
        DateTimeOffset? CreatedAt);

    public sealed class TenantRoleUpsertRequest
    {
        public string? RoleKey { get; set; }
        public string? DisplayName { get; set; }
        public string? Description { get; set; }
        public List<string>? Permissions { get; set; }
        public bool? IsBuiltIn { get; set; }
    }

    public sealed class TenantRoleSeedRequest
    {
        public List<TenantRoleSeedItem>? Roles { get; set; }
    }

    public sealed class TenantRoleSeedItem
    {
        public string? RoleKey { get; set; }
        public string? DisplayName { get; set; }
        public string? Description { get; set; }
        public List<string>? Permissions { get; set; }
    }
}
