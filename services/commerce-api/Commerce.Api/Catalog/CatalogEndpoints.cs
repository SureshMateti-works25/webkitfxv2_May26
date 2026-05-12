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
                p.CommerceJson,
                p.VendorPortalUserId
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
                skuCodes);
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

        var dto = await CatalogProductDetailAssembler.BuildForActiveCatalogAsync(db, tenantId, id, slug, ct);
        if (dto is null)
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
