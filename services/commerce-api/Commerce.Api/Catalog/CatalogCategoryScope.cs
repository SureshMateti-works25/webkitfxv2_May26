using Commerce.Api.Data;
using Commerce.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Commerce.Api.Catalog;

/// <summary>
/// Storefront <c>product_categories</c> scope from <c>application_type</c> → <c>product_departments</c> → categories,
/// plus active products for the canonical <c>product_type_id</c>.
/// </summary>
internal static class CatalogCategoryScope
{
    public static async Task<HashSet<string>> BuildStorefrontScopeAsync(
        CommerceDbContext db,
        string tenantId,
        string productTypeId,
        bool includeDepartmentCategoryShell,
        CancellationToken ct)
    {
        const string catType = ProductCategoryLookup.LookupTypeId;

        var allCats = await db.LookupValues.AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.LookupTypeId == catType)
            .ToListAsync(ct);

        var departmentRows = await db.LookupValues.AsNoTracking()
            .Where(v => v.TenantId == tenantId && v.LookupTypeId == CatalogApplicationVertical.ProductDepartmentsLookupTypeId)
            .ToListAsync(ct);

        var appRows = await db.LookupValues.AsNoTracking()
            .Where(v => v.TenantId == tenantId && CatalogApplicationVertical.ApplicationTypeLookupTypeIds.Contains(v.LookupTypeId))
            .ToListAsync(ct);

        var allowedApplicationTypeIds = CatalogApplicationVertical.ResolveApplicationTypeIdsForStorefrontFilter(
            appRows,
            productTypeId);

        var allowedDepartmentIds = CatalogApplicationVertical.DepartmentIdsForApplicationTypes(
            departmentRows,
            allowedApplicationTypeIds);

        var productCategoryIdsByType = await LoadActiveProductCategoryIdsByTypeAsync(db, tenantId, ct);

        var scope = BuildScopeForDepartments(
            allCats,
            allowedDepartmentIds,
            allowedApplicationTypeIds,
            productTypeId,
            productCategoryIdsByType,
            includeDepartmentCategoryShell);

        foreach (var app in appRows)
        {
            if (allowedApplicationTypeIds.Contains(app.Id))
                continue;

            var otherDeptIds = CatalogApplicationVertical.DepartmentIdsForApplicationType(departmentRows, app.Id);
            RemoveCategoriesUnderDepartments(scope, allCats, otherDeptIds);
        }

        return scope;
    }

    private static HashSet<string> BuildScopeForDepartments(
        List<LookupValue> allCats,
        HashSet<string> allowedDepartmentIds,
        HashSet<string> allowedApplicationTypeIds,
        string productTypeId,
        Dictionary<string, List<string>> productCategoryIdsByType,
        bool includeDepartmentCategoryShell)
    {
        var scope = new HashSet<string>(StringComparer.Ordinal);
        var matchIds = CatalogApplicationVertical.ProductTypeIdsMatchingVertical(productTypeId);

        foreach (var c in allCats)
        {
            if (IsAllowedCategoryParent(c.ParentValueId, allowedDepartmentIds, allowedApplicationTypeIds))
                scope.Add(c.Id);
        }

        foreach (var (typeId, categoryIds) in productCategoryIdsByType)
        {
            if (!matchIds.Contains(typeId))
                continue;

            foreach (var categoryId in categoryIds)
            {
                var cat = allCats.FirstOrDefault(c => c.Id == categoryId);
                if (cat is null) continue;
                if (!IsAllowedCategoryParent(cat.ParentValueId, allowedDepartmentIds, allowedApplicationTypeIds)
                    && (allowedDepartmentIds.Count > 0 || allowedApplicationTypeIds.Count > 0))
                    continue;
                scope.Add(categoryId);
            }
        }

        if (includeDepartmentCategoryShell)
        {
            foreach (var c in allCats)
            {
                if (IsAllowedCategoryParent(c.ParentValueId, allowedDepartmentIds, allowedApplicationTypeIds))
                    scope.Add(c.Id);
            }
        }

        AddMerchandisingAncestors(scope, allCats);
        ExpandParentValueIdSiblings(scope, allCats, allowedDepartmentIds, allowedApplicationTypeIds);
        AddMerchandisingDescendants(scope, allCats);
        RestrictToAllowedParents(scope, allCats, allowedDepartmentIds, allowedApplicationTypeIds);

        return scope;
    }

    private static bool IsAllowedCategoryParent(
        string? parentValueId,
        HashSet<string> allowedDepartmentIds,
        HashSet<string> allowedApplicationTypeIds)
    {
        if (string.IsNullOrEmpty(parentValueId)) return false;
        if (allowedDepartmentIds.Contains(parentValueId)) return true;
        return allowedApplicationTypeIds.Contains(parentValueId);
    }

    private static void RemoveCategoriesUnderDepartments(
        HashSet<string> scope,
        List<LookupValue> allCats,
        HashSet<string> departmentIds)
    {
        if (departmentIds.Count == 0) return;
        foreach (var c in allCats)
        {
            var dept = c.ParentValueId;
            if (!string.IsNullOrEmpty(dept) && departmentIds.Contains(dept))
                scope.Remove(c.Id);
        }
    }

    private static void RestrictToAllowedParents(
        HashSet<string> scope,
        List<LookupValue> allCats,
        HashSet<string> allowedDepartmentIds,
        HashSet<string> allowedApplicationTypeIds)
    {
        if (allowedDepartmentIds.Count == 0 && allowedApplicationTypeIds.Count == 0)
            return;

        foreach (var id in scope.ToArray())
        {
            var cat = allCats.FirstOrDefault(c => c.Id == id);
            if (cat is null)
            {
                scope.Remove(id);
                continue;
            }

            if (!IsAllowedCategoryParent(cat.ParentValueId, allowedDepartmentIds, allowedApplicationTypeIds))
                scope.Remove(id);
        }
    }

    private static async Task<Dictionary<string, List<string>>> LoadActiveProductCategoryIdsByTypeAsync(
        CommerceDbContext db,
        string tenantId,
        CancellationToken ct)
    {
        var pairs = await (
            from pc in db.ProductCategories.AsNoTracking()
            join p in db.Products.AsNoTracking() on pc.ProductId equals p.Id
            where p.TenantId == tenantId
                  && p.Status == "active"
                  && p.ProductTypeId != null
                  && p.ProductTypeId != ""
            select new { TypeId = p.ProductTypeId!, pc.CategoryId }).Distinct().ToListAsync(ct);

        var map = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        foreach (var row in pairs)
        {
            if (!map.TryGetValue(row.TypeId, out var list))
            {
                list = [];
                map[row.TypeId] = list;
            }
            list.Add(row.CategoryId);
        }
        return map;
    }

    private static void ExpandParentValueIdSiblings(
        HashSet<string> scope,
        List<LookupValue> allCats,
        HashSet<string> allowedDepartmentIds,
        HashSet<string> allowedApplicationTypeIds)
    {
        var parentValueIds = allCats
            .Where(c => scope.Contains(c.Id))
            .Select(c => c.ParentValueId)
            .Where(pid => !string.IsNullOrEmpty(pid))
            .Distinct(StringComparer.Ordinal)
            .ToList();

        foreach (var pv in parentValueIds)
        {
            if (!IsAllowedCategoryParent(pv, allowedDepartmentIds, allowedApplicationTypeIds))
                continue;

            foreach (var c in allCats)
            {
                if (string.Equals(c.ParentValueId, pv, StringComparison.Ordinal))
                    scope.Add(c.Id);
            }
        }
    }

    private static void AddMerchandisingAncestors(HashSet<string> set, List<LookupValue> all)
    {
        var byId = all.ToDictionary(x => x.Id, StringComparer.Ordinal);
        foreach (var startId in set.ToArray())
        {
            if (!byId.TryGetValue(startId, out var cur))
                continue;
            while (cur is not null)
            {
                if (string.IsNullOrEmpty(cur.MerchandisingParentId))
                    break;
                if (!byId.TryGetValue(cur.MerchandisingParentId, out var parent))
                    break;
                if (!set.Add(parent.Id))
                    break;
                cur = parent;
            }
        }
    }

    private static void AddMerchandisingDescendants(HashSet<string> set, List<LookupValue> all)
    {
        var byMerchParent = new Dictionary<string, List<LookupValue>>(StringComparer.Ordinal);
        foreach (var c in all)
        {
            var mp = c.MerchandisingParentId;
            if (string.IsNullOrEmpty(mp)) continue;
            if (!byMerchParent.TryGetValue(mp, out var list))
            {
                list = [];
                byMerchParent[mp] = list;
            }
            list.Add(c);
        }

        var queue = new Queue<string>(set.ToArray());
        while (queue.Count > 0)
        {
            var parentId = queue.Dequeue();
            if (!byMerchParent.TryGetValue(parentId, out var children)) continue;
            foreach (var child in children)
            {
                if (set.Add(child.Id))
                    queue.Enqueue(child.Id);
            }
        }
    }
}

