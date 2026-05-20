using Commerce.Api.Catalog;
using Commerce.Api.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

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

    /// <summary>
    /// Writes a tiny JPEG at <paramref name="storageKey"/> under <paramref name="mediaRootAbsolute"/> so
    /// <c>/media/…</c> returns 200 in dev (e.g. grocery category tile keys). Does not clone arbitrary tenant uploads:
    /// cloning the first <c>.jpg</c> found caused every missing key to get the same unrelated image (e.g. saree hero).
    /// </summary>
    public static void EnsureSeedMediaBlobExists(string mediaRootAbsolute, string storageKey)
    {
        var trimmed = storageKey.Trim().Replace('\\', '/').TrimStart('/');
        if (trimmed.Length == 0)
            return;

        var segments = trimmed.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (segments.Length == 0)
            return;

        var dest = Path.Combine(new[] { mediaRootAbsolute }.Concat(segments).ToArray());
        if (File.Exists(dest))
            return;

        var dir = Path.GetDirectoryName(dest);
        if (dir is not null)
            Directory.CreateDirectory(dir);

        File.WriteAllBytes(dest, Convert.FromBase64String(TinyJpegBase64));
    }

    public static async Task SeedAsync(CommerceDbContext db, CancellationToken ct = default)
    {
        if (await db.Products.AnyAsync(p => p.Id == "p_kj001", ct))
            return;

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
                """{"pricing":{"offerType":"percent","offerCardText":"Pongal season — 10% off list price","offerLabel":"Pongal 10%","promoEndsAt":"","listPriceMinor":2799900},"vendor":{"vendorCode":"NISTTA-DEMO","outletCode":"OUT-MUM-01","displayName":"NISTTA"},"tax":{"hsnCode":"","gstPercent":"","taxCategoryId":"","gstState":""},"enquiries":{"note":"Customer enquiries will appear when wired.","openCount":0},"orders":{"note":"Orders will appear when wired.","recentIds":[]},"typeAttributes":{}}"""
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

        // Second slot reuses the same blob; media_assets has a unique (TenantId, StorageKey).
        db.ProductMedia.Add(new ProductMediaRow
        {
            Id = "pm2",
            ProductId = "p_kj001",
            MediaAssetId = "m_hero1",
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
            """{"pricing":{"offerType":"percent","offerCardText":"Pongal season — 10% off list price","offerLabel":"Pongal 10%","promoEndsAt":"","listPriceMinor":2799900},"vendor":{"vendorCode":"NISTTA-DEMO","outletCode":"OUT-MUM-01","displayName":"NISTTA"},"tax":{"hsnCode":"","gstPercent":"","taxCategoryId":"","gstState":""},"enquiries":{"note":"Customer enquiries will appear when wired.","openCount":0},"orders":{"note":"Orders will appear when wired.","recentIds":[]},"typeAttributes":{}}""";
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Adds product-level media with role <c>color</c> for demo PDP (bottom colour rail). Reuses an existing media asset row for the hero storage key. Safe on existing DBs.
    /// </summary>
    public static async Task EnsureDemoProductColorGalleryAsync(CommerceDbContext db, CancellationToken ct = default)
    {
        if (!await db.Products.AnyAsync(p => p.Id == "p_kj001", ct))
            return;
        if (await db.ProductMedia.AnyAsync(pm => pm.Id == "pm_kj_color", ct))
            return;

        // Reuse an existing asset for the same blob path — tenant+storage_key is unique on media_assets.
        var reuseAssetId = await db.MediaAssets.AsNoTracking()
            .Where(ma => ma.TenantId == "t1" && ma.StorageKey == "t1/p_kj001/hero_01.jpg")
            .OrderBy(ma => ma.Id)
            .Select(ma => ma.Id)
            .FirstOrDefaultAsync(ct);
        if (string.IsNullOrEmpty(reuseAssetId))
            return;

        db.ProductMedia.Add(new ProductMediaRow
        {
            Id = "pm_kj_color",
            ProductId = "p_kj001",
            MediaAssetId = reuseAssetId,
            Role = "color",
            SortOrder = 2,
            Locale = "en-IN"
        });

        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Configurable lookups (types + sample values) aligned with apps/sarees lookup registry — idempotent per tenant.
    /// </summary>
    public static async Task EnsureConfigurableLookupSeedAsync(CommerceDbContext db, CancellationToken ct = default)
    {
        const string tid = "t1";
        if (await db.LookupTypes.AnyAsync(t => t.TenantId == tid, ct))
            return;

        db.LookupTypes.AddRange(
            new LookupType
            {
                TenantId = tid,
                Id = "regions",
                Title = "Regions",
                Description = "Top-level geography (no parent).",
                ParentLookupTypeId = null,
                ParentFieldLabel = null,
                EntryIdPrefix = "reg_"
            },
            new LookupType
            {
                TenantId = tid,
                Id = "cities",
                Title = "Cities",
                Description = "Cities belong to a region.",
                ParentLookupTypeId = "regions",
                ParentFieldLabel = "Region",
                EntryIdPrefix = "city_"
            },
            new LookupType
            {
                TenantId = tid,
                Id = "payment_methods",
                Title = "Payment methods",
                Description = "Standalone lookup with no parent.",
                ParentLookupTypeId = null,
                ParentFieldLabel = null,
                EntryIdPrefix = "pay_"
            },
            new LookupType
            {
                TenantId = tid,
                Id = "product_categories",
                Title = "Product categories",
                Description = "Merchandising categories; code doubles as storefront slug where applicable.",
                ParentLookupTypeId = null,
                ParentFieldLabel = null,
                EntryIdPrefix = "cat_"
            });

        db.LookupValues.AddRange(
            new LookupValue
            {
                Id = "reg_south",
                TenantId = tid,
                LookupTypeId = "regions",
                Code = "south",
                Label = "South India",
                SortOrder = 10,
                ParentValueId = null
            },
            new LookupValue
            {
                Id = "reg_north",
                TenantId = tid,
                LookupTypeId = "regions",
                Code = "north",
                Label = "North India",
                SortOrder = 20,
                ParentValueId = null
            },
            new LookupValue
            {
                Id = "city_che",
                TenantId = tid,
                LookupTypeId = "cities",
                Code = "chennai",
                Label = "Chennai",
                SortOrder = 10,
                ParentValueId = "reg_south"
            },
            new LookupValue
            {
                Id = "city_blr",
                TenantId = tid,
                LookupTypeId = "cities",
                Code = "bengaluru",
                Label = "Bengaluru",
                SortOrder = 20,
                ParentValueId = "reg_south"
            },
            new LookupValue
            {
                Id = "pay_upi",
                TenantId = tid,
                LookupTypeId = "payment_methods",
                Code = "upi",
                Label = "UPI",
                SortOrder = 10,
                ParentValueId = null
            },
            new LookupValue
            {
                Id = "cat_saree",
                TenantId = tid,
                LookupTypeId = "product_categories",
                Code = "sarees",
                Label = "Sarees",
                SortOrder = 10,
                ParentValueId = null,
                MerchandisingParentId = null
            },
            new LookupValue
            {
                Id = "cat_silk",
                TenantId = tid,
                LookupTypeId = "product_categories",
                Code = "silk",
                Label = "Silk sarees",
                SortOrder = 20,
                ParentValueId = null,
                MerchandisingParentId = "cat_saree"
            },
            new LookupValue
            {
                Id = "cat_kan",
                TenantId = tid,
                LookupTypeId = "product_categories",
                Code = "kanjeevaram",
                Label = "Kanjeevaram",
                SortOrder = 30,
                ParentValueId = null,
                MerchandisingParentId = "cat_silk"
            });

        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Idempotent: adds a <c>product_categories</c> lookup row for Kalamkari (vendor primary category + browse slug).
    /// </summary>
    public static async Task EnsureKalamkariCategoryAsync(CommerceDbContext db, CancellationToken ct = default)
    {
        const string tid = "t1";
        const string id = "pcat_kalamkari";
        const string slug = "kalamkari";
        const string lt = "product_categories";

        if (!await db.LookupTypes.AnyAsync(t => t.TenantId == tid && t.Id == lt, ct))
            return;
        if (await db.LookupValues.AnyAsync(v => v.TenantId == tid && v.LookupTypeId == lt && v.Id == id, ct))
            return;

        var merchParent = await db.LookupValues.AsNoTracking()
            .Where(v => v.TenantId == tid && v.LookupTypeId == lt && v.Id == "cat_silk")
            .Select(v => v.Id)
            .FirstOrDefaultAsync(ct);
        if (string.IsNullOrEmpty(merchParent))
        {
            merchParent = await db.LookupValues.AsNoTracking()
                .Where(v => v.TenantId == tid && v.LookupTypeId == lt && v.Id == "cat_saree")
                .Select(v => v.Id)
                .FirstOrDefaultAsync(ct);
        }

        db.LookupValues.Add(new LookupValue
        {
            Id = id,
            TenantId = tid,
            LookupTypeId = lt,
            Code = slug,
            Label = "Kalamkari",
            SortOrder = 35,
            ParentValueId = null,
            MerchandisingParentId = string.IsNullOrEmpty(merchParent) ? null : merchParent
        });
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Maps <c>product_categories</c> lookup value ids to <c>product_departments</c> value ids when the category lookup
    /// type parents on <c>product_departments</c>. Saree/grocery demo categories rely on merchandising and admin-set
    /// <c>parent_value_id</c>; no hard-coded grocery department ids here.
    /// </summary>
    private static string? ResolveCategoryDepartmentParentValueId(string categoryId)
    {
        _ = categoryId;
        return null;
    }

    /// <summary>Idempotent: demo saree merchandising rows under <c>product_categories</c> for tenant <c>t1</c>.</summary>
    public static async Task EnsureDevSareeProductCategoryLookupsAsync(CommerceDbContext db, CancellationToken ct = default)
    {
        const string tid = "t1";
        const string lt = "product_categories";
        if (!await db.LookupTypes.AnyAsync(t => t.TenantId == tid && t.Id == lt, ct))
            return;

        await UpsertProductCategoryLookupAsync(db, tid, "cat_saree", "sarees", "Sarees", 10, null, "t1/p_kj001/hero_01.jpg", ct);
        await UpsertProductCategoryLookupAsync(db, tid, "cat_silk", "silk", "Silk sarees", 20, "cat_saree", "t1/p_kj001/hero_01.jpg", ct);
        await UpsertProductCategoryLookupAsync(db, tid, "cat_kan", "kanjeevaram", "Kanjeevaram", 30, "cat_silk", "t1/p_kj001/hero_01.jpg", ct);
        await db.SaveChangesAsync(ct);
    }

    private static async Task UpsertProductCategoryLookupAsync(
        CommerceDbContext db,
        string tenantId,
        string id,
        string code,
        string label,
        int sortOrder,
        string? merchandisingParentId,
        string? imageStorageKey,
        CancellationToken ct)
    {
        const string lt = "product_categories";
        var row = await db.LookupValues.FirstOrDefaultAsync(v => v.TenantId == tenantId && v.Id == id, ct);
        if (row is null)
        {
            db.LookupValues.Add(new LookupValue
            {
                Id = id,
                TenantId = tenantId,
                LookupTypeId = lt,
                Code = code,
                Label = label,
                SortOrder = sortOrder,
                ParentValueId = null,
                MerchandisingParentId = merchandisingParentId,
                ImageStorageKey = imageStorageKey
            });
        }
        else if (string.Equals(row.LookupTypeId, lt, StringComparison.Ordinal))
        {
            row.Code = code;
            row.Label = label;
            row.SortOrder = sortOrder;
            row.MerchandisingParentId = merchandisingParentId;
            if (imageStorageKey is not null)
                row.ImageStorageKey = imageStorageKey;
        }
    }

    /// <summary>
    /// Sets <c>parent_value_id</c> on all <c>product_categories</c> values from <see cref="ResolveCategoryDepartmentParentValueId"/>
    /// when the category lookup type parents on <c>product_departments</c>.
    /// </summary>
    public static async Task EnsureProductCategoryLookupParentTypesAsync(CommerceDbContext db, CancellationToken ct = default)
    {
        const string lt = "product_categories";
        var tenantIds = await db.LookupTypes.AsNoTracking()
            .Where(t => t.Id == lt && t.ParentLookupTypeId == "product_departments")
            .Select(t => t.TenantId)
            .Distinct()
            .ToListAsync(ct);
        if (tenantIds.Count == 0)
            return;

        var rows = await db.LookupValues
            .Where(v => v.LookupTypeId == lt && tenantIds.Contains(v.TenantId))
            .ToListAsync(ct);
        foreach (var v in rows)
        {
            var dept = ResolveCategoryDepartmentParentValueId(v.Id);
            if (dept is not null)
                v.ParentValueId = dept;
            else if (string.Equals(v.ParentValueId, "dept_saree", StringComparison.Ordinal))
                v.ParentValueId = null;
            else if (string.Equals(v.ParentValueId, "dept_grocery", StringComparison.Ordinal))
                v.ParentValueId = null;
            else if (string.Equals(v.ParentValueId, "dept_grocery_produce", StringComparison.Ordinal))
                v.ParentValueId = null;
            else if (string.Equals(v.ParentValueId, "dept_grocery_dairy", StringComparison.Ordinal))
                v.ParentValueId = null;
        }

        if (rows.Count > 0)
            await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Idempotent: ensures <c>product_departments</c> lookup exists, drops legacy singular
    /// <c>product_department</c> if present, and sets <c>product_categories</c> <c>ParentLookupTypeId</c> to
    /// <c>product_departments</c>. Use <see cref="EnsureProductCategoryLookupParentTypesAsync"/> to align
    /// <c>parent_value_id</c> on category values to department rows.
    /// </summary>
    public static async Task EnsureProductTypesLookupAndLinkCategoriesParentAsync(CommerceDbContext db, CancellationToken ct = default)
    {
        const string tid = "t1";
        const string deptPlural = "product_departments";
        const string deptLegacySingular = "product_department";

        const string typeApplication = "application_type";
        if (!await db.LookupTypes.AnyAsync(t => t.TenantId == tid && t.Id == deptPlural, ct))
        {
            db.LookupTypes.Add(new LookupType
            {
                TenantId = tid,
                Id = deptPlural,
                Title = "Product departments",
                Description = "Storefront departments; parent_value_id is an application_type row (e.g. app_cafe).",
                ParentLookupTypeId = typeApplication,
                ParentFieldLabel = "Application type",
                EntryIdPrefix = "dept_"
            });
            await db.SaveChangesAsync(ct);
        }
        else
        {
            var deptType = await db.LookupTypes.FirstAsync(t => t.TenantId == tid && t.Id == deptPlural, ct);
            deptType.ParentLookupTypeId = typeApplication;
            deptType.ParentFieldLabel = "Application type";
            await db.SaveChangesAsync(ct);
        }

        var legacyDeptType = await db.LookupTypes.FirstOrDefaultAsync(t => t.TenantId == tid && t.Id == deptLegacySingular, ct);
        if (legacyDeptType is not null)
        {
            var legacyVals = await db.LookupValues.Where(v => v.TenantId == tid && v.LookupTypeId == deptLegacySingular).ToListAsync(ct);
            foreach (var v in legacyVals)
                v.LookupTypeId = deptPlural;

            var catForLegacy = await db.LookupTypes.FirstOrDefaultAsync(t => t.TenantId == tid && t.Id == "product_categories", ct);
            if (catForLegacy is not null
                && string.Equals(catForLegacy.ParentLookupTypeId, deptLegacySingular, StringComparison.Ordinal))
            {
                catForLegacy.ParentLookupTypeId = deptPlural;
            }

            await db.SaveChangesAsync(ct);
            db.LookupTypes.Remove(legacyDeptType);
            await db.SaveChangesAsync(ct);
        }

        await EnsureProductCategoriesLookupTypeAsync(db, ct);

        var catType = await db.LookupTypes.FirstOrDefaultAsync(t => t.TenantId == tid && t.Id == "product_categories", ct);
        if (catType is null)
            return;

        if (!string.Equals(catType.ParentLookupTypeId, deptPlural, StringComparison.Ordinal))
        {
            catType.ParentLookupTypeId = deptPlural;
            catType.ParentFieldLabel = "Department";
            await db.SaveChangesAsync(ct);
        }

        // Root lookup: departments must not declare a parent lookup type (otherwise admin shows e.g. "Product type: (not set)" on each row).
        var deptTypesWithParent = await db.LookupTypes.Where(t => t.Id == deptPlural && t.ParentLookupTypeId != null).ToListAsync(ct);
        foreach (var dRow in deptTypesWithParent)
        {
            dRow.ParentLookupTypeId = null;
            dRow.ParentFieldLabel = null;
        }

        if (deptTypesWithParent.Count > 0)
            await db.SaveChangesAsync(ct);

        await RemoveDeptSareeLookupValueIfPresentAsync(db, ct);
        await RemoveDeptGroceryLookupValueIfPresentAsync(db, ct);
    }

    /// <summary>
    /// Drops seeded <c>dept_grocery</c> and clears any <c>parent_value_id</c> pointing at it (groceries vertical no longer uses this department row).
    /// </summary>
    private static async Task RemoveDeptGroceryLookupValueIfPresentAsync(CommerceDbContext db, CancellationToken ct)
    {
        const string id = "dept_grocery";
        var referencing = await db.LookupValues.Where(v => v.ParentValueId == id).ToListAsync(ct);
        foreach (var v in referencing)
            v.ParentValueId = null;
        if (referencing.Count > 0)
            await db.SaveChangesAsync(ct);

        var row = await db.LookupValues.FirstOrDefaultAsync(v => v.Id == id, ct);
        if (row is null)
            return;
        db.LookupValues.Remove(row);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Drops demo <c>dept_saree</c> and clears any <c>parent_value_id</c> pointing at it (sarees vertical does not use department rows).
    /// </summary>
    private static async Task RemoveDeptSareeLookupValueIfPresentAsync(CommerceDbContext db, CancellationToken ct)
    {
        const string id = "dept_saree";
        var referencing = await db.LookupValues.Where(v => v.ParentValueId == id).ToListAsync(ct);
        foreach (var v in referencing)
            v.ParentValueId = null;
        if (referencing.Count > 0)
            await db.SaveChangesAsync(ct);

        var row = await db.LookupValues.FirstOrDefaultAsync(v => v.Id == id, ct);
        if (row is null)
            return;
        db.LookupValues.Remove(row);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Idempotent: mark the legacy Kanjeevaram seed as <c>app_sr</c> so storefronts can filter by application type.
    /// </summary>
    public static async Task EnsureLegacySareeProductTypeAsync(CommerceDbContext db, CancellationToken ct = default)
    {
        const string sareeType = "app_sr";
        var p = await db.Products.FirstOrDefaultAsync(x => x.Id == "p_kj001", ct);
        if (p is null)
            return;
        if (string.Equals(p.ProductTypeId, sareeType, StringComparison.Ordinal))
            return;
        p.ProductTypeId = sareeType;
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Idempotent: removes demo <c>product_departments</c> rows <c>dept_grocery_produce</c> and <c>dept_grocery_dairy</c>
    /// and clears any <c>product_categories.parent_value_id</c> pointing at them (FK-safe).
    /// </summary>
    public static async Task RemoveGroceryProduceDairyDemoDepartmentValuesAsync(CommerceDbContext db, CancellationToken ct = default)
    {
        const string produce = "dept_grocery_produce";
        const string dairy = "dept_grocery_dairy";
        const string catLt = "product_categories";

        var referencing = await db.LookupValues
            .Where(v => v.LookupTypeId == catLt && (v.ParentValueId == produce || v.ParentValueId == dairy))
            .ToListAsync(ct);
        foreach (var v in referencing)
            v.ParentValueId = null;
        if (referencing.Count > 0)
            await db.SaveChangesAsync(ct);

        foreach (var id in new[] { produce, dairy })
        {
            var row = await db.LookupValues.FirstOrDefaultAsync(v => v.Id == id, ct);
            if (row is null)
                continue;
            db.LookupValues.Remove(row);
        }

        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Idempotent: ensures the <c>product_categories</c> lookup type exists (required before aisle/category values).
    /// Safe when <see cref="EnsureConfigurableLookupSeedAsync"/> was skipped (<c>Commerce:SkipLookupReseed</c>).
    /// </summary>
    public static async Task EnsureProductCategoriesLookupTypeAsync(CommerceDbContext db, CancellationToken ct = default)
    {
        const string tid = "t1";
        const string lt = "product_categories";
        const string deptPlural = "product_departments";

        if (await db.LookupTypes.AnyAsync(t => t.TenantId == tid && t.Id == lt, ct))
            return;

        db.LookupTypes.Add(new LookupType
        {
            TenantId = tid,
            Id = lt,
            Title = "Product categories",
            Description = "Merchandising categories; code doubles as storefront slug where applicable.",
            ParentLookupTypeId = deptPlural,
            ParentFieldLabel = "Department",
            EntryIdPrefix = "cat_"
        });
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Idempotent: Groceries home grid aisles under <c>cat_grocery_dept</c> (Fresh vegetables, Atta, dairy, …).
    /// Does not remove admin-created rows; only upserts known ids. Re-run safe on every dev API start.
    /// </summary>
    public static async Task EnsureGroceryStorefrontAisleLookupsAsync(CommerceDbContext db, CancellationToken ct = default)
    {
        const string tid = "t1";
        const string dept = "cat_grocery_dept";

        await EnsureProductCategoriesLookupTypeAsync(db, ct);
        await UpsertProductCategoryLookupAsync(db, tid, dept, "groceries", "Groceries & food", 5, null, null, ct);
        await UpsertProductCategoryLookupAsync(db, tid, "cat_grocery_produce", "fresh-vegetables", "Fresh vegetables", 10, dept, "t1/p_gr_demo_produce/hero.jpg", ct);
        await UpsertProductCategoryLookupAsync(db, tid, "cat_gr_fresh_fruits", "fresh-fruits", "Fresh fruits", 15, dept, null, ct);
        await UpsertProductCategoryLookupAsync(db, tid, "cat_gr_atta_rice", "atta-rice-grains", "Atta, rice & grains", 20, dept, null, ct);
        await UpsertProductCategoryLookupAsync(db, tid, "cat_gr_dals_pulses", "dals-pulses", "Dals & pulses", 25, dept, null, ct);
        await UpsertProductCategoryLookupAsync(db, tid, "cat_gr_oil_ghee", "oil-ghee", "Oil & ghee", 30, dept, null, ct);
        await UpsertProductCategoryLookupAsync(db, tid, "cat_gr_masala_spices", "masala-sugar-spices", "Masala, sugar & spices", 35, dept, null, ct);
        await UpsertProductCategoryLookupAsync(db, tid, "cat_grocery_dairy", "milk-dairy", "Milk & dairy", 40, dept, "t1/p_gr_demo_dairy/hero.jpg", ct);
        await UpsertProductCategoryLookupAsync(db, tid, "cat_gr_breads_bakery", "breads-bakery", "Breads & bakery", 45, dept, null, ct);
        await UpsertProductCategoryLookupAsync(db, tid, "cat_gr_cereals_dry_fruits", "cereals-dry-fruits", "Cereals & dry fruits", 50, dept, null, ct);
        await UpsertProductCategoryLookupAsync(db, tid, "cat_gr_tea_coffee", "tea-coffee-drinks", "Tea, coffee & drink mixes", 55, dept, null, ct);
        await UpsertProductCategoryLookupAsync(db, tid, "cat_gr_juices_drinks", "juices-cold-drinks", "Juices & cold drinks", 60, dept, null, ct);
        await UpsertProductCategoryLookupAsync(db, tid, "cat_gr_sauces_spreads", "sauces-spreads", "Sauces & spreads", 65, dept, null, ct);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Idempotent: sample grocery <c>product_categories</c> + <c>app_gr</c> products for the Groceries storefront (tenant <c>t1</c>).
    /// When <paramref name="mediaRootForBlobWrites"/> is set, writes tiny JPEG blobs for demo hero paths.
    /// </summary>
    public static async Task EnsureGroceryCatalogDevSeedAsync(
        CommerceDbContext db,
        string? mediaRootForBlobWrites = null,
        CancellationToken ct = default)
    {
        const string tid = "t1";
        const string typeGrocery = "app_gr";

        await EnsureGroceryStorefrontAisleLookupsAsync(db, ct);

        var published = new DateTimeOffset(2026, 5, 10, 12, 0, 0, TimeSpan.Zero);
        if (!await db.Products.AnyAsync(p => p.TenantId == tid && p.Id == "p_gr_demo_produce", ct))
        {
            db.Products.Add(new Product
            {
                Id = "p_gr_demo_produce",
                TenantId = tid,
                ProductTypeId = typeGrocery,
                Slug = "organic-tomatoes-500g",
                TitleDisplay = "Organic Tomatoes (500g)",
                SearchText = "organic tomatoes produce fresh",
                Status = "active",
                PublishedAt = published,
                HeroStorageKey = "t1/p_gr_demo_produce/hero.jpg",
                MinPriceMinor = 3500,
                Currency = "INR",
                CommerceJson =
                    """{"pricing":{},"vendor":{"vendorCode":"NISTTA-GROCERY","displayName":"Nistta Groceries"},"tax":{"hsnCode":"","gstPercent":"","taxCategoryId":"","gstState":""},"typeAttributes":{}}"""
            });
            db.ProductCategories.Add(new ProductCategory
            {
                ProductId = "p_gr_demo_produce",
                CategoryId = "cat_grocery_produce",
                IsPrimary = true,
                SortOrder = 0
            });
        }

        if (!await db.Products.AnyAsync(p => p.TenantId == tid && p.Id == "p_gr_demo_dairy", ct))
        {
            db.Products.Add(new Product
            {
                Id = "p_gr_demo_dairy",
                TenantId = tid,
                ProductTypeId = typeGrocery,
                Slug = "whole-milk-1l",
                TitleDisplay = "Whole Milk (1 L)",
                SearchText = "whole milk dairy 1l",
                Status = "active",
                PublishedAt = published,
                HeroStorageKey = "t1/p_gr_demo_dairy/hero.jpg",
                MinPriceMinor = 7200,
                Currency = "INR",
                CommerceJson =
                    """{"pricing":{},"vendor":{"vendorCode":"NISTTA-GROCERY","displayName":"Nistta Groceries"},"tax":{"hsnCode":"","gstPercent":"","taxCategoryId":"","gstState":""},"typeAttributes":{}}"""
            });
            db.ProductCategories.Add(new ProductCategory
            {
                ProductId = "p_gr_demo_dairy",
                CategoryId = "cat_grocery_dairy",
                IsPrimary = true,
                SortOrder = 0
            });
        }

        await db.SaveChangesAsync(ct);

        var now = DateTimeOffset.UtcNow;
        await EnsureGroceryProductHeroMediaAsync(db, tid, "p_gr_demo_produce", "m_gr_hero_produce", "pm_gr_hero_produce", "t1/p_gr_demo_produce/hero.jpg", now, ct);
        await EnsureGroceryProductHeroMediaAsync(db, tid, "p_gr_demo_dairy", "m_gr_hero_dairy", "pm_gr_hero_dairy", "t1/p_gr_demo_dairy/hero.jpg", now, ct);

        if (!string.IsNullOrWhiteSpace(mediaRootForBlobWrites))
        {
            EnsureSeedMediaBlobExists(mediaRootForBlobWrites, "t1/p_gr_demo_produce/hero.jpg");
            EnsureSeedMediaBlobExists(mediaRootForBlobWrites, "t1/p_gr_demo_dairy/hero.jpg");
        }
    }

    private static async Task EnsureGroceryProductHeroMediaAsync(
        CommerceDbContext db,
        string tenantId,
        string productId,
        string mediaAssetId,
        string productMediaId,
        string storageKey,
        DateTimeOffset now,
        CancellationToken ct)
    {
        if (!await db.Products.AnyAsync(p => p.TenantId == tenantId && p.Id == productId, ct))
            return;

        var asset = await db.MediaAssets.FirstOrDefaultAsync(m => m.TenantId == tenantId && m.StorageKey == storageKey, ct);
        if (asset is null)
        {
            asset = new MediaAsset
            {
                Id = mediaAssetId,
                TenantId = tenantId,
                StorageKey = storageKey,
                MimeType = "image/jpeg",
                Bytes = 0,
                Checksum = null,
                UploadedAt = now
            };
            db.MediaAssets.Add(asset);
            await db.SaveChangesAsync(ct);
        }

        if (!await db.ProductMedia.AnyAsync(pm => pm.Id == productMediaId, ct))
        {
            db.ProductMedia.Add(new ProductMediaRow
            {
                Id = productMediaId,
                ProductId = productId,
                MediaAssetId = asset.Id,
                Role = "hero",
                SortOrder = 0,
                Locale = "en-IN"
            });
            await db.SaveChangesAsync(ct);
        }
    }

    /// <summary>
    /// Idempotent <c>application_type</c> lookup (Sarees, Groceries, Café). Stored on products/orders as
    /// <c>product_type_id</c>. Removes legacy <c>product_types</c> / <c>app_type</c> duplicates.
    /// </summary>
    public static async Task EnsureAppTypeLookupSeedAsync(CommerceDbContext db, CancellationToken ct = default)
    {
        const string tid = "t1";
        const string legacyProductTypes = "product_types";
        const string typeApplication = "application_type";
        const string legacyAppType = "app_type";

        if (!await db.LookupTypes.AnyAsync(t => t.TenantId == tid && t.Id == typeApplication, ct))
        {
            db.LookupTypes.Add(new LookupType
            {
                TenantId = tid,
                Id = typeApplication,
                Title = "Application type",
                Description = "Storefront vertical (Sarees, Groceries, Café). Saved on products as product_type_id (e.g. app_cafe).",
                ParentLookupTypeId = null,
                ParentFieldLabel = null,
                EntryIdPrefix = "app_"
            });
            await db.SaveChangesAsync(ct);
        }
        else
        {
            var existing = await db.LookupTypes.FirstAsync(t => t.TenantId == tid && t.Id == typeApplication, ct);
            existing.Title = "Application type";
            existing.Description =
                "Storefront vertical (Sarees, Groceries, Café). Saved on products as product_type_id (e.g. app_cafe).";
            existing.ParentLookupTypeId = null;
            existing.ParentFieldLabel = null;
            await db.SaveChangesAsync(ct);
        }

        foreach (var child in await db.LookupTypes
                     .Where(t => t.TenantId == tid && t.ParentLookupTypeId == legacyAppType)
                     .ToListAsync(ct))
            child.ParentLookupTypeId = typeApplication;

        var legacyAppValues = await db.LookupValues
            .Where(v => v.TenantId == tid && v.LookupTypeId == legacyAppType)
            .ToListAsync(ct);
        if (legacyAppValues.Count > 0)
            db.LookupValues.RemoveRange(legacyAppValues);

        var legacyAppTypeRow = await db.LookupTypes.FirstOrDefaultAsync(t => t.TenantId == tid && t.Id == legacyAppType, ct);
        if (legacyAppTypeRow is not null)
            db.LookupTypes.Remove(legacyAppTypeRow);

        await db.SaveChangesAsync(ct);

        await UpsertAppTypeValueAsync(db, tid, typeApplication, "app_gr", "gr", "Groceries", 10, null, ct);
        await UpsertAppTypeValueAsync(db, tid, typeApplication, "app_sr", "sr", "Sarees", 20, null, ct);
        await UpsertAppTypeValueAsync(db, tid, typeApplication, "app_cafe", "cafe", "Café", 30, null, ct);

        await MigrateLegacyProductTypeIdsToApplicationTypeAsync(db, tid, ct);

        var legacyProductTypeValues = await db.LookupValues
            .Where(v => v.TenantId == tid && v.LookupTypeId == legacyProductTypes)
            .ToListAsync(ct);
        if (legacyProductTypeValues.Count > 0)
            db.LookupValues.RemoveRange(legacyProductTypeValues);

        var legacyProductTypesRow = await db.LookupTypes.FirstOrDefaultAsync(t => t.TenantId == tid && t.Id == legacyProductTypes, ct);
        if (legacyProductTypesRow is not null)
            db.LookupTypes.Remove(legacyProductTypesRow);

        await db.SaveChangesAsync(ct);
    }

    private static async Task MigrateLegacyProductTypeIdsToApplicationTypeAsync(
        CommerceDbContext db,
        string tenantId,
        CancellationToken ct)
    {
        var map = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["pt_saree"] = "app_sr",
            ["pt_grocery"] = "app_gr",
            ["pt_cafe"] = "app_cafe",
        };

        foreach (var (legacy, app) in map)
        {
            var childLookups = await db.LookupValues
                .Where(v => v.TenantId == tenantId && v.ParentValueId == legacy)
                .ToListAsync(ct);
            foreach (var v in childLookups)
                v.ParentValueId = app;

            var products = await db.Products
                .Where(p => p.TenantId == tenantId && p.ProductTypeId == legacy)
                .ToListAsync(ct);
            foreach (var p in products)
                p.ProductTypeId = app;

            var orders = await db.StorefrontOrders
                .Where(o => o.TenantId == tenantId && o.ProductTypeId == legacy)
                .ToListAsync(ct);
            foreach (var o in orders)
                o.ProductTypeId = app;
        }

        var appRows = await db.LookupValues
            .Where(v => v.TenantId == tenantId && v.LookupTypeId == "application_type")
            .ToListAsync(ct);
        foreach (var row in appRows)
        {
            var parent = row.ParentValueId?.Trim();
            if (parent is not null && map.ContainsKey(parent))
                row.ParentValueId = null;
        }

        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Idempotent: single <c>order_fulfillment_status</c> lookup (shopper timeline + vendor-assignable codes).
    /// Removes legacy duplicate <c>order_fulfillment_status_vendor</c> type if present.
    /// </summary>
    public static async Task EnsureOrderFulfillmentStatusLookupsAsync(CommerceDbContext db, CancellationToken ct = default)
    {
        const string tid = "t1";
        const string lookupTypeId = "order_fulfillment_status";
        const string legacyVendorLt = "order_fulfillment_status_vendor";

        var existingType = await db.LookupTypes.FirstOrDefaultAsync(t => t.TenantId == tid && t.Id == lookupTypeId, ct);
        if (existingType is null)
        {
            db.LookupTypes.Add(new LookupType
            {
                TenantId = tid,
                Id = lookupTypeId,
                Title = "Order fulfillment status",
                Description = "Order lifecycle codes (placed → delivered, cancelled, rejected). Vendors assign in review through rejected; placed/delivered are system-facing.",
                ParentLookupTypeId = null,
                ParentFieldLabel = null,
                EntryIdPrefix = "ofs_"
            });
            await db.SaveChangesAsync(ct);
        }
        else
        {
            existingType.Description =
                "Order lifecycle codes (placed → delivered, cancelled, rejected). Vendors assign in review through rejected; placed/delivered are system-facing.";
            await db.SaveChangesAsync(ct);
        }

        await UpsertFulfillmentStatusValueAsync(db, tid, lookupTypeId, "ofs_placed", "placed", "Placed", 10, ct);
        await UpsertFulfillmentStatusValueAsync(db, tid, lookupTypeId, "ofs_inreview", "inreview", "In review", 15, ct);
        await UpsertFulfillmentStatusValueAsync(db, tid, lookupTypeId, "ofs_confirmed", "confirmed", "Confirmed", 20, ct);
        await UpsertFulfillmentStatusValueAsync(db, tid, lookupTypeId, "ofs_packed", "packed", "Packed", 30, ct);
        await UpsertFulfillmentStatusValueAsync(db, tid, lookupTypeId, "ofs_shipped", "shipped", "Shipped", 40, ct);
        await UpsertFulfillmentStatusValueAsync(db, tid, lookupTypeId, "ofs_delivered", "delivered", "Delivered", 50, ct);
        await UpsertFulfillmentStatusValueAsync(db, tid, lookupTypeId, "ofs_cancelled", "cancelled", "Cancelled", 90, ct);
        await UpsertFulfillmentStatusValueAsync(db, tid, lookupTypeId, "ofs_rejected", "rejected", "Rejected", 95, ct);

        var legacyVendorValues = await db.LookupValues
            .Where(v => v.TenantId == tid && v.LookupTypeId == legacyVendorLt)
            .ToListAsync(ct);
        if (legacyVendorValues.Count > 0)
            db.LookupValues.RemoveRange(legacyVendorValues);

        var legacyVendorType = await db.LookupTypes.FirstOrDefaultAsync(t => t.TenantId == tid && t.Id == legacyVendorLt, ct);
        if (legacyVendorType is not null)
            db.LookupTypes.Remove(legacyVendorType);

        await db.SaveChangesAsync(ct);
    }

    private static async Task UpsertFulfillmentStatusValueAsync(
        CommerceDbContext db,
        string tenantId,
        string lookupTypeId,
        string id,
        string code,
        string label,
        int sortOrder,
        CancellationToken ct)
    {
        var row = await db.LookupValues.FirstOrDefaultAsync(v => v.TenantId == tenantId && v.Id == id, ct);
        if (row is null)
        {
            db.LookupValues.Add(new LookupValue
            {
                Id = id,
                TenantId = tenantId,
                LookupTypeId = lookupTypeId,
                Code = code,
                Label = label,
                SortOrder = sortOrder,
                ParentValueId = null
            });
        }
        else
        {
            row.LookupTypeId = lookupTypeId;
            row.Code = code;
            row.Label = label;
            row.SortOrder = sortOrder;
        }
    }

    private static async Task UpsertAppTypeValueAsync(
        CommerceDbContext db,
        string tenantId,
        string lookupTypeId,
        string id,
        string code,
        string label,
        int sortOrder,
        string? parentValueId,
        CancellationToken ct)
    {
        var row = await db.LookupValues.FirstOrDefaultAsync(
            v => v.TenantId == tenantId && v.Id == id,
            ct);
        row ??= await db.LookupValues.FirstOrDefaultAsync(
            v => v.TenantId == tenantId && v.LookupTypeId == lookupTypeId && v.Code == code,
            ct);

        if (row is null)
        {
            db.LookupValues.Add(new LookupValue
            {
                Id = id,
                TenantId = tenantId,
                LookupTypeId = lookupTypeId,
                Code = code,
                Label = label,
                SortOrder = sortOrder,
                ParentValueId = parentValueId
            });
        }
        else
        {
            row.LookupTypeId = lookupTypeId;
            row.Code = code;
            row.Label = label;
            row.SortOrder = sortOrder;
            if (parentValueId is null || parentValueId.StartsWith("app_", StringComparison.Ordinal))
                row.ParentValueId = parentValueId;
            else if (parentValueId.StartsWith("pt_", StringComparison.Ordinal))
                row.ParentValueId = null;
        }

        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Removes tenant catalogue data (products, SKUs, lookups, attributes, media rows). Keeps <c>tenants</c> and
    /// <c>portal_users</c>. Use before <see cref="EnsureConfigurableLookupSeedAsync"/> when re-seeding from scratch.
    /// </summary>
    public static async Task ClearTenantCatalogDataAsync(
        CommerceDbContext db,
        string tenantId = "t1",
        CancellationToken ct = default)
    {
        var tid = tenantId.Trim();
        if (tid.Length == 0)
            throw new ArgumentException("tenantId is required.", nameof(tenantId));

        await db.StorefrontSponsoredProducts.Where(s => s.TenantId == tid).ExecuteDeleteAsync(ct);
        await db.ProductEngagementSummaries.Where(s => s.TenantId == tid).ExecuteDeleteAsync(ct);
        await db.ProductRatings.Where(s => s.TenantId == tid).ExecuteDeleteAsync(ct);
        await db.ProductComments.Where(s => s.TenantId == tid).ExecuteDeleteAsync(ct);

        var skuIds = db.Skus.Where(s => s.TenantId == tid).Select(s => s.Id);
        await db.InventoryPositions.Where(ip => skuIds.Contains(ip.SkuId)).ExecuteDeleteAsync(ct);

        var productIds = db.Products.Where(p => p.TenantId == tid).Select(p => p.Id);
        await db.ProductMedia.Where(pm => productIds.Contains(pm.ProductId)).ExecuteDeleteAsync(ct);
        await db.ProductCategories.Where(pc => productIds.Contains(pc.ProductId)).ExecuteDeleteAsync(ct);
        await db.CollectionItems.Where(ci => productIds.Contains(ci.ProductId)).ExecuteDeleteAsync(ct);
        await db.ProductFacets.Where(pf => productIds.Contains(pf.ProductId)).ExecuteDeleteAsync(ct);
        await db.Skus.Where(s => s.TenantId == tid).ExecuteDeleteAsync(ct);
        await db.Products.Where(p => p.TenantId == tid).ExecuteDeleteAsync(ct);

        var collectionIds = db.Collections.Where(c => c.TenantId == tid).Select(c => c.Id);
        await db.CollectionItems.Where(ci => collectionIds.Contains(ci.CollectionId)).ExecuteDeleteAsync(ct);
        await db.Collections.Where(c => c.TenantId == tid).ExecuteDeleteAsync(ct);

        var attrDefIds = db.AttributeDefs.Where(d => d.TenantId == tid).Select(d => d.Id);
        await db.AttributeValues.Where(v => attrDefIds.Contains(v.AttributeDefId)).ExecuteDeleteAsync(ct);
        await db.AttributeDefs.Where(d => d.TenantId == tid).ExecuteDeleteAsync(ct);

        await db.Locations.Where(l => l.TenantId == tid).ExecuteDeleteAsync(ct);
        await db.MediaAssets.Where(m => m.TenantId == tid).ExecuteDeleteAsync(ct);

        await db.ProductCategories.ExecuteDeleteAsync(ct);

        await db.LookupValues
            .Where(v => v.TenantId == tid)
            .ExecuteUpdateAsync(
                s => s
                    .SetProperty(v => v.ParentValueId, (string?)null)
                    .SetProperty(v => v.MerchandisingParentId, (string?)null),
                ct);
        await db.LookupValues.Where(v => v.TenantId == tid).ExecuteDeleteAsync(ct);
        await db.LookupTypes.Where(t => t.TenantId == tid).ExecuteDeleteAsync(ct);
    }

    /// <summary>
    /// Idempotent: <c>order_channel</c> + <c>cafe_order_status</c> for dine-in / QR / aggregator workflows.
    /// </summary>
    public static async Task EnsureCafeOrderWorkflowLookupsAsync(CommerceDbContext db, CancellationToken ct = default)
    {
        const string tid = "t1";
        const string channelLt = "order_channel";
        const string statusLt = "cafe_order_status";

        if (!await db.LookupTypes.AnyAsync(t => t.TenantId == tid && t.Id == channelLt, ct))
        {
            db.LookupTypes.Add(new LookupType
            {
                TenantId = tid,
                Id = channelLt,
                Title = "Order channel",
                Description = "Café order source: dine-in POS, QR, or aggregator.",
                ParentLookupTypeId = null,
                ParentFieldLabel = null,
                EntryIdPrefix = "ch_"
            });
        }

        if (!await db.LookupTypes.AnyAsync(t => t.TenantId == tid && t.Id == statusLt, ct))
        {
            db.LookupTypes.Add(new LookupType
            {
                TenantId = tid,
                Id = statusLt,
                Title = "Café order status",
                Description = "Kitchen / POS lifecycle (dine-in, QR, aggregator).",
                ParentLookupTypeId = null,
                ParentFieldLabel = null,
                EntryIdPrefix = "cos_"
            });
        }

        await db.SaveChangesAsync(ct);

        await UpsertFulfillmentStatusValueAsync(db, tid, channelLt, "ch_dine_in", "dine_in", "Dine-in (POS)", 10, ct);
        await UpsertFulfillmentStatusValueAsync(db, tid, channelLt, "ch_qr", "qr", "QR order", 20, ct);
        await UpsertFulfillmentStatusValueAsync(db, tid, channelLt, "ch_aggregator", "aggregator", "Aggregator", 30, ct);

        foreach (var row in Commerce.Api.Orders.CafeOrderWorkflow.AllStatusRows())
        {
            var id = $"cos_{row.Code}";
            if (id.Length > 64) id = id[..64];
            await UpsertFulfillmentStatusValueAsync(db, tid, statusLt, id, row.Code, row.Label, row.SortOrder, ct);
        }
    }

    /// <summary>
    /// Idempotent: <c>cafe_table_sections</c> and <c>cafe_tables</c> lookup types for café table management (JsonForm workspace).
    /// </summary>
    public static async Task EnsureCafeTableLookupsAsync(CommerceDbContext db, CancellationToken ct = default)
    {
        const string tid = "t1";
        const string sections = "cafe_table_sections";
        const string tables = "cafe_tables";

        if (!await db.LookupTypes.AnyAsync(t => t.TenantId == tid && t.Id == sections, ct))
        {
            db.LookupTypes.Add(new LookupType
            {
                TenantId = tid,
                Id = sections,
                Title = "Café table sections",
                Description = "Dining areas (indoor, patio, bar) for table management.",
                ParentLookupTypeId = null,
                ParentFieldLabel = null,
                EntryIdPrefix = "tsec_"
            });
        }

        if (!await db.LookupTypes.AnyAsync(t => t.TenantId == tid && t.Id == tables, ct))
        {
            db.LookupTypes.Add(new LookupType
            {
                TenantId = tid,
                Id = tables,
                Title = "Café tables",
                Description = "Dining tables; parent is a café table section. Code is the table number at checkout.",
                ParentLookupTypeId = sections,
                ParentFieldLabel = "Section",
                EntryIdPrefix = "tbl_"
            });
        }

        await db.SaveChangesAsync(ct);

        if (!await db.LookupValues.AnyAsync(v => v.TenantId == tid && v.LookupTypeId == sections, ct))
        {
            db.LookupValues.AddRange(
                new LookupValue
                {
                    Id = "tsec_indoor",
                    TenantId = tid,
                    LookupTypeId = sections,
                    Code = "indoor",
                    Label = "Indoor",
                    SortOrder = 10,
                    ParentValueId = null
                },
                new LookupValue
                {
                    Id = "tsec_patio",
                    TenantId = tid,
                    LookupTypeId = sections,
                    Code = "outdoor",
                    Label = "Outdoor / Patio",
                    SortOrder = 20,
                    ParentValueId = null
                });
            await db.SaveChangesAsync(ct);
        }

        if (!await db.LookupValues.AnyAsync(v => v.TenantId == tid && v.LookupTypeId == tables, ct))
        {
            db.LookupValues.AddRange(
                new LookupValue
                {
                    Id = "tbl_qr_t1",
                    TenantId = tid,
                    LookupTypeId = tables,
                    Code = "t1",
                    Label = "Table t1 (QR demo)",
                    SortOrder = 1,
                    ParentValueId = "tsec_indoor"
                },
                new LookupValue
                {
                    Id = "tbl_in_01",
                    TenantId = tid,
                    LookupTypeId = tables,
                    Code = "1",
                    Label = "Indoor table 1",
                    SortOrder = 2,
                    ParentValueId = "tsec_indoor"
                },
                new LookupValue
                {
                    Id = "tbl_in_02",
                    TenantId = tid,
                    LookupTypeId = tables,
                    Code = "2",
                    Label = "Indoor table 2",
                    SortOrder = 4,
                    ParentValueId = "tsec_indoor"
                },
                new LookupValue
                {
                    Id = "tbl_in_03",
                    TenantId = tid,
                    LookupTypeId = tables,
                    Code = "3",
                    Label = "Indoor table 3",
                    SortOrder = 6,
                    ParentValueId = "tsec_indoor"
                },
                new LookupValue
                {
                    Id = "tbl_out_01",
                    TenantId = tid,
                    LookupTypeId = tables,
                    Code = "P1",
                    Label = "Patio table P1",
                    SortOrder = 4,
                    ParentValueId = "tsec_patio"
                },
                new LookupValue
                {
                    Id = "tbl_out_02",
                    TenantId = tid,
                    LookupTypeId = tables,
                    Code = "P2",
                    Label = "Patio table P2",
                    SortOrder = 4,
                    ParentValueId = "tsec_patio"
                });
            await db.SaveChangesAsync(ct);
        }

        if (!await db.LookupValues.AnyAsync(
                v => v.TenantId == tid && v.LookupTypeId == tables && v.Code == "t1", ct)
            && await db.LookupValues.AnyAsync(v => v.TenantId == tid && v.LookupTypeId == sections, ct))
        {
            db.LookupValues.Add(new LookupValue
            {
                Id = "tbl_qr_t1",
                TenantId = tid,
                LookupTypeId = tables,
                Code = "t1",
                Label = "Table t1 (QR demo)",
                SortOrder = 1,
                ParentValueId = "tsec_indoor"
            });
            await db.SaveChangesAsync(ct);
        }
    }

    /// <summary>Idempotent dev row so the storefront sponsored rail has one sample placement.</summary>
    public static async Task EnsureStorefrontSponsoredDevSeedAsync(CommerceDbContext db, CancellationToken ct = default)
    {
        const string tid = "t1";
        if (await db.StorefrontSponsoredProducts.AnyAsync(s => s.TenantId == tid, ct))
            return;
        if (!await db.Products.AnyAsync(p => p.TenantId == tid && p.Id == "p_kj001", ct))
            return;

        db.StorefrontSponsoredProducts.Add(new StorefrontSponsoredProduct
        {
            Id = "ssp_seed_kj001",
            TenantId = tid,
            ProductId = "p_kj001",
            Label = "Festive spotlight",
            SortOrder = 0,
            IsActive = true
        });
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Optional dev site administrator: set <c>DevSeed:AdminEmail</c> and <c>DevSeed:AdminPassword</c> in configuration
    /// (e.g. appsettings.Development.json). Creates one admin <c>portal_users</c> row per active tenant when missing.
    /// </summary>
    public static async Task EnsureDevSiteAdminAsync(
        CommerceDbContext db,
        IPasswordHasher<PortalUser> passwordHasher,
        IConfiguration configuration,
        ILogger logger,
        CancellationToken ct = default)
    {
        var email = configuration["DevSeed:AdminEmail"]?.Trim();
        var password = configuration["DevSeed:AdminPassword"];
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            logger.LogDebug("Dev site admin seed skipped (DevSeed:AdminEmail / DevSeed:AdminPassword not set).");
            return;
        }

        var norm = email.Trim().ToUpperInvariant();
        var tenantIds = await db.Tenants
            .AsNoTracking()
            .Where(t => t.IsActive)
            .Select(t => t.Id)
            .ToListAsync(ct);
        if (tenantIds.Count == 0)
            tenantIds.Add("t1");

        var seeded = 0;
        foreach (var tid in tenantIds)
        {
            if (await db.PortalUsers.AnyAsync(u => u.TenantId == tid && u.NormalizedEmail == norm, ct))
                continue;

            var user = new PortalUser
            {
                Id = "u_" + Guid.NewGuid().ToString("N")[..12],
                TenantId = tid,
                Email = email,
                NormalizedEmail = norm,
                PasswordHash = "",
                Role = "admin",
                ProfileJson = null,
                CreatedAt = DateTimeOffset.UtcNow,
                LoginDisabled = false
            };
            user.PasswordHash = passwordHasher.HashPassword(user, password);
            db.PortalUsers.Add(user);
            seeded++;
        }

        if (seeded == 0)
            return;

        await db.SaveChangesAsync(ct);
        logger.LogInformation(
            "Seeded dev site admin portal user {Email} (role admin) for {Count} tenant(s).",
            email,
            seeded);
    }
}
