namespace Commerce.Api.Tenancy;

public sealed class TenantRbacService
{
    private readonly TenantRbacManifest _base;
    private readonly IReadOnlyDictionary<string, TenantRbacOverlayDocument> _overlays;

    public TenantRbacService()
    {
        _base = TenantRbacManifest.LoadEmbedded();
        _overlays = TenantRbacOverlayDocument.LoadAllEmbedded();
    }

    /// <summary>Platform-wide manifest (no vertical overlay).</summary>
    public TenantRbacManifest Manifest => _base;

    public TenantRbacManifest GetEffectiveManifest(string? vertical)
    {
        var key = TenantRbacManifest.NormalizeVerticalKey(vertical);
        if (key is null || !_overlays.TryGetValue(key, out var overlay))
            return _base;

        return _base.WithOverlay(overlay);
    }

    public bool HasPermission(
        string role,
        string storefrontMode,
        string permission,
        string? vertical = null) =>
        GetEffectiveManifest(vertical).HasPermission(role, storefrontMode, permission);

    public IReadOnlyList<string> PermissionsFor(
        string role,
        string storefrontMode,
        string? vertical = null) =>
        GetEffectiveManifest(vertical).PermissionsFor(role, storefrontMode);

    public IReadOnlyList<string> FeaturesFor(string storefrontMode, string? vertical = null) =>
        GetEffectiveManifest(vertical).FeaturesFor(storefrontMode);

    public bool CanSelfRegister(string? role) =>
        !string.IsNullOrWhiteSpace(role)
        && _base.RegisterableRoles.Contains(role.Trim().ToLowerInvariant(), StringComparer.Ordinal);

    public IReadOnlyList<string> AllPermissionIds()
    {
        var ids = new HashSet<string>(_base.EnumeratePermissionIds(), StringComparer.Ordinal);
        foreach (var overlay in _overlays.Values)
        {
            var merged = _base.WithOverlay(overlay);
            foreach (var id in merged.EnumeratePermissionIds())
                ids.Add(id);
        }

        return ids.OrderBy(id => id, StringComparer.Ordinal).ToList();
    }
}
