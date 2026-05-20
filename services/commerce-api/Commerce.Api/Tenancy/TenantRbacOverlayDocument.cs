using System.Text.Json;

namespace Commerce.Api.Tenancy;

/// <summary>Vertical-specific RBAC additions (embedded config/commerce/rbac-overlays/*.json).</summary>
public sealed class TenantRbacOverlayDocument
{
    public string Vertical { get; set; } = "";

    public List<TenantRbacManifest.PermissionCatalogEntry> PermissionCatalog { get; set; } = [];

    public Dictionary<string, List<string>> StorefrontModeFeatures { get; set; } =
        new(StringComparer.Ordinal);

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true
    };

    public static TenantRbacOverlayDocument? TryLoadEmbedded(string verticalKey)
    {
        if (string.IsNullOrWhiteSpace(verticalKey))
            return null;

        var asm = typeof(TenantRbacOverlayDocument).Assembly;
        var resourceName = $"Commerce.Api.Config.rbac-overlays.{verticalKey}.json";
        using var stream = asm.GetManifestResourceStream(resourceName);
        if (stream is null)
            return null;

        return JsonSerializer.Deserialize<TenantRbacOverlayDocument>(stream, JsonOptions);
    }

    public static IReadOnlyDictionary<string, TenantRbacOverlayDocument> LoadAllEmbedded()
    {
        var asm = typeof(TenantRbacOverlayDocument).Assembly;
        const string prefix = "Commerce.Api.Config.rbac-overlays.";
        var map = new Dictionary<string, TenantRbacOverlayDocument>(StringComparer.Ordinal);

        foreach (var resourceName in asm.GetManifestResourceNames())
        {
            if (!resourceName.StartsWith(prefix, StringComparison.Ordinal)
                || !resourceName.EndsWith(".json", StringComparison.Ordinal))
                continue;

            using var stream = asm.GetManifestResourceStream(resourceName);
            if (stream is null)
                continue;

            var doc = JsonSerializer.Deserialize<TenantRbacOverlayDocument>(stream, JsonOptions);
            if (doc is null)
                continue;

            var fileKey = resourceName[prefix.Length..^".json".Length];
            var key = TenantRbacManifest.NormalizeVerticalKey(doc.Vertical) ?? fileKey;
            map[key] = doc;
        }

        return map;
    }
}
