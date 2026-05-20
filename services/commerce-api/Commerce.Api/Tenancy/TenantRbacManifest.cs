using System.Text.Json;

namespace Commerce.Api.Tenancy;

public sealed class TenantRbacManifest
{
    public int Version { get; set; } = 1;

    public Dictionary<string, RoleDefinition> Roles { get; set; } = new(StringComparer.Ordinal);

    public List<string> RegisterableRoles { get; set; } = [];

    public Dictionary<string, StorefrontModeDefinition> StorefrontModes { get; set; } =
        new(StringComparer.Ordinal);

    public List<PermissionCatalogEntry> PermissionCatalog { get; set; } = [];

    public sealed class PermissionCatalogEntry
    {
        public string Id { get; set; } = "";
        public string Label { get; set; } = "";
        public string Group { get; set; } = "General";
    }

    public sealed class RoleDefinition
    {
        public List<string> Permissions { get; set; } = [];
    }

    public sealed class StorefrontModeDefinition
    {
        public List<string> Features { get; set; } = [];
        public List<string> DeniedPermissions { get; set; } = [];
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true
    };

    public static TenantRbacManifest LoadEmbedded()
    {
        var asm = typeof(TenantRbacManifest).Assembly;
        const string resourceName = "Commerce.Api.Config.tenant-rbac.json";
        using var stream = asm.GetManifestResourceStream(resourceName)
            ?? throw new InvalidOperationException($"Embedded resource {resourceName} not found.");
        var manifest = JsonSerializer.Deserialize<TenantRbacManifest>(stream, JsonOptions)
            ?? throw new InvalidOperationException("tenant-rbac.json deserialized to null.");
        return manifest;
    }

    public static string? NormalizeVerticalKey(string? vertical)
    {
        if (string.IsNullOrWhiteSpace(vertical))
            return null;

        var key = vertical.Trim().ToLowerInvariant();
        return key switch
        {
            "groceries" => "grocery",
            "apparel" => "sarees",
            _ => key
        };
    }

    public TenantRbacManifest WithOverlay(TenantRbacOverlayDocument overlay)
    {
        var merged = new TenantRbacManifest
        {
            Version = Version,
            Roles = Roles.ToDictionary(
                kv => kv.Key,
                kv => new RoleDefinition { Permissions = [.. kv.Value.Permissions] },
                StringComparer.Ordinal),
            RegisterableRoles = [.. RegisterableRoles],
            StorefrontModes = StorefrontModes.ToDictionary(
                kv => kv.Key,
                kv => new StorefrontModeDefinition
                {
                    Features = [.. kv.Value.Features],
                    DeniedPermissions = [.. kv.Value.DeniedPermissions]
                },
                StringComparer.Ordinal),
            PermissionCatalog = PermissionCatalog
                .Select(e => new PermissionCatalogEntry
                {
                    Id = e.Id,
                    Label = e.Label,
                    Group = e.Group
                })
                .ToList()
        };

        var catalogIds = new HashSet<string>(
            merged.PermissionCatalog.Select(e => e.Id),
            StringComparer.Ordinal);

        foreach (var entry in overlay.PermissionCatalog)
        {
            if (string.IsNullOrWhiteSpace(entry.Id) || !catalogIds.Add(entry.Id.Trim().ToLowerInvariant()))
                continue;
            merged.PermissionCatalog.Add(new PermissionCatalogEntry
            {
                Id = entry.Id.Trim().ToLowerInvariant(),
                Label = entry.Label,
                Group = entry.Group
            });
        }

        foreach (var (modeKey, features) in overlay.StorefrontModeFeatures)
        {
            var mode = modeKey.Trim().ToLowerInvariant();
            if (!merged.StorefrontModes.TryGetValue(mode, out var modeDef))
            {
                merged.StorefrontModes[mode] = new StorefrontModeDefinition
                {
                    Features = features
                        .Select(f => f.Trim().ToLowerInvariant())
                        .Where(f => f.Length > 0)
                        .Distinct(StringComparer.Ordinal)
                        .ToList()
                };
                continue;
            }

            var set = new HashSet<string>(modeDef.Features, StringComparer.Ordinal);
            foreach (var feature in features)
            {
                var f = feature.Trim().ToLowerInvariant();
                if (f.Length > 0)
                    set.Add(f);
            }

            modeDef.Features = set.OrderBy(f => f, StringComparer.Ordinal).ToList();
        }

        return merged;
    }

    public IEnumerable<string> EnumeratePermissionIds()
    {
        var ids = new HashSet<string>(StringComparer.Ordinal);
        foreach (var entry in PermissionCatalog)
        {
            if (!string.IsNullOrWhiteSpace(entry.Id))
                ids.Add(entry.Id.Trim().ToLowerInvariant());
        }

        foreach (var role in Roles.Values)
        {
            foreach (var permission in role.Permissions)
            {
                if (string.IsNullOrWhiteSpace(permission) || permission == "*")
                    continue;
                ids.Add(permission.Trim().ToLowerInvariant());
            }
        }

        return ids.OrderBy(id => id, StringComparer.Ordinal);
    }

    public bool HasPermission(string role, string storefrontMode, string permission)
    {
        if (string.IsNullOrWhiteSpace(role) || string.IsNullOrWhiteSpace(permission))
            return false;

        role = role.Trim().ToLowerInvariant();
        permission = permission.Trim().ToLowerInvariant();

        if (!Roles.TryGetValue(role, out var roleDef))
            return false;

        if (roleDef.Permissions.Contains("*", StringComparer.Ordinal))
            return !IsDenied(storefrontMode, permission);

        if (!roleDef.Permissions.Contains(permission, StringComparer.Ordinal))
            return false;

        return !IsDenied(storefrontMode, permission);
    }

    public IReadOnlyList<string> PermissionsFor(string role, string storefrontMode)
    {
        if (!Roles.TryGetValue(role.Trim().ToLowerInvariant(), out var roleDef))
            return Array.Empty<string>();

        if (roleDef.Permissions.Contains("*", StringComparer.Ordinal))
            return roleDef.Permissions.Where(p => !IsDenied(storefrontMode, p)).ToList();

        return roleDef.Permissions
            .Where(p => !IsDenied(storefrontMode, p))
            .ToList();
    }

    public IReadOnlyList<string> FeaturesFor(string storefrontMode)
    {
        if (!StorefrontModes.TryGetValue(storefrontMode.Trim().ToLowerInvariant(), out var mode))
            return Array.Empty<string>();
        return mode.Features;
    }

    private bool IsDenied(string storefrontMode, string permission)
    {
        if (!StorefrontModes.TryGetValue(storefrontMode.Trim().ToLowerInvariant(), out var mode))
            return false;
        return mode.DeniedPermissions.Contains(permission, StringComparer.Ordinal);
    }
}

public sealed class TenantCatalogDocument
{
    public int Version { get; set; } = 1;
    public List<TenantCatalogEntry> Tenants { get; set; } = [];

    public sealed class TenantCatalogEntry
    {
        public required string Id { get; set; }
        public required string Name { get; set; }
        public required string Slug { get; set; }
        public string StorefrontMode { get; set; } = StorefrontModes.IsolatedShop;
        public string? Vertical { get; set; }
        public bool IsActive { get; set; } = true;
        public List<string>? HostAliases { get; set; }
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true
    };

    public static TenantCatalogDocument LoadEmbedded()
    {
        var asm = typeof(TenantCatalogDocument).Assembly;
        const string resourceName = "Commerce.Api.Config.tenants.catalog.json";
        using var stream = asm.GetManifestResourceStream(resourceName)
            ?? throw new InvalidOperationException($"Embedded resource {resourceName} not found.");
        return JsonSerializer.Deserialize<TenantCatalogDocument>(stream, JsonOptions)
            ?? throw new InvalidOperationException("tenants.catalog.json deserialized to null.");
    }
}
