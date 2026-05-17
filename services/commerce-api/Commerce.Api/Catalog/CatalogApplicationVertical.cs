using Commerce.Api.Data;
using Commerce.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Commerce.Api.Catalog;

/// <summary>
/// Maps tenant <c>application_type</c> / <c>app_type</c> lookup rows to canonical
/// <c>products.product_type_id</c> and to <c>product_departments</c> via <c>parent_value_id</c>.
/// </summary>
internal static class CatalogApplicationVertical
{
    public static readonly string[] ApplicationTypeLookupTypeIds = ["application_type", "app_type"];

    public const string ProductTypesLookupTypeId = "product_types";
    public const string ProductDepartmentsLookupTypeId = "product_departments";

    public static async Task<string> ResolveToProductTypeIdAsync(
        CommerceDbContext db,
        string tenantId,
        string productTypeOrApplicationId,
        CancellationToken ct)
    {
        var raw = productTypeOrApplicationId.Trim();
        if (raw.Length == 0)
            return raw;

        var productTypes = await LoadProductTypeRowsAsync(db, tenantId, ct);

        if (productTypes.Any(pt => string.Equals(pt.Id, raw, StringComparison.Ordinal)))
            return raw;

        var appRows = await LoadApplicationTypeRowsAsync(db, tenantId, ct);
        var appRow = appRows.FirstOrDefault(r => string.Equals(r.Id, raw, StringComparison.Ordinal));
        if (appRow is not null)
            return MapApplicationRowToProductTypeId(appRow, productTypes);

        return raw;
    }

    public static async Task<string?> ResolveApplicationTypeLookupIdForProductTypeAsync(
        CommerceDbContext db,
        string tenantId,
        string productTypeId,
        CancellationToken ct)
    {
        var canonical = (await ResolveToProductTypeIdAsync(db, tenantId, productTypeId, ct)).Trim();
        if (canonical.Length == 0)
            return null;

        var appRows = await LoadApplicationTypeRowsAsync(db, tenantId, ct);
        var productTypes = await LoadProductTypeRowsAsync(db, tenantId, ct);

        var direct = appRows.FirstOrDefault(r => string.Equals(r.Id, canonical, StringComparison.Ordinal));
        if (direct is not null)
            return direct.Id;

        foreach (var app in appRows)
        {
            if (string.Equals(MapApplicationRowToProductTypeId(app, productTypes), canonical, StringComparison.Ordinal))
                return app.Id;
        }

        return null;
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

    public static async Task<IReadOnlyList<string>> ResolveAllStorefrontProductTypeIdsAsync(
        CommerceDbContext db,
        string tenantId,
        CancellationToken ct)
    {
        var set = new HashSet<string>(StringComparer.Ordinal);

        foreach (var pt in await LoadProductTypeRowsAsync(db, tenantId, ct))
            set.Add(pt.Id);

        var appRows = await LoadApplicationTypeRowsAsync(db, tenantId, ct);
        var productTypes = await LoadProductTypeRowsAsync(db, tenantId, ct);
        foreach (var app in appRows)
            set.Add(MapApplicationRowToProductTypeId(app, productTypes));

        return set.ToList();
    }

    private static async Task<List<LookupValue>> LoadProductTypeRowsAsync(
        CommerceDbContext db,
        string tenantId,
        CancellationToken ct) =>
        await db.LookupValues.AsNoTracking()
            .Where(v => v.TenantId == tenantId && v.LookupTypeId == ProductTypesLookupTypeId)
            .ToListAsync(ct);

    private static async Task<List<LookupValue>> LoadApplicationTypeRowsAsync(
        CommerceDbContext db,
        string tenantId,
        CancellationToken ct)
    {
        var typeIds = await db.LookupTypes.AsNoTracking()
            .Where(t => t.TenantId == tenantId && ApplicationTypeLookupTypeIds.Contains(t.Id))
            .Select(t => t.Id)
            .ToListAsync(ct);

        if (typeIds.Count == 0)
            return [];

        return await db.LookupValues.AsNoTracking()
            .Where(v => v.TenantId == tenantId && typeIds.Contains(v.LookupTypeId))
            .OrderBy(v => v.SortOrder)
            .ThenBy(v => v.Code)
            .ToListAsync(ct);
    }

    internal static string MapApplicationRowToProductTypeId(LookupValue appRow, List<LookupValue> productTypes)
    {
        var id = appRow.Id.Trim();
        if (id.StartsWith("pt_", StringComparison.Ordinal))
            return id;

        var parent = appRow.ParentValueId?.Trim();
        if (!string.IsNullOrEmpty(parent)
            && productTypes.Any(pt => string.Equals(pt.Id, parent, StringComparison.Ordinal)))
            return parent;

        var code = appRow.Code.Trim();
        var label = appRow.Label.Trim();
        var codeLc = code.ToLowerInvariant();
        var labelLc = label.ToLowerInvariant();

        static LookupValue? FindProductType(
            List<LookupValue> types,
            Func<LookupValue, bool> predicate) =>
            types.FirstOrDefault(predicate);

        static bool IsGroceryish(string codeLc, string labelLc) =>
            codeLc is "gr" or "grocery"
            || codeLc.Contains("grocery", StringComparison.Ordinal)
            || codeLc.Contains("food", StringComparison.Ordinal)
            || labelLc.Contains("grocery", StringComparison.Ordinal)
            || labelLc.Contains("food", StringComparison.Ordinal);

        if (IsGroceryish(codeLc, labelLc))
        {
            var pt = FindProductType(productTypes, p =>
                string.Equals(p.Code, "pt_grocery", StringComparison.OrdinalIgnoreCase)
                || p.Code.Contains("grocery", StringComparison.OrdinalIgnoreCase)
                || p.Label.Contains("grocery", StringComparison.OrdinalIgnoreCase));
            if (pt is not null) return pt.Id;
            return "pt_grocery";
        }

        if (codeLc is "sr" or "saree" || labelLc.Contains("saree", StringComparison.Ordinal))
        {
            var pt = FindProductType(productTypes, p =>
                string.Equals(p.Code, "pt_saree", StringComparison.OrdinalIgnoreCase)
                || p.Code.Contains("saree", StringComparison.OrdinalIgnoreCase)
                || p.Label.Contains("saree", StringComparison.OrdinalIgnoreCase));
            if (pt is not null) return pt.Id;
            return "pt_saree";
        }

        var byCode = productTypes.FirstOrDefault(pt =>
            string.Equals(pt.Code, code, StringComparison.OrdinalIgnoreCase));
        if (byCode is not null)
            return byCode.Id;

        return id;
    }
}
