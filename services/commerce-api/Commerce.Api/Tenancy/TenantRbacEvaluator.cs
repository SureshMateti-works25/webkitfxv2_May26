using System.Text.Json;
using Commerce.Api.Data;
using Commerce.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Commerce.Api.Tenancy;

public sealed class TenantRbacEvaluator(TenantRbacService manifestService, CommerceDbContext db)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public TenantRbacManifest Manifest => manifestService.Manifest;

    public async Task<TenantRbacManifest> GetEffectiveManifestAsync(
        string tenantId,
        CancellationToken ct = default)
    {
        var vertical = await ResolveVerticalAsync(tenantId, ct);
        return manifestService.GetEffectiveManifest(vertical);
    }

    public async Task<IReadOnlyList<string>> FeaturesForTenantAsync(
        string tenantId,
        string storefrontMode,
        CancellationToken ct = default)
    {
        var vertical = await ResolveVerticalAsync(tenantId, ct);
        return manifestService.FeaturesFor(storefrontMode, vertical);
    }

    public async Task<bool> HasManifestPermissionAsync(
        string tenantId,
        string role,
        string storefrontMode,
        string permission,
        CancellationToken ct = default)
    {
        var manifest = await GetEffectiveManifestAsync(tenantId, ct);
        return manifest.HasPermission(role, storefrontMode, permission);
    }

    public bool HasManifestPermission(string role, string storefrontMode, string permission) =>
        manifestService.HasPermission(role, storefrontMode, permission);

    public async Task<bool> HasPermissionAsync(
        string tenantId,
        string role,
        string storefrontMode,
        string permission,
        CancellationToken ct = default)
    {
        var vertical = await ResolveVerticalAsync(tenantId, ct);
        if (manifestService.HasPermission(role, storefrontMode, permission, vertical))
            return true;

        var custom = await LoadCustomPermissionsAsync(tenantId, role, ct);
        if (custom is null)
            return false;

        var manifest = manifestService.GetEffectiveManifest(vertical);
        return ManifestMatchesPermissions(manifest, custom, storefrontMode, permission);
    }

    public async Task<IReadOnlyList<string>?> LoadCustomPermissionsAsync(
        string tenantId,
        string roleKey,
        CancellationToken ct = default)
    {
        var manifest = await GetEffectiveManifestAsync(tenantId, ct);
        var key = roleKey.Trim().ToLowerInvariant();
        if (manifest.Roles.ContainsKey(key))
            return null;

        var row = await db.TenantCustomRoles.AsNoTracking()
            .FirstOrDefaultAsync(
                r => r.TenantId == tenantId && r.RoleKey == key,
                ct);

        return row is null ? null : DeserializePermissions(row.PermissionsJson);
    }

    public static IReadOnlyList<string> DeserializePermissions(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return Array.Empty<string>();
        try
        {
            return JsonSerializer.Deserialize<List<string>>(json, JsonOptions) ?? [];
        }
        catch (JsonException)
        {
            return Array.Empty<string>();
        }
    }

    public static string SerializePermissions(IEnumerable<string> permissions) =>
        JsonSerializer.Serialize(
            permissions
                .Select(p => p.Trim().ToLowerInvariant())
                .Where(p => p.Length > 0)
                .Distinct(StringComparer.Ordinal)
                .OrderBy(p => p, StringComparer.Ordinal)
                .ToList(),
            JsonOptions);

    private async Task<string?> ResolveVerticalAsync(string tenantId, CancellationToken ct) =>
        await db.Tenants.AsNoTracking()
            .Where(t => t.Id == tenantId)
            .Select(t => t.Vertical)
            .FirstOrDefaultAsync(ct);

    private static bool ManifestMatchesPermissions(
        TenantRbacManifest manifest,
        IReadOnlyList<string> rolePermissions,
        string storefrontMode,
        string permission)
    {
        permission = permission.Trim().ToLowerInvariant();
        if (rolePermissions.Contains("*", StringComparer.Ordinal))
            return !IsDenied(manifest, storefrontMode, permission);
        if (!rolePermissions.Contains(permission, StringComparer.Ordinal))
            return false;
        return !IsDenied(manifest, storefrontMode, permission);
    }

    private static bool IsDenied(
        TenantRbacManifest manifest,
        string storefrontMode,
        string permission)
    {
        if (!manifest.StorefrontModes.TryGetValue(storefrontMode.Trim().ToLowerInvariant(), out var mode))
            return false;
        return mode.DeniedPermissions.Contains(permission, StringComparer.Ordinal);
    }
}
