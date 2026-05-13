using Commerce.Api.Data;
using Commerce.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Commerce.Api.Catalog;

internal sealed record ProductDetailSource(
    string Id,
    string Slug,
    string TitleDisplay,
    string? HeroStorageKey,
    long? MinPriceMinor,
    string? Currency,
    DateTimeOffset? PublishedAt,
    string? CommerceJson,
    string? VendorPortalUserId,
    string? ProductTypeId);

public static class CatalogProductDetailAssembler
{
    public static async Task<ProductDetailDto?> BuildForActiveCatalogAsync(
        CommerceDbContext db,
        string tenantId,
        string? id,
        string? slug,
        string? requiredProductTypeId,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(id) && string.IsNullOrWhiteSpace(slug))
            return null;

        var tid = string.IsNullOrWhiteSpace(requiredProductTypeId) ? null : requiredProductTypeId.Trim();
        if (tid is { Length: > 64 })
            tid = tid[..64];

        var q = db.Products.AsNoTracking()
            .Where(p => p.TenantId == tenantId && p.Status == "active")
            .Where(p => !string.IsNullOrWhiteSpace(id) ? p.Id == id : p.Slug == slug);
        if (tid is not null)
            q = q.Where(p => p.ProductTypeId == tid);

        var row = await q
            .Select(p => new ProductDetailSource(
                p.Id,
                p.Slug,
                p.TitleDisplay,
                p.HeroStorageKey,
                p.MinPriceMinor,
                p.Currency,
                p.PublishedAt,
                p.CommerceJson,
                p.VendorPortalUserId,
                p.ProductTypeId))
            .FirstOrDefaultAsync(ct);

        if (row is null)
            return null;

        return await BuildDtoAsync(db, tenantId, row, ct);
    }

    public static async Task<ProductDetailDto?> BuildForActiveCatalogAsync(
        CommerceDbContext db,
        string tenantId,
        string? id,
        string? slug,
        CancellationToken ct)
        => await BuildForActiveCatalogAsync(db, tenantId, id, slug, null, ct);

    public static async Task<ProductDetailDto?> BuildForVendorOwnedProductAsync(
        CommerceDbContext db,
        string tenantId,
        string productId,
        string vendorPortalUserId,
        CancellationToken ct)
    {
        var row = await db.Products.AsNoTracking()
            .Where(p => p.TenantId == tenantId && p.Id == productId && p.VendorPortalUserId == vendorPortalUserId)
            .Select(p => new ProductDetailSource(
                p.Id,
                p.Slug,
                p.TitleDisplay,
                p.HeroStorageKey,
                p.MinPriceMinor,
                p.Currency,
                p.PublishedAt,
                p.CommerceJson,
                p.VendorPortalUserId,
                p.ProductTypeId))
            .FirstOrDefaultAsync(ct);

        if (row is null)
            return null;

        return await BuildDtoAsync(db, tenantId, row, ct);
    }

    private static async Task<ProductDetailDto> BuildDtoAsync(
        CommerceDbContext db,
        string tenantId,
        ProductDetailSource row,
        CancellationToken ct)
    {
        var skuCodes = await db.Skus.AsNoTracking()
            .Where(s => s.TenantId == tenantId && s.ProductId == row.Id && s.Status == "active")
            .OrderBy(s => s.SkuCode)
            .Select(s => s.SkuCode)
            .ToListAsync(ct);

        // Product-level media first, then SKU-scoped variant images (same rows the vendor attaches on SKUs).
        var galleryRows = await (
            from pm in db.ProductMedia.AsNoTracking()
            join ma in db.MediaAssets.AsNoTracking() on pm.MediaAssetId equals ma.Id
            join sku in db.Skus.AsNoTracking() on pm.SkuId equals sku.Id into skuJoin
            from sku in skuJoin.DefaultIfEmpty()
            where pm.ProductId == row.Id
                && ma.TenantId == tenantId
                && (pm.SkuId == null || (sku != null && sku.TenantId == tenantId && sku.ProductId == row.Id))
            orderby pm.SkuId == null ? 0 : 1,
                sku != null ? sku.SkuCode : "",
                pm.SortOrder,
                pm.Id
            select new { ma.StorageKey, pm.Role, pm.SortOrder, pm.SkuId }
        ).ToListAsync(ct);

        var gallery = galleryRows
            .Select(g => new ProductGalleryImageDto(g.StorageKey, g.Role, g.SortOrder, g.SkuId))
            .ToList();

        var (angles, colors) = CatalogProductGallerySplit.Split(gallery);

        var facetSkuIds = gallery
            .Where(x => !string.IsNullOrWhiteSpace(x.SkuId))
            .Select(x => x.SkuId!)
            .Distinct()
            .ToList();
        var skuOrderRows = await db.Skus.AsNoTracking()
            .Where(s => s.TenantId == tenantId && s.ProductId == row.Id && s.Status == "active" && facetSkuIds.Contains(s.Id))
            .OrderBy(s => s.SkuCode)
            .Select(s => new { s.Id, s.SkuCode })
            .ToListAsync(ct);
        var skuGalleryFacets = new List<SkuGalleryFacetDto>();
        foreach (var s in skuOrderRows)
        {
            var swatch = gallery.FirstOrDefault(g =>
                string.Equals(g.SkuId, s.Id, StringComparison.Ordinal) && CatalogProductGallerySplit.IsColorRole(g.Role));
            var fallback = gallery.FirstOrDefault(g => string.Equals(g.SkuId, s.Id, StringComparison.Ordinal));
            skuGalleryFacets.Add(new SkuGalleryFacetDto(s.Id, s.SkuCode, swatch?.StorageKey ?? fallback?.StorageKey));
        }

        var primarySlug = await (
                from pc in db.ProductCategories.AsNoTracking()
                where pc.ProductId == row.Id && pc.IsPrimary
                join c in db.LookupValues.AsNoTracking() on pc.CategoryId equals c.Id
                where c.TenantId == tenantId && c.LookupTypeId == ProductCategoryLookup.LookupTypeId
                select c.Code)
            .FirstOrDefaultAsync(ct);

        if (string.IsNullOrWhiteSpace(primarySlug))
        {
            primarySlug = await (
                    from pc in db.ProductCategories.AsNoTracking()
                    where pc.ProductId == row.Id
                    orderby pc.SortOrder, pc.CategoryId
                    join c in db.LookupValues.AsNoTracking() on pc.CategoryId equals c.Id
                    where c.TenantId == tenantId && c.LookupTypeId == ProductCategoryLookup.LookupTypeId
                    select c.Code)
                .FirstOrDefaultAsync(ct);
        }

        var vendorCode = CommerceVendorDisplayReader.ResolveVendorCode(row.CommerceJson, row.VendorPortalUserId);
        var vendorDisplayName = CommerceVendorDisplayReader.ResolveVendorDisplayName(row.CommerceJson);

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

        return new ProductDetailDto(
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
            gallery,
            angles,
            colors,
            vendorCode,
            vendorDisplayName,
            primarySlug,
            skuCodes,
            skuGalleryFacets,
            row.ProductTypeId);
    }
}
