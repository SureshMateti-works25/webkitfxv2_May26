using Commerce.Api.Data;
using Commerce.Api.Entities;
using Commerce.Api.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace Commerce.Api.Auth;

public sealed record ResolvedAuthRoles(
    string PortalRole,
    string PermissionRoleKey,
    string? PrimaryAssignmentId);

public static class AuthRoleResolver
{
    public static async Task<ResolvedAuthRoles> ResolveAsync(
        CommerceDbContext db,
        PortalUser user,
        CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        var primary = await db.PortalUserRoleAssignments
            .AsNoTracking()
            .Where(a =>
                a.TenantId == user.TenantId
                && a.PortalUserId == user.Id
                && a.IsPrimary
                && (a.ValidFrom == null || a.ValidFrom <= now)
                && (a.ValidTo == null || a.ValidTo > now))
            .FirstOrDefaultAsync(ct);

        if (primary is not null)
        {
            return new ResolvedAuthRoles(
                NormalizePortalRole(primary.PortalBaseRole),
                primary.RoleKey.Trim().ToLowerInvariant(),
                primary.Id);
        }

        var fallback = user.Role.Trim().ToLowerInvariant();
        return new ResolvedAuthRoles(NormalizePortalRole(fallback), fallback, null);
    }

    public static string NormalizePortalRole(string role)
    {
        var r = role.Trim().ToLowerInvariant();
        return r is PortalRoles.Shopper or PortalRoles.Vendor or PortalRoles.Admin ? r : PortalRoles.Shopper;
    }

    public static async Task<IReadOnlyList<string>> PermissionsForUserAsync(
        TenantRbacEvaluator evaluator,
        string tenantId,
        string permissionRoleKey,
        string storefrontMode,
        CancellationToken ct = default)
    {
        var key = permissionRoleKey.Trim().ToLowerInvariant();
        var manifest = await evaluator.GetEffectiveManifestAsync(tenantId, ct);
        if (manifest.Roles.ContainsKey(key))
            return manifest.PermissionsFor(key, storefrontMode);

        var custom = await evaluator.LoadCustomPermissionsAsync(tenantId, key, ct);
        if (custom is { Count: > 0 })
            return custom;

        return Array.Empty<string>();
    }
}
