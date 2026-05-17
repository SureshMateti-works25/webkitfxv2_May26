using Commerce.Api.Audit;
using Commerce.Api.Data;
using Commerce.Api.Entities;
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
        app.MapGet("/api/v1/catalog/products/{productId}/engagement", GetProductEngagement)
            .WithName("CatalogGetProductEngagement");
        app.MapPost("/api/v1/catalog/products/{productId}/view", TrackProductView)
            .WithName("CatalogTrackProductView");
        app.MapPost("/api/v1/catalog/products/{productId}/ratings", AddProductRating)
            .WithName("CatalogAddProductRating");
        app.MapPost("/api/v1/catalog/products/{productId}/like", IncrementProductLike)
            .WithName("CatalogIncrementProductLike");
        app.MapPost("/api/v1/catalog/products/{productId}/dislike", IncrementProductDislike)
            .WithName("CatalogIncrementProductDislike");
        app.MapPost("/api/v1/catalog/products/{productId}/comments", AddProductComment)
            .WithName("CatalogAddProductComment");

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

        var productTypeFilter = request.Query["productTypeId"].ToString().Trim();
        if (productTypeFilter.Length > 64)
            productTypeFilter = productTypeFilter[..64];
        var excludeTypeFilter = request.Query["excludeProductTypeId"].ToString().Trim();
        if (excludeTypeFilter.Length > 64)
            excludeTypeFilter = excludeTypeFilter[..64];

        static bool QueryFlag(IQueryCollection q, string name) =>
            string.Equals(q[name].ToString(), "true", StringComparison.OrdinalIgnoreCase)
            || q[name].ToString() == "1";

        var includeAllProductCategories = QueryFlag(request.Query, "includeAllProductCategories");

        const string catType = ProductCategoryLookup.LookupTypeId;

        // Full merchandising tree from lookup_values (even aisles with no active products yet).
        if (includeAllProductCategories)
        {
            if (!string.IsNullOrEmpty(productTypeFilter))
            {
                // Scope from tenant lookups (application_type → product_types, departments, categories) and active
                // product assignments; optional shell adds empty aisles for departments not exclusive to other types.
                var canonicalProductTypeId = await CatalogApplicationVertical.ResolveToProductTypeIdAsync(
                    db, tenantId, productTypeFilter, ct);
                var includeShell = QueryFlag(request.Query, "includeDepartmentCategoryShell");
                var includedForIncludeAll = await CatalogCategoryScope.BuildStorefrontScopeAsync(
                    db, tenantId, canonicalProductTypeId, includeShell, ct);

                var allCatsForFilter = await db.LookupValues.AsNoTracking()
                    .Where(c => c.TenantId == tenantId && c.LookupTypeId == catType)
                    .ToListAsync(ct);

                var rowsByType = allCatsForFilter
                    .Where(c => includedForIncludeAll.Contains(c.Id))
                    .OrderBy(c => c.SortOrder).ThenBy(c => c.Code)
                    .Select(c => new
                    {
                        c.Id,
                        parentId = c.MerchandisingParentId,
                        parentValueId = c.ParentValueId,
                        slug = c.Code,
                        label = c.Label,
                        imageStorageKey = c.ImageStorageKey,
                        c.SortOrder
                    })
                    .ToList();
                return Results.Ok(rowsByType);
            }

            if (!string.IsNullOrEmpty(excludeTypeFilter))
            {
                var rowsEx = await db.LookupValues.AsNoTracking()
                    .Where(c => c.TenantId == tenantId && c.LookupTypeId == catType
                        && (c.ParentValueId == null || c.ParentValueId != excludeTypeFilter))
                    .OrderBy(c => c.SortOrder).ThenBy(c => c.Code)
                    .Select(c => new { c.Id, parentId = c.MerchandisingParentId, parentValueId = c.ParentValueId, slug = c.Code, label = c.Label, imageStorageKey = c.ImageStorageKey, c.SortOrder })
                    .ToListAsync(ct);
                return Results.Ok(rowsEx);
            }

            var rowsAllLookup = await db.LookupValues.AsNoTracking()
                .Where(c => c.TenantId == tenantId && c.LookupTypeId == catType)
                .OrderBy(c => c.SortOrder).ThenBy(c => c.Code)
                .Select(c => new { c.Id, parentId = c.MerchandisingParentId, parentValueId = c.ParentValueId, slug = c.Code, label = c.Label, imageStorageKey = c.ImageStorageKey, c.SortOrder })
                .ToListAsync(ct);
            return Results.Ok(rowsAllLookup);
        }

        if (string.IsNullOrEmpty(productTypeFilter))
        {
            if (string.IsNullOrEmpty(excludeTypeFilter))
            {
                var rowsAll = await db.LookupValues.AsNoTracking()
                    .Where(c => c.TenantId == tenantId && c.LookupTypeId == catType)
                    .OrderBy(c => c.SortOrder).ThenBy(c => c.Code)
                    .Select(c => new { c.Id, parentId = c.MerchandisingParentId, parentValueId = c.ParentValueId, slug = c.Code, label = c.Label, imageStorageKey = c.ImageStorageKey, c.SortOrder })
                    .ToListAsync(ct);
                return Results.Ok(rowsAll);
            }

            var categoryIdsMatchingExclude = await (
                from c in db.LookupValues.AsNoTracking()
                join pc in db.ProductCategories.AsNoTracking() on c.Id equals pc.CategoryId
                join p in db.Products.AsNoTracking() on pc.ProductId equals p.Id
                where c.TenantId == tenantId
                      && c.LookupTypeId == catType
                      && p.TenantId == tenantId
                      && p.Status == "active"
                      && (p.ProductTypeId == null || p.ProductTypeId != excludeTypeFilter)
                select c.Id).Distinct().ToListAsync(ct);

            var allCatsEx = await db.LookupValues.AsNoTracking()
                .Where(c => c.TenantId == tenantId && c.LookupTypeId == catType)
                .ToListAsync(ct);

            var includedEx = new HashSet<string>();
            foreach (var cid in categoryIdsMatchingExclude)
            {
                var cur = allCatsEx.FirstOrDefault(x => x.Id == cid);
                while (cur is not null)
                {
                    if (!includedEx.Add(cur.Id))
                        break;
                    cur = string.IsNullOrEmpty(cur.MerchandisingParentId)
                        ? null
                        : allCatsEx.FirstOrDefault(x => x.Id == cur.MerchandisingParentId);
                }
            }

            var rowsExclude = allCatsEx
                .Where(c => includedEx.Contains(c.Id))
                .OrderBy(c => c.SortOrder).ThenBy(c => c.Code)
                .Select(c => new { c.Id, parentId = c.MerchandisingParentId, parentValueId = c.ParentValueId, slug = c.Code, label = c.Label, imageStorageKey = c.ImageStorageKey, c.SortOrder })
                .ToList();
            return Results.Ok(rowsExclude);
        }

        var categoryIdsWithType = await (
            from c in db.LookupValues.AsNoTracking()
            join pc in db.ProductCategories.AsNoTracking() on c.Id equals pc.CategoryId
            join p in db.Products.AsNoTracking() on pc.ProductId equals p.Id
            where c.TenantId == tenantId
                  && c.LookupTypeId == catType
                  && p.TenantId == tenantId
                  && p.Status == "active"
                  && p.ProductTypeId == productTypeFilter
            select c.Id).Distinct().ToListAsync(ct);

        var allCats = await db.LookupValues.AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.LookupTypeId == catType)
            .ToListAsync(ct);

        var included = new HashSet<string>();
        foreach (var cid in categoryIdsWithType)
        {
            var cur = allCats.FirstOrDefault(x => x.Id == cid);
            while (cur is not null)
            {
                if (!included.Add(cur.Id))
                    break;
                cur = string.IsNullOrEmpty(cur.MerchandisingParentId)
                    ? null
                    : allCats.FirstOrDefault(x => x.Id == cur.MerchandisingParentId);
            }
        }

        var rowsFiltered = allCats
            .Where(c => included.Contains(c.Id))
            .OrderBy(c => c.SortOrder).ThenBy(c => c.Code)
            .Select(c => new { c.Id, parentId = c.MerchandisingParentId, parentValueId = c.ParentValueId, slug = c.Code, label = c.Label, imageStorageKey = c.ImageStorageKey, c.SortOrder })
            .ToList();
        return Results.Ok(rowsFiltered);
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

        var productTypeId = req.Query["productTypeId"].ToString().Trim();
        if (string.IsNullOrEmpty(productTypeId))
            productTypeId = null;
        else if (productTypeId.Length > 64)
            productTypeId = productTypeId[..64];

        var excludeProductTypeId = req.Query["excludeProductTypeId"].ToString().Trim();
        if (string.IsNullOrEmpty(excludeProductTypeId))
            excludeProductTypeId = null;
        else if (excludeProductTypeId.Length > 64)
            excludeProductTypeId = excludeProductTypeId[..64];
        if (productTypeId is not null)
            excludeProductTypeId = null;

        var scope = CatalogListingQueries.ResolveCategoryScope(db, tenantId, categoryIdQ, includeSubtree);
        var facetPairs = CatalogListingQueries.ParseFacetFilters(filters);

        var now = DateTimeOffset.UtcNow;
        var baseQ = CatalogListingQueries.BaseProductQuery(
            db, tenantId, scope, collectionIdQ, search, now, slug, productTypeId, excludeProductTypeId);
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
                p.CommerceJson,
                p.VendorPortalUserId,
                p.ProductTypeId
            })
            .ToListAsync(ct);

        var productIds = rows.Select(r => r.Id).ToList();
        IReadOnlyDictionary<string, IReadOnlyList<string>> skuByProduct;
        if (productIds.Count == 0)
        {
            skuByProduct = new Dictionary<string, IReadOnlyList<string>>();
        }
        else
        {
            var skuRows = await db.Skus.AsNoTracking()
                .Where(s => s.TenantId == tenantId && productIds.Contains(s.ProductId) && s.Status == "active")
                .OrderBy(s => s.SkuCode)
                .Select(s => new { s.ProductId, s.SkuCode })
                .ToListAsync(ct);
            skuByProduct = skuRows
                .GroupBy(x => x.ProductId)
                .ToDictionary(g => g.Key, g => (IReadOnlyList<string>)g.Select(x => x.SkuCode).ToList());
        }

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
            var vendorCode = CommerceVendorDisplayReader.ResolveVendorCode(r.CommerceJson, r.VendorPortalUserId);
            var skuCodes = skuByProduct.TryGetValue(r.Id, out var codes) ? codes : Array.Empty<string>();
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
                imageIndicators,
                vendorCode,
                skuCodes,
                r.ProductTypeId);
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

        var productTypeId = req.Query["productTypeId"].ToString().Trim();
        if (string.IsNullOrEmpty(productTypeId))
            productTypeId = null;
        else if (productTypeId.Length > 64)
            productTypeId = productTypeId[..64];

        var excludeProductTypeId = req.Query["excludeProductTypeId"].ToString().Trim();
        if (string.IsNullOrEmpty(excludeProductTypeId))
            excludeProductTypeId = null;
        else if (excludeProductTypeId.Length > 64)
            excludeProductTypeId = excludeProductTypeId[..64];

        var dto = await CatalogProductDetailAssembler.BuildForActiveCatalogAsync(db, tenantId, id, slug, productTypeId, ct);
        if (dto is null)
            return Results.NotFound();

        if (excludeProductTypeId is not null
            && !string.IsNullOrEmpty(dto.ProductTypeId)
            && string.Equals(dto.ProductTypeId, excludeProductTypeId, StringComparison.Ordinal))
            return Results.NotFound();

        return Results.Ok(dto);
    }

    private static async Task<IResult> GetProductEngagement(
        string productId,
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

        var exists = await db.Products.AsNoTracking()
            .AnyAsync(p => p.TenantId == tenantId && p.Id == productId, ct);
        if (!exists) return Results.NotFound();

        var summary = await db.ProductEngagementSummaries.AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.ProductId == productId, ct);
        var comments = await db.ProductComments.AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.ProductId == productId)
            .OrderByDescending(c => c.CreatedAt)
            .Take(20)
            .Select(c => new ProductCommentDto(c.Id, c.AuthorName, c.CommentText, c.CreatedAt))
            .ToListAsync(ct);

        var ratingsCount = summary?.RatingsCount ?? 0;
        var ratingsTotal = summary?.RatingsTotal ?? 0L;
        var averageRating = ratingsCount > 0 ? Math.Round((decimal)ratingsTotal / ratingsCount, 2) : 0m;
        var dto = new ProductEngagementDto(
            summary?.ViewsCount ?? 0,
            summary?.LikesCount ?? 0,
            summary?.DislikesCount ?? 0,
            ratingsCount,
            averageRating,
            summary?.CommentsCount ?? comments.Count,
            comments);
        return Results.Ok(dto);
    }

    private static async Task<IResult> TrackProductView(
        string productId,
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

        var exists = await db.Products.AsNoTracking()
            .AnyAsync(p => p.TenantId == tenantId && p.Id == productId, ct);
        if (!exists) return Results.NotFound();

        var summary = await db.ProductEngagementSummaries
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.ProductId == productId, ct);
        if (summary is null)
        {
            summary = new Entities.ProductEngagementSummary
            {
                TenantId = tenantId,
                ProductId = productId,
                ViewsCount = 1,
                LikesCount = 0,
                DislikesCount = 0,
                RatingsTotal = 0,
                RatingsCount = 0,
                CommentsCount = 0,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            db.ProductEngagementSummaries.Add(summary);
        }
        else
        {
            summary.ViewsCount += 1;
            summary.UpdatedAt = DateTimeOffset.UtcNow;
        }
        await db.SaveChangesAsync(ct);
        return Results.Ok(new { summary.ViewsCount });
    }

    private static async Task<IResult> IncrementProductLike(
        string productId,
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

        var exists = await db.Products.AsNoTracking()
            .AnyAsync(p => p.TenantId == tenantId && p.Id == productId, ct);
        if (!exists) return Results.NotFound();

        var summary = await db.ProductEngagementSummaries
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.ProductId == productId, ct);
        if (summary is null)
        {
            summary = new Entities.ProductEngagementSummary
            {
                TenantId = tenantId,
                ProductId = productId,
                ViewsCount = 0,
                LikesCount = 1,
                DislikesCount = 0,
                RatingsTotal = 0,
                RatingsCount = 0,
                CommentsCount = 0,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            db.ProductEngagementSummaries.Add(summary);
        }
        else
        {
            summary.LikesCount += 1;
            summary.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await db.SaveChangesAsync(ct);
        return Results.Ok(new { summary.LikesCount, summary.DislikesCount });
    }

    private static async Task<IResult> IncrementProductDislike(
        string productId,
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

        var exists = await db.Products.AsNoTracking()
            .AnyAsync(p => p.TenantId == tenantId && p.Id == productId, ct);
        if (!exists) return Results.NotFound();

        var summary = await db.ProductEngagementSummaries
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.ProductId == productId, ct);
        if (summary is null)
        {
            summary = new Entities.ProductEngagementSummary
            {
                TenantId = tenantId,
                ProductId = productId,
                ViewsCount = 0,
                LikesCount = 0,
                DislikesCount = 1,
                RatingsTotal = 0,
                RatingsCount = 0,
                CommentsCount = 0,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            db.ProductEngagementSummaries.Add(summary);
        }
        else
        {
            summary.DislikesCount += 1;
            summary.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await db.SaveChangesAsync(ct);
        return Results.Ok(new { summary.LikesCount, summary.DislikesCount });
    }

    private sealed record AddProductRatingBody(int Score, string? AuthorName, string? CommentText);
    private static async Task<IResult> AddProductRating(
        string productId,
        AddProductRatingBody body,
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

        if (body.Score < 1 || body.Score > 5)
            return Results.BadRequest(new { error = "Score must be between 1 and 5." });

        var exists = await db.Products.AsNoTracking()
            .AnyAsync(p => p.TenantId == tenantId && p.Id == productId, ct);
        if (!exists) return Results.NotFound();

        db.ProductRatings.Add(new Entities.ProductRating
        {
            Id = "pr_" + Guid.NewGuid().ToString("N")[..12],
            TenantId = tenantId,
            ProductId = productId,
            Score = body.Score,
            AuthorName = string.IsNullOrWhiteSpace(body.AuthorName) ? null : body.AuthorName.Trim()[..Math.Min(128, body.AuthorName.Trim().Length)],
            CommentText = string.IsNullOrWhiteSpace(body.CommentText) ? null : body.CommentText.Trim()[..Math.Min(2048, body.CommentText.Trim().Length)],
            CreatedAt = DateTimeOffset.UtcNow
        });

        var summary = await db.ProductEngagementSummaries
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.ProductId == productId, ct);
        if (summary is null)
        {
            summary = new Entities.ProductEngagementSummary
            {
                TenantId = tenantId,
                ProductId = productId,
                ViewsCount = 0,
                LikesCount = 0,
                DislikesCount = 0,
                RatingsTotal = body.Score,
                RatingsCount = 1,
                CommentsCount = 0,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            db.ProductEngagementSummaries.Add(summary);
        }
        else
        {
            summary.RatingsTotal += body.Score;
            summary.RatingsCount += 1;
            summary.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await db.SaveChangesAsync(ct);
        return Results.Ok(new { ok = true });
    }

    private sealed record AddProductCommentBody(string CommentText, string? AuthorName);
    private static async Task<IResult> AddProductComment(
        string productId,
        AddProductCommentBody body,
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

        var text = body.CommentText?.Trim() ?? "";
        if (text.Length == 0)
            return Results.BadRequest(new { error = "Comment text is required." });

        var exists = await db.Products.AsNoTracking()
            .AnyAsync(p => p.TenantId == tenantId && p.Id == productId, ct);
        if (!exists) return Results.NotFound();

        db.ProductComments.Add(new Entities.ProductComment
        {
            Id = "pc_" + Guid.NewGuid().ToString("N")[..12],
            TenantId = tenantId,
            ProductId = productId,
            CommentText = text[..Math.Min(2048, text.Length)],
            AuthorName = string.IsNullOrWhiteSpace(body.AuthorName) ? null : body.AuthorName.Trim()[..Math.Min(128, body.AuthorName.Trim().Length)],
            CreatedAt = DateTimeOffset.UtcNow
        });

        var summary = await db.ProductEngagementSummaries
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.ProductId == productId, ct);
        if (summary is null)
        {
            summary = new Entities.ProductEngagementSummary
            {
                TenantId = tenantId,
                ProductId = productId,
                ViewsCount = 0,
                LikesCount = 0,
                DislikesCount = 0,
                RatingsTotal = 0,
                RatingsCount = 0,
                CommentsCount = 1,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            db.ProductEngagementSummaries.Add(summary);
        }
        else
        {
            summary.CommentsCount += 1;
            summary.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await db.SaveChangesAsync(ct);
        return Results.Ok(new { ok = true });
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

        var productTypeId = req.Query["productTypeId"].ToString().Trim();
        if (string.IsNullOrEmpty(productTypeId))
            productTypeId = null;
        else if (productTypeId.Length > 64)
            productTypeId = productTypeId[..64];

        var excludeProductTypeId = req.Query["excludeProductTypeId"].ToString().Trim();
        if (string.IsNullOrEmpty(excludeProductTypeId))
            excludeProductTypeId = null;
        else if (excludeProductTypeId.Length > 64)
            excludeProductTypeId = excludeProductTypeId[..64];
        if (productTypeId is not null)
            excludeProductTypeId = null;

        var scope = CatalogListingQueries.ResolveCategoryScope(db, tenantId, categoryId, includeSubtree);
        var now = DateTimeOffset.UtcNow;
        var baseQ = CatalogListingQueries.BaseProductQuery(
            db, tenantId, scope, collectionId, search, now, slug: null, productTypeId, excludeProductTypeId);

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
