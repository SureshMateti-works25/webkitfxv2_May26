using Commerce.Api.Audit;
using Commerce.Api.Data;
using Commerce.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using WebkitFx.Platform.Tenancy;

namespace Commerce.Api.Catalog;

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

        app.MapGet("/api/v1/catalog/product-detail", GetProductDetail)
            .WithName("CatalogGetProductDetail");

        app.MapGet("/api/v1/catalog/categories/{categoryId}/products", ListProductsForCategory)
            .WithName("CatalogListProductsByCategory");

        app.MapGet("/api/v1/catalog/collections/{collectionId}/products", ListProductsForCollection)
            .WithName("CatalogListProductsByCollection");

        app.MapGet("/api/v1/catalog/facet-options", ListFacetOptions)
            .WithName("CatalogFacetOptions");
    }

    private static async Task<IResult> ListCategories(
        HttpRequest request,
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(request.HttpContext, tenantContext, audit, ct);
        if (tenantFail is not null)
            return tenantFail;
        var tenantId = request.ResolveTenantId(tenantContext)!;

        var rows = await db.Categories.AsNoTracking()
            .Where(c => c.TenantId == tenantId)
            .OrderBy(c => c.SortOrder).ThenBy(c => c.Slug)
            .Select(c => new { c.Id, c.ParentId, c.Slug, c.SortOrder })
            .ToListAsync(ct);
        return Results.Ok(rows);
    }

    private static async Task<IResult> ListCollections(
        HttpRequest request,
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(request.HttpContext, tenantContext, audit, ct);
        if (tenantFail is not null)
            return tenantFail;
        var tenantId = request.ResolveTenantId(tenantContext)!;

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
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
        => ListProductsCore(req, tenantContext, db, audit, categoryId: categoryId, collectionId: null, ct);

    private static Task<IResult> ListProductsForCollection(
        string collectionId,
        HttpRequest req,
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
        => ListProductsCore(req, tenantContext, db, audit, categoryId: null, collectionId: collectionId, ct);

    private static Task<IResult> ListProducts(
        HttpRequest req,
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
        => ListProductsCore(req, tenantContext, db, audit, categoryId: null, collectionId: null, ct);

    private static async Task<IResult> ListProductsCore(
        HttpRequest req,
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        string? categoryId,
        string? collectionId,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(req.HttpContext, tenantContext, audit, ct);
        if (tenantFail is not null)
            return tenantFail;
        var tenantId = req.ResolveTenantId(tenantContext)!;

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
        var slug = req.Query["slug"].ToString();
        if (string.IsNullOrWhiteSpace(slug))
            slug = null;

        if (!int.TryParse(req.Query["page"].ToString(), out var page) || page < 1)
            page = 1;
        if (!int.TryParse(req.Query["pageSize"].ToString(), out var pageSize) || pageSize < 1)
            pageSize = 24;
        pageSize = Math.Min(pageSize, 100);

        var scope = CatalogListingQueries.ResolveCategoryScope(db, tenantId, categoryIdQ, includeSubtree);
        var facetPairs = CatalogListingQueries.ParseFacetFilters(filters);

        var now = DateTimeOffset.UtcNow;
        var baseQ = CatalogListingQueries.BaseProductQuery(db, tenantId, scope, collectionIdQ, search, now, slug);
        var filtered = CatalogListingQueries.ApplyFacetFilters(db, baseQ, facetPairs);
        var sorted = CatalogListingQueries.ApplySort(filtered, sort);

        var total = await sorted.CountAsync(ct);
        var rows = await sorted
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new
            {
                p.Id,
                p.Slug,
                p.TitleDisplay,
                p.HeroStorageKey,
                p.MinPriceMinor,
                p.Currency,
                p.PublishedAt,
                p.CommerceJson
            })
            .ToListAsync(ct);
        var nowCard = DateTimeOffset.UtcNow;
        var items = rows.Select(r =>
        {
            var f = CommercePricingCardReader.ReadCard(r.CommerceJson);
            var offerMinor = CommercePricingCardReader.ResolveOfferPriceMinorForCard(f, r.MinPriceMinor);
            var imageIndicators = ProductMerchandisingIndicators.Build(
                r.CommerceJson,
                r.MinPriceMinor,
                f.ListPriceMinor,
                offerMinor,
                f.OfferType,
                f.OfferCardText,
                r.PublishedAt,
                nowCard,
                ProductMerchandisingIndicators.DefaultCardMax,
                compactCard: true);
            return new ProductCardDto(
                r.Id,
                r.Slug,
                r.TitleDisplay,
                r.HeroStorageKey,
                r.MinPriceMinor,
                r.Currency,
                r.PublishedAt,
                f.ListPriceMinor,
                f.OfferType,
                f.OfferCardText,
                offerMinor,
                imageIndicators);
        }).ToList();

        return Results.Ok(new PagedProductsResponse(view, page, pageSize, total, items));
    }

    private static async Task<IResult> GetProductDetail(
        HttpRequest req,
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(req.HttpContext, tenantContext, audit, ct);
        if (tenantFail is not null)
            return tenantFail;
        var tenantId = req.ResolveTenantId(tenantContext)!;

        var slug = req.Query["slug"].ToString().Trim();
        var id = req.Query["id"].ToString().Trim();
        if (slug.Length == 0 && id.Length == 0)
            return Results.BadRequest(new { error = "Provide slug or id." });

        var row = await db.Products.AsNoTracking()
            .Where(p => p.TenantId == tenantId && p.Status == "active")
            .Where(p => id.Length > 0 ? p.Id == id : p.Slug == slug)
            .Select(p => new
            {
                p.Id,
                p.Slug,
                p.TitleDisplay,
                p.HeroStorageKey,
                p.MinPriceMinor,
                p.Currency,
                p.PublishedAt,
                p.CommerceJson
            })
            .FirstOrDefaultAsync(ct);

        if (row is null)
            return Results.NotFound();

        var galleryRows = await (
            from pm in db.ProductMedia.AsNoTracking()
            join ma in db.MediaAssets.AsNoTracking() on pm.MediaAssetId equals ma.Id
            where pm.ProductId == row.Id && ma.TenantId == tenantId && pm.SkuId == null
            orderby pm.SortOrder, pm.Id
            select new { ma.StorageKey, pm.Role, pm.SortOrder }
        ).ToListAsync(ct);

        var gallery = galleryRows
            .Select(g => new ProductGalleryImageDto(g.StorageKey, g.Role, g.SortOrder))
            .ToList();

        var now = DateTimeOffset.UtcNow;
        var f = CommercePricingCardReader.ReadCard(row.CommerceJson);
        var offerMinor = CommercePricingCardReader.ResolveOfferPriceMinorForCard(f, row.MinPriceMinor);
        var imageIndicators = ProductMerchandisingIndicators.Build(
            row.CommerceJson,
            row.MinPriceMinor,
            f.ListPriceMinor,
            offerMinor,
            f.OfferType,
            f.OfferCardText,
            row.PublishedAt,
            now,
            ProductMerchandisingIndicators.DefaultDetailMax,
            compactCard: false);

        return Results.Ok(new ProductDetailDto(
            row.Id,
            row.Slug,
            row.TitleDisplay,
            row.HeroStorageKey,
            row.MinPriceMinor,
            row.Currency,
            row.PublishedAt,
            f.ListPriceMinor,
            f.OfferType,
            f.OfferCardText,
            offerMinor,
            imageIndicators,
            gallery));
    }

    private static async Task<IResult> ListFacetOptions(
        HttpRequest req,
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(req.HttpContext, tenantContext, audit, ct);
        if (tenantFail is not null)
            return tenantFail;
        var tenantId = req.ResolveTenantId(tenantContext)!;

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
        var baseQ = CatalogListingQueries.BaseProductQuery(db, tenantId, scope, collectionId, search, now, slug: null);

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
