using Commerce.Api.Data;
using Commerce.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Commerce.Api.Catalog;

/// <summary>
/// Storefront vertical from <c>application_type</c> lookup rows (<c>app_sr</c>, <c>app_gr</c>, <c>app_cafe</c>).
/// Values are stored on <c>products.product_type_id</c> and orders.
/// </summary>
internal static class CatalogApplicationVertical
{
    public const string ApplicationTypeLookupTypeId = "application_type";

    public static readonly string[] ApplicationTypeLookupTypeIds = [ApplicationTypeLookupTypeId];

    /// <summary>Legacy lookup removed; kept for migration helpers only.</summary>
    public const string LegacyProductTypesLookupTypeId = "product_types";

    public const string ProductDepartmentsLookupTypeId = "product_departments";

    private static readonly (string LegacyPt, string App)[] LegacyPtToApp =
    [
        ("pt_saree", "app_sr"),
        ("pt_grocery", "app_gr"),
        ("pt_cafe", "app_cafe"),
    ];

    public static async Task<string> ResolveToProductTypeIdAsync(
        CommerceDbContext db,
        string tenantId,
        string productTypeOrApplicationId,
        CancellationToken ct)
    {
        var raw = productTypeOrApplicationId.Trim();
        if (raw.Length == 0)
            return raw;

        if (raw.StartsWith("app_", StringComparison.Ordinal))
            return raw;

        var appRows = await LoadApplicationTypeRowsAsync(db, tenantId, ct);
        var appRow = appRows.FirstOrDefault(r => string.Equals(r.Id, raw, StringComparison.Ordinal));
        if (appRow is not null)
            return appRow.Id;

        if (raw.StartsWith("pt_", StringComparison.Ordinal))
        {
            var mapped = LegacyPtToApp.FirstOrDefault(x => x.LegacyPt == raw).App;
            if (mapped is not null && appRows.Any(r => r.Id == mapped))
                return mapped;

            var byParent = appRows.FirstOrDefault(r =>
                string.Equals(r.ParentValueId, raw, StringComparison.Ordinal));
            if (byParent is not null)
                return byParent.Id;
        }

        return raw;
    }

    public static async Task<string?> ResolveApplicationTypeLookupIdForProductTypeAsync(
        CommerceDbContext db,
        string tenantId,
        string productTypeId,
        CancellationToken ct)
    {
        var raw = productTypeId.Trim();
        if (raw.Length == 0)
            return null;

        if (raw.StartsWith("app_", StringComparison.Ordinal))
            return raw;

        var resolved = await ResolveToProductTypeIdAsync(db, tenantId, raw, ct);
        return resolved.StartsWith("app_", StringComparison.Ordinal) ? resolved : null;
    }

    public static HashSet<string> ProductTypeIdsMatchingVertical(string canonicalApplicationTypeId)
    {
        var set = new HashSet<string>(StringComparer.Ordinal)
        {
            canonicalApplicationTypeId.Trim()
        };

        foreach (var (legacyPt, app) in LegacyPtToApp)
        {
            if (string.Equals(app, canonicalApplicationTypeId, StringComparison.Ordinal))
                set.Add(legacyPt);
        }

        return set;
    }

    /// <summary>
    /// All <c>products.product_type_id</c> values that belong to a storefront vertical filter
    /// (seeded <c>app_*</c>, legacy <c>pt_*</c>, and Admin-created application_type row ids).
    /// </summary>
    public static async Task<HashSet<string>> ResolveProductTypeIdsForCatalogFilterAsync(
        CommerceDbContext db,
        string tenantId,
        string productTypeOrApplicationId,
        CancellationToken ct)
    {
        var filter = productTypeOrApplicationId.Trim();
        var set = new HashSet<string>(StringComparer.Ordinal);
        if (filter.Length == 0)
            return set;

        var appRows = await LoadApplicationTypeRowsAsync(db, tenantId, ct);
        foreach (var id in ResolveApplicationTypeIdsForStorefrontFilter(appRows, filter))
            set.Add(id);

        var canonical = await ResolveToProductTypeIdAsync(db, tenantId, filter, ct);
        foreach (var id in ProductTypeIdsMatchingVertical(canonical))
            set.Add(id);

        if (set.Count == 0)
            set.Add(filter);

        return set;
    }

    public static HashSet<string> DepartmentIdsForApplicationType(
        IReadOnlyList<LookupValue> departmentRows,
        string? applicationTypeLookupId)
    {
        if (string.IsNullOrWhiteSpace(applicationTypeLookupId))
            return new HashSet<string>(StringComparer.Ordinal);

        var appId = applicationTypeLookupId.Trim();
        return departmentRows
            .Where(d => string.Equals(d.ParentValueId, appId, StringComparison.Ordinal))
            .Select(d => d.Id)
            .ToHashSet(StringComparer.Ordinal);
    }

    /// <summary>
    /// All <c>application_type</c> row ids for a storefront filter (e.g. <c>app_cafe</c> plus Admin-created Café rows).
    /// </summary>
    public static HashSet<string> ResolveApplicationTypeIdsForStorefrontFilter(
        IReadOnlyList<LookupValue> applicationTypeRows,
        string productTypeOrApplicationId)
    {
        var filter = productTypeOrApplicationId.Trim();
        var set = new HashSet<string>(StringComparer.Ordinal);
        if (filter.Length == 0)
            return set;

        foreach (var app in applicationTypeRows)
        {
            if (BelongsToStorefrontVertical(app, filter))
                set.Add(app.Id);
        }

        if (set.Count == 0 && filter.StartsWith("app_", StringComparison.Ordinal))
            set.Add(filter);

        return set;
    }

    public static HashSet<string> DepartmentIdsForApplicationTypes(
        IReadOnlyList<LookupValue> departmentRows,
        IEnumerable<string> applicationTypeIds)
    {
        var deptIds = new HashSet<string>(StringComparer.Ordinal);
        foreach (var appId in applicationTypeIds)
        {
            foreach (var id in DepartmentIdsForApplicationType(departmentRows, appId))
                deptIds.Add(id);
        }

        return deptIds;
    }

    private static bool BelongsToStorefrontVertical(LookupValue app, string filter)
    {
        if (string.Equals(app.Id, filter, StringComparison.Ordinal))
            return true;

        var code = app.Code.Trim().ToLowerInvariant();
        var label = app.Label.Trim().ToLowerInvariant();

        if (filter is "app_cafe" or "pt_cafe")
            return IsCafeish(code, label);

        if (filter is "app_sr" or "pt_saree")
            return IsSareeish(code, label);

        if (filter is "app_gr" or "pt_grocery")
            return IsGroceryish(code, label);

        if (filter.StartsWith("app_", StringComparison.Ordinal))
            return string.Equals(app.Id, filter, StringComparison.Ordinal);

        return false;
    }

    private static bool IsCafeish(string codeLc, string labelLc) =>
        codeLc is "cafe" or "pt_cafe"
        || codeLc.Contains("cafe", StringComparison.Ordinal)
        || labelLc.Contains("café", StringComparison.Ordinal)
        || labelLc.Contains("cafe", StringComparison.Ordinal);

    private static bool IsSareeish(string codeLc, string labelLc) =>
        codeLc is "sr" or "saree" or "pt_saree"
        || codeLc.Contains("saree", StringComparison.Ordinal)
        || labelLc.Contains("saree", StringComparison.Ordinal);

    private static bool IsGroceryish(string codeLc, string labelLc) =>
        codeLc is "gr" or "grocery" or "pt_grocery"
        || codeLc.Contains("grocery", StringComparison.Ordinal)
        || codeLc.Contains("food", StringComparison.Ordinal)
        || labelLc.Contains("grocery", StringComparison.Ordinal)
        || labelLc.Contains("food", StringComparison.Ordinal);

    public static async Task<IReadOnlyList<string>> ResolveAllStorefrontProductTypeIdsAsync(
        CommerceDbContext db,
        string tenantId,
        CancellationToken ct)
    {
        var appRows = await LoadApplicationTypeRowsAsync(db, tenantId, ct);
        return appRows.Select(r => r.Id).Distinct(StringComparer.Ordinal).ToList();
    }

    private static async Task<List<LookupValue>> LoadApplicationTypeRowsAsync(
        CommerceDbContext db,
        string tenantId,
        CancellationToken ct)
    {
        return await db.LookupValues.AsNoTracking()
            .Where(v => v.TenantId == tenantId && v.LookupTypeId == ApplicationTypeLookupTypeId)
            .OrderBy(v => v.SortOrder)
            .ThenBy(v => v.Code)
            .ToListAsync(ct);
    }
}
