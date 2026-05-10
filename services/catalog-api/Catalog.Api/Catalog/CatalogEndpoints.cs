using Catalog.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Catalog.Api.Catalog;

public static class CatalogEndpoints
{
    public static void MapCatalogV1(this WebApplication app)
    {
        app.MapGet("/api/v1/catalog/categories", ListCategories)
            .WithName("CatalogListCategories");

        app.MapGet("/api/v1/catalog/collections", ListCollections)
            .WithName("CatalogListCollections");

        app.MapGet("/api/v1/catalog/products", ListProducts)
            .WithName("CatalogListProducts");

        app.MapGet("/api/v1/catalog/categories/{categoryId}/products", ListProductsForCategory)
            .WithName("CatalogListProductsByCategory");

        app.MapGet("/api/v1/catalog/collections/{collectionId}/products", ListProductsForCollection)
            .WithName("CatalogListProductsByCollection");

        app.MapGet("/api/v1/catalog/facet-options", ListFacetOptions)
            .WithName("CatalogFacetOptions");
    }

    private static async Task<IResult> ListCategories(string tenantId, CatalogDbContext db, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            return Results.BadRequest(new { error = "tenantId is required" });

        var rows = await db.Categories.AsNoTracking()
            .Where(c => c.TenantId == tenantId)
            .OrderBy(c => c.SortOrder).ThenBy(c => c.Slug)
            .Select(c => new { c.Id, c.ParentId, c.Slug, c.SortOrder })
            .ToListAsync(ct);
        return Results.Ok(rows);
    }

    private static async Task<IResult> ListCollections(string tenantId, CatalogDbContext db, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            return Results.BadRequest(new { error = "tenantId is required" });

        var now = DateTimeOffset.UtcNow;
        var rows = await db.Collections.AsNoTracking()
            .Where(c => c.TenantId == tenantId
                && (c.ActiveFrom == null || c.ActiveFrom <= now)
                && (c.ActiveTo == null || c.ActiveTo >= now))
            .OrderBy(c => c.Slug)
            .Select(c => new { c.Id, c.Slug, c.Title, c.Channel, c.ActiveFrom, c.ActiveTo })
            .ToListAsync(ct);
        return Results.Ok(rows);
    }

    private static Task<IResult> ListProductsForCategory(
        string categoryId,
        HttpRequest req,
        CatalogDbContext db,
        CancellationToken ct)
        => ListProductsCore(req, db, categoryId: categoryId, collectionId: null, ct);

    private static Task<IResult> ListProductsForCollection(
        string collectionId,
        HttpRequest req,
        CatalogDbContext db,
        CancellationToken ct)
        => ListProductsCore(req, db, categoryId: null, collectionId: collectionId, ct);

    private static Task<IResult> ListProducts(HttpRequest req, CatalogDbContext db, CancellationToken ct)
        => ListProductsCore(req, db, categoryId: null, collectionId: null, ct);

    private static async Task<IResult> ListProductsCore(
        HttpRequest req,
        CatalogDbContext db,
        string? categoryId,
        string? collectionId,
        CancellationToken ct)
    {
        var tenantId = req.Query["tenantId"].ToString();
        if (string.IsNullOrWhiteSpace(tenantId))
            return Results.BadRequest(new { error = "tenantId is required" });

        var categoryIdQ = categoryId ?? req.Query["categoryId"].ToString();
        if (string.IsNullOrEmpty(categoryIdQ))
            categoryIdQ = null;

        var collectionIdQ = collectionId ?? req.Query["collectionId"].ToString();
        if (string.IsNullOrEmpty(collectionIdQ))
            collectionIdQ = null;

        var includeSubtree = string.Equals(req.Query["includeSubtree"].ToString(), "true", StringComparison.OrdinalIgnoreCase)
            || string.Equals(req.Query["includeSubtree"].ToString(), "1", StringComparison.OrdinalIgnoreCase);

        var search = req.Query["q"].ToString();
        var filters = req.Query["filters"].ToString();
        var sort = req.Query["sort"].ToString();
        var view = string.IsNullOrWhiteSpace(req.Query["view"].ToString()) ? "card" : req.Query["view"].ToString();

        if (!int.TryParse(req.Query["page"].ToString(), out var page) || page < 1)
            page = 1;
        if (!int.TryParse(req.Query["pageSize"].ToString(), out var pageSize) || pageSize < 1)
            pageSize = 24;
        pageSize = Math.Min(pageSize, 100);

        var scope = CatalogListingQueries.ResolveCategoryScope(db, tenantId, categoryIdQ, includeSubtree);
        var facetPairs = CatalogListingQueries.ParseFacetFilters(filters);

        var now = DateTimeOffset.UtcNow;
        var baseQ = CatalogListingQueries.BaseProductQuery(db, tenantId, scope, collectionIdQ, search, now);
        var filtered = CatalogListingQueries.ApplyFacetFilters(db, baseQ, facetPairs);
        var sorted = CatalogListingQueries.ApplySort(filtered, sort);

        var total = await sorted.CountAsync(ct);
        var items = await sorted
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new ProductCardDto(
                p.Id,
                p.Slug,
                p.TitleDisplay,
                p.HeroStorageKey,
                p.MinPriceMinor,
                p.Currency,
                p.PublishedAt))
            .ToListAsync(ct);

        return Results.Ok(new PagedProductsResponse(view, page, pageSize, total, items));
    }

    private static async Task<IResult> ListFacetOptions(HttpRequest req, CatalogDbContext db, CancellationToken ct)
    {
        var tenantId = req.Query["tenantId"].ToString();
        if (string.IsNullOrWhiteSpace(tenantId))
            return Results.BadRequest(new { error = "tenantId is required" });

        var categoryId = req.Query["categoryId"].ToString();
        if (string.IsNullOrEmpty(categoryId))
            categoryId = null;

        var includeSubtree = string.Equals(req.Query["includeSubtree"].ToString(), "true", StringComparison.OrdinalIgnoreCase)
            || string.Equals(req.Query["includeSubtree"].ToString(), "1", StringComparison.OrdinalIgnoreCase);

        var collectionId = req.Query["collectionId"].ToString();
        if (string.IsNullOrEmpty(collectionId))
            collectionId = null;

        var search = req.Query["q"].ToString();

        var scope = CatalogListingQueries.ResolveCategoryScope(db, tenantId, categoryId, includeSubtree);
        var now = DateTimeOffset.UtcNow;
        var baseQ = CatalogListingQueries.BaseProductQuery(db, tenantId, scope, collectionId, search, now);

        var defs = await db.AttributeDefs.AsNoTracking()
            .Where(d => d.TenantId == tenantId && d.Filterable)
            .OrderBy(d => d.Code)
            .ToListAsync(ct);

        var groups = new List<FacetGroupDto>();
        foreach (var def in defs)
        {
            var values = await db.AttributeValues.AsNoTracking()
                .Where(v => v.AttributeDefId == def.Id)
                .OrderBy(v => v.SortKey).ThenBy(v => v.Code)
                .ToListAsync(ct);

            var valueDtos = new List<FacetValueOptionDto>();
            foreach (var val in values)
            {
                var cnt = await (
                    from p in baseQ
                    where db.ProductFacets.Any(f =>
                        f.ProductId == p.Id && f.AttributeDefId == def.Id && f.AttributeValueId == val.Id)
                    select p).CountAsync(ct);
                valueDtos.Add(new FacetValueOptionDto(val.Id, val.Code, val.LabelKey, val.SortKey, val.SwatchHex, cnt));
            }

            groups.Add(new FacetGroupDto(def.Id, def.Code, def.LabelKey, def.DisplayType, valueDtos));
        }

        return Results.Ok(new FacetOptionsResponse(groups));
    }
}
