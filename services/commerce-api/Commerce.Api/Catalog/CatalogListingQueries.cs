using Commerce.Api.Data;
using Commerce.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Commerce.Api.Catalog;

public static class CatalogListingQueries
{
    public static HashSet<string> ResolveCategoryScope(CommerceDbContext db, string tenantId, string? categoryId, bool includeSubtree)
    {
        if (string.IsNullOrEmpty(categoryId))
            return new HashSet<string>();

        var all = db.Categories.AsNoTracking().Where(c => c.TenantId == tenantId).ToList();
        var byParent = all
            .GroupBy(c => c.ParentId ?? string.Empty)
            .ToDictionary(g => g.Key, g => g.ToList());

        var set = new HashSet<string> { categoryId };
        if (!includeSubtree)
            return set;

        var stack = new Stack<string>();
        stack.Push(categoryId);
        while (stack.Count > 0)
        {
            var id = stack.Pop();
            if (!byParent.TryGetValue(id, out var kids))
                continue;
            foreach (var c in kids)
            {
                if (set.Add(c.Id))
                    stack.Push(c.Id);
            }
        }

        return set;
    }

    /// <summary>Parse <c>attr_color:av_maroon,attr_border:av_gold</c> (comma-separated def:value pairs).</summary>
    public static List<(string DefId, string ValueId)> ParseFacetFilters(string? filters)
    {
        if (string.IsNullOrWhiteSpace(filters))
            return [];

        var list = new List<(string, string)>();
        foreach (var part in filters.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var i = part.IndexOf(':');
            if (i <= 0 || i == part.Length - 1)
                continue;
            var def = part[..i].Trim();
            var val = part[(i + 1)..].Trim();
            if (def.Length > 0 && val.Length > 0)
                list.Add((def, val));
        }

        return list;
    }

    public static string EscapeLikePattern(string term)
    {
        return term.Replace("\\", "\\\\", StringComparison.Ordinal).Replace("%", "\\%", StringComparison.Ordinal).Replace("_", "\\_", StringComparison.Ordinal);
    }

    public static IQueryable<Product> BaseProductQuery(
        CommerceDbContext db,
        string tenantId,
        HashSet<string> categoryScope,
        string? collectionId,
        string? search,
        DateTimeOffset? now)
    {
        var q = db.Products.AsNoTracking().Where(p => p.TenantId == tenantId && p.Status == "active");

        if (categoryScope.Count > 0)
        {
            q = from p in q
                where db.ProductCategories.Any(pc => pc.ProductId == p.Id && categoryScope.Contains(pc.CategoryId))
                select p;
        }

        if (!string.IsNullOrEmpty(collectionId))
        {
            var activeFrom = now ?? DateTimeOffset.UtcNow;
            q = from p in q
                where db.CollectionItems.Any(ci => ci.ProductId == p.Id && ci.CollectionId == collectionId)
                where db.Collections.Any(c => c.Id == collectionId && c.TenantId == tenantId
                    && (c.ActiveFrom == null || c.ActiveFrom <= activeFrom)
                    && (c.ActiveTo == null || c.ActiveTo >= activeFrom))
                select p;
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            var esc = EscapeLikePattern(term);
            var pattern = $"%{esc}%";
            q = q.Where(p =>
                EF.Functions.ILike(p.TitleDisplay, pattern)
                || (p.SearchText != null && EF.Functions.ILike(p.SearchText, pattern)));
        }

        return q;
    }

    public static IQueryable<Product> ApplyFacetFilters(CommerceDbContext db, IQueryable<Product> q, List<(string DefId, string ValueId)> facets)
    {
        foreach (var (defId, valueId) in facets)
        {
            var d = defId;
            var v = valueId;
            q = from p in q
                where db.ProductFacets.Any(f => f.ProductId == p.Id && f.AttributeDefId == d && f.AttributeValueId == v)
                select p;
        }

        return q;
    }

    public static IQueryable<Product> ApplySort(IQueryable<Product> q, string? sort)
    {
        return sort?.ToLowerInvariant() switch
        {
            "published_asc" => q.OrderBy(p => p.PublishedAt).ThenBy(p => p.Id),
            "title_asc" => q.OrderBy(p => p.TitleDisplay).ThenBy(p => p.Id),
            "price_asc" => q.OrderBy(p => p.MinPriceMinor ?? long.MaxValue).ThenBy(p => p.Id),
            "price_desc" => q.OrderByDescending(p => p.MinPriceMinor ?? long.MinValue).ThenBy(p => p.Id),
            _ => q.OrderByDescending(p => p.PublishedAt).ThenBy(p => p.Id), // published_desc default
        };
    }
}
