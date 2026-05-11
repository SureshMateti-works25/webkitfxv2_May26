using Commerce.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Commerce.Api.Data;

public static class CommerceDevDataSeeder
{
    /// <summary>Valid 1×1 JPEG used when no real file exists yet (seed hero path must resolve for /media).</summary>
    private const string TinyJpegBase64 =
        "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh4YGB8gJC4nLDE6ND8QREpPUDwzLRMmMz9KPD1DTj9KSDP/2wBDAQcJCQkJDBINDgwVFCQ3NjQ3NjQ3NjQ3NjQ3NjQ3NjQ3NjQ3NjQ3NjQ3NjQ3NjQ3NjQ3NjQ3NjQ3NjQ3NjT/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=";

    /// <summary>
    /// Catalogue seed uses <c>t1/p_kj001/hero_01.jpg</c>; write bytes so static <c>/media/...</c> returns 200.
    /// Prefer copying any existing tenant upload; otherwise writes a tiny JPEG.
    /// </summary>
    public static void EnsureSeedHeroMediaBlobExists(string mediaRootAbsolute)
    {
        var dest = Path.Combine(mediaRootAbsolute, "t1", "p_kj001", "hero_01.jpg");
        if (File.Exists(dest))
            return;

        var dir = Path.GetDirectoryName(dest);
        if (dir is not null)
            Directory.CreateDirectory(dir);

        if (Directory.Exists(mediaRootAbsolute))
        {
            foreach (var path in Directory.EnumerateFiles(mediaRootAbsolute, "*.*", SearchOption.AllDirectories))
            {
                var ext = Path.GetExtension(path);
                if (ext.Equals(".jpg", StringComparison.OrdinalIgnoreCase)
                    || ext.Equals(".jpeg", StringComparison.OrdinalIgnoreCase)
                    || ext.Equals(".png", StringComparison.OrdinalIgnoreCase))
                {
                    if (!string.Equals(path, dest, StringComparison.OrdinalIgnoreCase))
                    {
                        File.Copy(path, dest, overwrite: false);
                        return;
                    }
                }
            }
        }

        File.WriteAllBytes(dest, Convert.FromBase64String(TinyJpegBase64));
    }

    public static async Task SeedAsync(CommerceDbContext db, CancellationToken ct = default)
    {
        if (await db.Categories.AnyAsync(ct))
            return;

        db.Categories.AddRange(
            new Category { Id = "cat_saree", TenantId = "t1", ParentId = null, Slug = "sarees", SortOrder = 10 },
            new Category { Id = "cat_silk", TenantId = "t1", ParentId = "cat_saree", Slug = "silk", SortOrder = 20 },
            new Category { Id = "cat_kan", TenantId = "t1", ParentId = "cat_silk", Slug = "kanjeevaram", SortOrder = 30 });

        db.AttributeDefs.AddRange(
            new AttributeDef
            {
                Id = "attr_color", TenantId = "t1", Code = "color", LabelKey = "attr.color", Filterable = true,
                Sortable = false, Searchable = true, DisplayType = "swatch", VariantAxisOrder = 1
            },
            new AttributeDef
            {
                Id = "attr_border", TenantId = "t1", Code = "border", LabelKey = "attr.border", Filterable = true,
                Sortable = true, Searchable = true, DisplayType = "pill", VariantAxisOrder = 2
            });

        db.AttributeValues.AddRange(
            new AttributeValue
            {
                Id = "av_maroon", AttributeDefId = "attr_color", Code = "maroon", LabelKey = "attrValue.color.maroon",
                SortKey = 10, SwatchHex = "#7b1e3a"
            },
            new AttributeValue
            {
                Id = "av_gold", AttributeDefId = "attr_border", Code = "gold-3cm", LabelKey = "attrValue.border.gold3cm",
                SortKey = 20, SwatchHex = null
            });

        var published = new DateTimeOffset(2026, 4, 22, 10, 0, 0, TimeSpan.Zero);
        db.Products.Add(new Product
        {
            Id = "p_kj001",
            TenantId = "t1",
            Slug = "royal-kanjeevaram-zari",
            TitleDisplay = "Royal Kanjeevaram Zari",
            SearchText = "royal kanjeevaram zari maroon wine burgundy silk",
            Status = "active",
            PublishedAt = published,
            HeroStorageKey = "t1/p_kj001/hero_01.jpg",
            MinPriceMinor = 2499900,
            Currency = "INR",
            CommerceJson =
                """{"pricing":{"offerType":"percent","offerCardText":"Pongal season — 10% off list price","offerLabel":"Pongal 10%","promoEndsAt":"","listPriceMinor":2799900},"tax":{"hsnCode":"","gstPercent":"","taxCategoryId":"","gstState":""},"enquiries":{"note":"Customer enquiries will appear when wired.","openCount":0},"orders":{"note":"Orders will appear when wired.","recentIds":[]},"typeAttributes":{}}"""
        });

        db.ProductCategories.AddRange(
            new ProductCategory { ProductId = "p_kj001", CategoryId = "cat_kan", IsPrimary = true, SortOrder = 0 },
            new ProductCategory { ProductId = "p_kj001", CategoryId = "cat_silk", IsPrimary = false, SortOrder = 1 });

        db.Collections.Add(new Collection
        {
            Id = "col_pongal",
            TenantId = "t1",
            Slug = "pongal-edit-2026",
            Title = "Pongal Edit 2026",
            Channel = "web",
            ActiveFrom = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero),
            ActiveTo = null
        });

        db.CollectionItems.Add(new CollectionItem
        {
            CollectionId = "col_pongal",
            ProductId = "p_kj001",
            SortOrder = 0,
            Pinned = true
        });

        db.ProductFacets.AddRange(
            new ProductFacet { ProductId = "p_kj001", AttributeDefId = "attr_color", AttributeValueId = "av_maroon" },
            new ProductFacet { ProductId = "p_kj001", AttributeDefId = "attr_border", AttributeValueId = "av_gold" });

        await db.SaveChangesAsync(ct);
    }

    /// <summary>Warehouse / SKU / media / inventory rows aligned with catalog-domain-model (runs once per DB).</summary>
    public static async Task EnsureOperationalSeedAsync(CommerceDbContext db, CancellationToken ct = default)
    {
        if (await db.Locations.AnyAsync(ct))
            return;
        if (!await db.Products.AnyAsync(p => p.Id == "p_kj001", ct))
            return;

        var now = DateTimeOffset.UtcNow;
        db.Locations.AddRange(
            new Location { Id = "loc_mum", TenantId = "t1", Code = "WH-MUM-01", Name = "Mumbai Hub", Type = "warehouse" },
            new Location { Id = "loc_blr", TenantId = "t1", Code = "ST-BLR-01", Name = "Bengaluru Store", Type = "store" });

        db.MediaAssets.Add(new MediaAsset
        {
            Id = "m_hero1",
            TenantId = "t1",
            StorageKey = "t1/p_kj001/hero_01.jpg",
            MimeType = "image/jpeg",
            Bytes = 0,
            Checksum = null,
            UploadedAt = now
        });

        db.ProductMedia.Add(new ProductMediaRow
        {
            Id = "pm1",
            ProductId = "p_kj001",
            MediaAssetId = "m_hero1",
            Role = "hero",
            SortOrder = 0,
            Locale = "en-IN"
        });

        db.MediaAssets.Add(new MediaAsset
        {
            Id = "m_kj_gallery_2",
            TenantId = "t1",
            StorageKey = "t1/p_kj001/hero_01.jpg",
            MimeType = "image/jpeg",
            Bytes = 0,
            Checksum = null,
            UploadedAt = now
        });

        db.ProductMedia.Add(new ProductMediaRow
        {
            Id = "pm2",
            ProductId = "p_kj001",
            MediaAssetId = "m_kj_gallery_2",
            Role = "gallery",
            SortOrder = 1,
            Locale = "en-IN"
        });

        db.Skus.Add(new Sku
        {
            Id = "sku_kj_mar_g3",
            TenantId = "t1",
            ProductId = "p_kj001",
            SkuCode = "KJ-MRN-G3-001",
            Barcode = "8901234567890",
            Status = "active"
        });

        db.InventoryPositions.Add(new InventoryPosition
        {
            Id = "ip1",
            SkuId = "sku_kj_mar_g3",
            LocationId = "loc_mum",
            OnHand = 18,
            Reserved = 2,
            UpdatedAt = now
        });

        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Dev-only: older DBs may have <c>p_kj001</c> without <c>commerce.pricing.listPriceMinor</c>; patch so storefront cards show MRP + offer.
    /// </summary>
    public static async Task EnsureDemoProductCardPricingAsync(CommerceDbContext db, CancellationToken ct = default)
    {
        var p = await db.Products.FirstOrDefaultAsync(x => x.Id == "p_kj001", ct);
        if (p is null)
            return;
        if (!string.IsNullOrWhiteSpace(p.CommerceJson)
            && p.CommerceJson.Contains("\"listPriceMinor\"", StringComparison.OrdinalIgnoreCase))
            return;

        p.CommerceJson =
            """{"pricing":{"offerType":"percent","offerCardText":"Pongal season — 10% off list price","offerLabel":"Pongal 10%","promoEndsAt":"","listPriceMinor":2799900},"tax":{"hsnCode":"","gstPercent":"","taxCategoryId":"","gstState":""},"enquiries":{"note":"Customer enquiries will appear when wired.","openCount":0},"orders":{"note":"Orders will appear when wired.","recentIds":[]},"typeAttributes":{}}""";
        await db.SaveChangesAsync(ct);
    }
}
