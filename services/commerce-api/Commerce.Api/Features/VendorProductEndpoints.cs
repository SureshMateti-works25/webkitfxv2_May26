using System.Security.Claims;
using Commerce.Api.Audit;
using Commerce.Api.Catalog;
using Commerce.Api.Data;
using Commerce.Api.Entities;
using Commerce.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using WebkitFx.Platform.Tenancy;

namespace Commerce.Api.Features;

public static class VendorProductEndpoints
{
    public static void MapVendorProductsV1(this WebApplication app)
    {
        const string tag = "vendor-products";
        const string auth = "Vendor";
        const string basePath = "/api/v1/vendor/products";

        app.MapGet(basePath, ListMine)
            .RequireAuthorization(auth)
            .WithTags(tag)
            .WithName("VendorListProducts");

        app.MapGet($"{basePath}/{{productId}}/storefront", GetStorefrontDetail)
            .RequireAuthorization(auth)
            .WithTags(tag)
            .WithName("VendorGetProductStorefront");

        app.MapGet($"{basePath}/{{productId}}", GetOne)
            .RequireAuthorization(auth)
            .WithTags(tag)
            .WithName("VendorGetProduct");

        app.MapPost(basePath, Create)
            .RequireAuthorization(auth)
            .WithTags(tag)
            .WithName("VendorCreateProduct");

        app.MapPut($"{basePath}/{{productId}}", Update)
            .RequireAuthorization(auth)
            .WithTags(tag)
            .WithName("VendorUpdateProduct");

        app.MapDelete($"{basePath}/{{productId}}", Delete)
            .RequireAuthorization(auth)
            .WithTags(tag)
            .WithName("VendorDeleteProduct");
    }

    private static string? PortalUserId(ClaimsPrincipal user) =>
        user.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? user.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);

    private static async Task<IResult> ListMine(
        HttpRequest request,
        ClaimsPrincipal user,
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(request.HttpContext, tenantContext, audit, ct);
        if (tenantFail is not null)
            return tenantFail;
        var tenantId = request.ResolveTenantId(tenantContext)!;
        var uid = PortalUserId(user);
        if (string.IsNullOrEmpty(uid))
            return Results.Unauthorized();

        if (!int.TryParse(request.Query["page"].ToString(), out var page) || page < 1)
            page = 1;
        if (!int.TryParse(request.Query["pageSize"].ToString(), out var pageSize) || pageSize < 1)
            pageSize = 24;
        pageSize = Math.Min(pageSize, 100);

        var q = db.Products.AsNoTracking()
            .Where(p => p.TenantId == tenantId && p.VendorPortalUserId == uid);

        var total = await q.CountAsync(ct);
        var raw = await q
            .OrderByDescending(p => p.PublishedAt ?? DateTimeOffset.MinValue)
            .ThenBy(p => p.TitleDisplay)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new
            {
                p.Id,
                p.Slug,
                p.TitleDisplay,
                p.Status,
                p.HeroStorageKey,
                HeroFromMedia = db.ProductMedia
                    .Where(pm => pm.ProductId == p.Id)
                    .Join(db.MediaAssets, pm => pm.MediaAssetId, ma => ma.Id, (pm, ma) => new { pm, ma })
                    .OrderBy(x => x.pm.SortOrder)
                    .ThenBy(x => x.pm.Id)
                    .Select(x => x.ma.StorageKey)
                    .FirstOrDefault(),
                p.MinPriceMinor,
                p.Currency,
                p.PublishedAt,
                p.CommerceJson,
                p.VendorPortalUserId
            })
            .ToListAsync(ct);

        var productIds = raw.Select(r => r.Id).ToList();
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

        var nowList = DateTimeOffset.UtcNow;
        var items = raw.Select(r =>
        {
            var f = CommercePricingCardReader.ReadCard(r.CommerceJson);
            var offerMinor = CommercePricingCardReader.ResolveOfferPriceMinorForCard(f, r.MinPriceMinor);
            var hero = r.HeroStorageKey ?? r.HeroFromMedia;
            var imageIndicators = ProductMerchandisingIndicators.Build(
                r.CommerceJson,
                r.MinPriceMinor,
                f.ListPriceMinor,
                offerMinor,
                f.OfferType,
                f.OfferCardText,
                r.PublishedAt,
                nowList,
                ProductMerchandisingIndicators.DefaultCardMax,
                compactCard: true);
            var vendorCode = CommerceVendorDisplayReader.ResolveVendorCode(r.CommerceJson, r.VendorPortalUserId);
            var skuCodes = skuByProduct.TryGetValue(r.Id, out var codes) ? codes : Array.Empty<string>();
            return new VendorProductListItem(
                r.Id,
                r.Slug,
                r.TitleDisplay,
                r.Status,
                hero,
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

        return Results.Ok(new VendorProductsPageResponse(page, pageSize, total, items));
    }

    private static async Task<IResult> GetStorefrontDetail(
        string productId,
        HttpRequest request,
        ClaimsPrincipal user,
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(request.HttpContext, tenantContext, audit, ct);
        if (tenantFail is not null)
            return tenantFail;
        var tenantId = request.ResolveTenantId(tenantContext)!;
        var uid = PortalUserId(user);
        if (string.IsNullOrEmpty(uid))
            return Results.Unauthorized();

        var dto = await CatalogProductDetailAssembler.BuildForVendorOwnedProductAsync(db, tenantId, productId, uid, ct);
        if (dto is null)
            return Results.NotFound();

        return Results.Ok(dto);
    }

    private static async Task<IResult> GetOne(
        string productId,
        HttpRequest request,
        ClaimsPrincipal user,
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(request.HttpContext, tenantContext, audit, ct);
        if (tenantFail is not null)
            return tenantFail;
        var tenantId = request.ResolveTenantId(tenantContext)!;
        var uid = PortalUserId(user);
        if (string.IsNullOrEmpty(uid))
            return Results.Unauthorized();

        var p = await db.Products.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == productId && x.TenantId == tenantId && x.VendorPortalUserId == uid, ct);
        if (p is null)
            return Results.NotFound();

        var primaryCat = await db.ProductCategories.AsNoTracking()
            .Where(pc => pc.ProductId == productId && pc.IsPrimary)
            .Select(pc => pc.CategoryId)
            .FirstOrDefaultAsync(ct);
        if (primaryCat is null)
        {
            primaryCat = await db.ProductCategories.AsNoTracking()
                .Where(pc => pc.ProductId == productId)
                .OrderBy(pc => pc.SortOrder)
                .Select(pc => pc.CategoryId)
                .FirstOrDefaultAsync(ct);
        }

        var dto = new VendorProductDetail(
            p.Id,
            p.Slug,
            p.TitleDisplay,
            p.Status,
            p.PublishedAt,
            p.HeroStorageKey,
            p.MinPriceMinor,
            p.Currency,
            primaryCat);
        return Results.Ok(dto);
    }

    private static async Task<IResult> Create(
        HttpRequest request,
        VendorProductWriteBody body,
        ClaimsPrincipal user,
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(request.HttpContext, tenantContext, audit, ct);
        if (tenantFail is not null)
            return tenantFail;
        var tenantId = request.ResolveTenantId(tenantContext)!;
        var uid = PortalUserId(user);
        if (string.IsNullOrEmpty(uid))
            return Results.Unauthorized();

        var title = body.Title?.Trim() ?? "";
        if (title.Length == 0)
            return Results.BadRequest(new { error = "title is required" });

        var status = NormalizeStatus(body.Status);
        if (body.CategoryId is { Length: > 0 } cid)
        {
            var catOk = await db.Categories.AsNoTracking()
                .AnyAsync(c => c.Id == cid && c.TenantId == tenantId, ct);
            if (!catOk)
                return Results.BadRequest(new { error = "Unknown categoryId for this tenant." });
        }

        var slug = await MakeUniqueSlug(db, tenantId, body.Slug, title, ct);
        var id = "p_" + Guid.NewGuid().ToString("N")[..12];
        var now = DateTimeOffset.UtcNow;

        var product = new Product
        {
            Id = id,
            TenantId = tenantId,
            VendorPortalUserId = uid,
            ProductTypeId = string.IsNullOrWhiteSpace(body.ProductTypeId) ? null : body.ProductTypeId!.Trim()[..Math.Min(64, body.ProductTypeId.Trim().Length)],
            CommerceJson =
                """{"pricing":{"offerType":"none","offerCardText":"","offerLabel":"","promoEndsAt":""},"vendor":{"vendorCode":"","outletCode":""},"tax":{"hsnCode":"","gstPercent":"","taxCategoryId":"","gstState":""},"enquiries":{"note":"Customer enquiries will appear when wired.","openCount":0},"orders":{"note":"Orders will appear when wired.","recentIds":[]},"typeAttributes":{}}""",
            Slug = slug,
            TitleDisplay = title,
            SearchText = title.ToLowerInvariant(),
            Status = status,
            PublishedAt = status == "active" ? now : null,
            HeroStorageKey = null,
            MinPriceMinor = body.MinPriceMinor,
            Currency = string.IsNullOrWhiteSpace(body.Currency) ? "INR" : body.Currency!.Trim()[..Math.Min(8, body.Currency.Trim().Length)],
        };

        db.Products.Add(product);

        if (body.CategoryId is { Length: > 0 } c2)
        {
            db.ProductCategories.Add(new ProductCategory
            {
                ProductId = id,
                CategoryId = c2,
                IsPrimary = true,
                SortOrder = 0
            });
        }

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            return Results.Conflict(new { error = "Could not save product (duplicate slug?)." });
        }

        await audit.RecordAsync(
            AuditActions.CatalogProductMutate,
            "success",
            tenantId,
            uid,
            "product",
            id,
            new { action = "create", slug },
            request.HttpContext,
            ct);

        return Results.Created($"/api/v1/vendor/products/{id}", new { id });
    }

    private static async Task<IResult> Update(
        string productId,
        HttpRequest request,
        VendorProductWriteBody body,
        ClaimsPrincipal user,
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(request.HttpContext, tenantContext, audit, ct);
        if (tenantFail is not null)
            return tenantFail;
        var tenantId = request.ResolveTenantId(tenantContext)!;
        var uid = PortalUserId(user);
        if (string.IsNullOrEmpty(uid))
            return Results.Unauthorized();

        var product = await db.Products
            .FirstOrDefaultAsync(p => p.Id == productId && p.TenantId == tenantId && p.VendorPortalUserId == uid, ct);
        if (product is null)
            return Results.NotFound();

        var title = body.Title?.Trim();
        if (title is { Length: > 0 })
        {
            product.TitleDisplay = title;
            product.SearchText = title.ToLowerInvariant();
        }

        if (body.Slug is { Length: > 0 } slugIn)
        {
            var s = Slugify(slugIn);
            if (s.Length == 0)
                return Results.BadRequest(new { error = "slug is invalid" });
            if (!await SlugAvailable(db, tenantId, s, productId, ct))
                return Results.Conflict(new { error = "slug already in use" });
            product.Slug = s;
        }

        if (body.Status is { Length: > 0 })
        {
            var status = NormalizeStatus(body.Status);
            product.Status = status;
            if (status == "active" && product.PublishedAt is null)
                product.PublishedAt = DateTimeOffset.UtcNow;
        }

        if (body.MinPriceMinor.HasValue)
            product.MinPriceMinor = body.MinPriceMinor;

        if (body.Currency is { Length: > 0 } cur)
            product.Currency = cur.Trim()[..Math.Min(8, cur.Trim().Length)];

        if (body.ProductTypeId is not null)
        {
            var tid = body.ProductTypeId.Trim();
            product.ProductTypeId = tid.Length == 0 ? null : tid[..Math.Min(64, tid.Length)];
        }

        if (body.CategoryId is not null)
        {
            if (body.CategoryId.Length == 0)
            {
                var old = await db.ProductCategories.Where(pc => pc.ProductId == productId).ToListAsync(ct);
                db.ProductCategories.RemoveRange(old);
            }
            else
            {
                var catOk = await db.Categories.AsNoTracking()
                    .AnyAsync(c => c.Id == body.CategoryId && c.TenantId == tenantId, ct);
                if (!catOk)
                    return Results.BadRequest(new { error = "Unknown categoryId for this tenant." });

                var old = await db.ProductCategories.Where(pc => pc.ProductId == productId).ToListAsync(ct);
                db.ProductCategories.RemoveRange(old);
                db.ProductCategories.Add(new ProductCategory
                {
                    ProductId = productId,
                    CategoryId = body.CategoryId,
                    IsPrimary = true,
                    SortOrder = 0
                });
            }
        }

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            return Results.Conflict(new { error = "Could not update product." });
        }

        await audit.RecordAsync(
            AuditActions.CatalogProductMutate,
            "success",
            tenantId,
            uid,
            "product",
            productId,
            new { action = "update" },
            request.HttpContext,
            ct);

        return Results.NoContent();
    }

    private static async Task<IResult> Delete(
        string productId,
        HttpRequest request,
        ClaimsPrincipal user,
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(request.HttpContext, tenantContext, audit, ct);
        if (tenantFail is not null)
            return tenantFail;
        var tenantId = request.ResolveTenantId(tenantContext)!;
        var uid = PortalUserId(user);
        if (string.IsNullOrEmpty(uid))
            return Results.Unauthorized();

        var product = await db.Products
            .FirstOrDefaultAsync(p => p.Id == productId && p.TenantId == tenantId && p.VendorPortalUserId == uid, ct);
        if (product is null)
            return Results.NotFound();

        db.Products.Remove(product);
        await db.SaveChangesAsync(ct);

        await audit.RecordAsync(
            AuditActions.CatalogProductMutate,
            "success",
            tenantId,
            uid,
            "product",
            productId,
            new { action = "delete" },
            request.HttpContext,
            ct);

        return Results.NoContent();
    }

    private static string NormalizeStatus(string? s)
    {
        var v = s?.Trim().ToLowerInvariant() ?? "draft";
        return v == "active" ? "active" : "draft";
    }

    private static string Slugify(string input)
    {
        var t = input.Trim().ToLowerInvariant();
        Span<char> buf = stackalloc char[t.Length];
        var j = 0;
        var prevDash = false;
        foreach (var c in t)
        {
            if (char.IsAsciiLetterOrDigit(c))
            {
                buf[j++] = c;
                prevDash = false;
            }
            else if (c is ' ' or '-' or '_')
            {
                if (!prevDash && j > 0)
                {
                    buf[j++] = '-';
                    prevDash = true;
                }
            }
        }

        var s = new string(buf[..j]).Trim('-');
        while (s.Contains("--", StringComparison.Ordinal))
            s = s.Replace("--", "-", StringComparison.Ordinal);
        return s;
    }

    private static async Task<string> MakeUniqueSlug(
        CommerceDbContext db,
        string tenantId,
        string? requestedSlug,
        string title,
        CancellationToken ct)
    {
        var baseSlug = requestedSlug is { Length: > 0 } rs ? Slugify(rs) : Slugify(title);
        if (baseSlug.Length == 0)
            baseSlug = "product-" + Guid.NewGuid().ToString("N")[..8];

        var slug = baseSlug;
        var n = 0;
        while (!await SlugAvailable(db, tenantId, slug, null, ct))
        {
            n++;
            slug = $"{baseSlug}-{n}";
        }

        return slug;
    }

    private static async Task<bool> SlugAvailable(
        CommerceDbContext db,
        string tenantId,
        string slug,
        string? exceptProductId,
        CancellationToken ct)
    {
        return !await db.Products.AnyAsync(
            p => p.TenantId == tenantId && p.Slug == slug && (exceptProductId == null || p.Id != exceptProductId),
            ct);
    }

    private sealed record VendorProductListItem(
        string Id,
        string Slug,
        string TitleDisplay,
        string Status,
        string? HeroStorageKey,
        long? MinPriceMinor,
        string? Currency,
        DateTimeOffset? PublishedAt,
        long? ListPriceMinor,
        string? OfferType,
        string? OfferCardText,
        long? OfferPriceMinor,
        IReadOnlyList<ProductImageIndicatorDto> ImageIndicators,
        string? VendorCode,
        IReadOnlyList<string> SkuCodes);

    private sealed record VendorProductsPageResponse(
        int Page,
        int PageSize,
        int TotalCount,
        IReadOnlyList<VendorProductListItem> Items);

    private sealed record VendorProductDetail(
        string Id,
        string Slug,
        string TitleDisplay,
        string Status,
        DateTimeOffset? PublishedAt,
        string? HeroStorageKey,
        long? MinPriceMinor,
        string? Currency,
        string? PrimaryCategoryId);

    private sealed class VendorProductWriteBody
    {
        public string? Title { get; set; }
        public string? Slug { get; set; }
        public string? Status { get; set; }
        public string? CategoryId { get; set; }
        public string? ProductTypeId { get; set; }
        public long? MinPriceMinor { get; set; }
        public string? Currency { get; set; }
    }
}
