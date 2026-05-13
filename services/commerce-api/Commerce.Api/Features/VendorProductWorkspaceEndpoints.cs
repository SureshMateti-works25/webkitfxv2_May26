using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Nodes;
using Commerce.Api.Audit;
using Commerce.Api.Catalog;
using Commerce.Api.Data;
using Commerce.Api.Entities;
using Commerce.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using WebkitFx.Platform.Tenancy;

namespace Commerce.Api.Features;

/// <summary>Vendor product workspace: aggregated read model + sectioned save (aligns with catalog-domain-model.example.json areas).</summary>
public static class VendorProductWorkspaceEndpoints
{
    private const string Auth = "Vendor";
    private const string Tag = "vendor-products";

    public static void MapVendorProductWorkspaceV1(this WebApplication app)
    {
        app.MapGet("/api/v1/vendor/products/{productId}/workspace", GetWorkspace)
            .RequireAuthorization(Auth)
            .WithTags(Tag)
            .WithName("VendorGetProductWorkspace");

        app.MapPut("/api/v1/vendor/products/{productId}/workspace", PutWorkspace)
            .RequireAuthorization(Auth)
            .WithTags(Tag)
            .WithName("VendorPutProductWorkspace");

        app.MapDelete("/api/v1/vendor/products/{productId}/workspace/media/{productMediaId}", DeleteWorkspaceMedia)
            .RequireAuthorization(Auth)
            .WithTags(Tag)
            .WithName("VendorDeleteProductWorkspaceMedia");
    }

    private static string? PortalUserId(ClaimsPrincipal user) =>
        user.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? user.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);

    private static async Task<IResult> GetWorkspace(
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
            .FirstOrDefaultAsync(ct)
            ?? await db.ProductCategories.AsNoTracking()
                .Where(pc => pc.ProductId == productId)
                .OrderBy(pc => pc.SortOrder)
                .Select(pc => pc.CategoryId)
                .FirstOrDefaultAsync(ct);

        var skus = await db.Skus.AsNoTracking()
            .Where(s => s.ProductId == productId)
            .OrderBy(s => s.SkuCode)
            .Select(s => new
            {
                s.Id,
                s.SkuCode,
                s.Barcode,
                s.Status,
                s.ListPriceMinor,
                s.CompareAtPriceMinor
            })
            .ToListAsync(ct);

        var media = await (
            from pm in db.ProductMedia.AsNoTracking()
            join ma in db.MediaAssets.AsNoTracking() on pm.MediaAssetId equals ma.Id
            where pm.ProductId == productId
            orderby pm.SortOrder, pm.Id
            select new
            {
                pm.Id,
                pm.MediaAssetId,
                pm.SkuId,
                pm.Role,
                pm.SortOrder,
                ma.StorageKey,
                ma.MimeType
            }).ToListAsync(ct);

        var skuIds = skus.Select(s => s.Id).ToList();
        var inventory = await (
            from ip in db.InventoryPositions.AsNoTracking()
            join loc in db.Locations.AsNoTracking() on ip.LocationId equals loc.Id
            where skuIds.Contains(ip.SkuId)
            select new
            {
                ip.Id,
                ip.SkuId,
                ip.LocationId,
                loc.Code,
                loc.Name,
                ip.OnHand,
                ip.Reserved
            }).ToListAsync(ct);

        var locations = await db.Locations.AsNoTracking()
            .Where(l => l.TenantId == tenantId)
            .OrderBy(l => l.Code)
            .Select(l => new { l.Id, l.Code, l.Name, l.Type })
            .ToListAsync(ct);

        var collectionIds = await db.CollectionItems.AsNoTracking()
            .Where(ci => ci.ProductId == productId)
            .Select(ci => ci.CollectionId)
            .ToListAsync(ct);

        var facetRows = await (
            from pf in db.ProductFacets.AsNoTracking()
            join ad in db.AttributeDefs.AsNoTracking() on pf.AttributeDefId equals ad.Id
            where pf.ProductId == productId
            select new { pf.AttributeDefId, pf.AttributeValueId, ad.Code }
        ).ToListAsync(ct);

        var attributes = new Dictionary<string, string>();
        foreach (var row in facetRows)
            attributes[row.AttributeDefId] = row.AttributeValueId;

        var commerceNode = ParseCommerce(p.CommerceJson);
        EnsureCommerceStubs(commerceNode);

        var core = new Dictionary<string, object?>
        {
            ["id"] = p.Id,
            ["titleDisplay"] = p.TitleDisplay,
            ["slug"] = p.Slug,
            ["status"] = p.Status,
            ["currency"] = p.Currency ?? "INR",
            ["minPriceMinor"] = p.MinPriceMinor,
            ["productTypeId"] = p.ProductTypeId ?? "",
            ["primaryCategoryId"] = primaryCat ?? ""
        };

        var collections = new Dictionary<string, object?>
        {
            ["idsCsv"] = string.Join(",", collectionIds)
        };

        return Results.Ok(new
        {
            core,
            collections,
            attributes,
            commerce = JsonSerializer.Deserialize<object>(commerceNode.ToJsonString()),
            skus,
            media,
            inventory,
            locations
        });
    }

    private static async Task<IResult> PutWorkspace(
        string productId,
        HttpRequest request,
        WorkspacePutBody body,
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
            .FirstOrDefaultAsync(x => x.Id == productId && x.TenantId == tenantId && x.VendorPortalUserId == uid, ct);
        if (product is null)
            return Results.NotFound();

        if (body.Core is { ValueKind: JsonValueKind.Object } core)
        {
            if (core.TryGetProperty("titleDisplay", out var t) && t.ValueKind == JsonValueKind.String)
            {
                var title = t.GetString()?.Trim() ?? "";
                if (title.Length > 0)
                {
                    product.TitleDisplay = title;
                    product.SearchText = title.ToLowerInvariant();
                }
            }
            if (core.TryGetProperty("slug", out var sl) && sl.ValueKind == JsonValueKind.String)
            {
                var s = sl.GetString()?.Trim() ?? "";
                if (s.Length > 0 && s != product.Slug)
                {
                    if (!await SlugFree(db, tenantId, s, productId, ct))
                        return Results.Conflict(new { error = "slug already in use" });
                    product.Slug = s;
                }
            }
            if (core.TryGetProperty("status", out var st) && st.ValueKind == JsonValueKind.String)
            {
                var status = st.GetString()?.Trim().ToLowerInvariant() == "active" ? "active" : "draft";
                product.Status = status;
                if (status == "active" && product.PublishedAt is null)
                    product.PublishedAt = DateTimeOffset.UtcNow;
            }
            if (core.TryGetProperty("currency", out var cur) && cur.ValueKind == JsonValueKind.String)
            {
                var c = cur.GetString()?.Trim() ?? "";
                if (c.Length > 0)
                    product.Currency = c[..Math.Min(8, c.Length)];
            }
            if (core.TryGetProperty("minPriceMinor", out var mp))
            {
                if (mp.ValueKind == JsonValueKind.Number && mp.TryGetInt64(out var minor))
                    product.MinPriceMinor = minor;
                else if (mp.ValueKind == JsonValueKind.Null)
                    product.MinPriceMinor = null;
            }
            if (core.TryGetProperty("productTypeId", out var pt) && pt.ValueKind == JsonValueKind.String)
            {
                var id = pt.GetString()?.Trim();
                product.ProductTypeId = string.IsNullOrEmpty(id) ? null : id[..Math.Min(64, id.Length)];
            }

            if (core.TryGetProperty("primaryCategoryId", out var pc))
            {
                if (pc.ValueKind == JsonValueKind.String)
                {
                    var cid = pc.GetString()?.Trim() ?? "";
                    var old = await db.ProductCategories.Where(x => x.ProductId == productId).ToListAsync(ct);
                    db.ProductCategories.RemoveRange(old);
                    if (cid.Length > 0)
                    {
                        var ok = await db.LookupValues.AsNoTracking().AnyAsync(
                            c => c.Id == cid && c.TenantId == tenantId && c.LookupTypeId == ProductCategoryLookup.LookupTypeId, ct);
                        if (!ok)
                            return Results.BadRequest(new { error = "Unknown categoryId" });
                        db.ProductCategories.Add(new ProductCategory
                        {
                            ProductId = productId,
                            CategoryId = cid,
                            IsPrimary = true,
                            SortOrder = 0
                        });
                    }
                }
            }
        }

        if (body.CommercePatch is { ValueKind: JsonValueKind.Object } patch)
        {
            var merged = MergeCommerceJson(product.CommerceJson, patch);
            product.CommerceJson = merged;
        }

        if (body.CollectionIds is not null)
        {
            var existing = await db.CollectionItems.Where(ci => ci.ProductId == productId).ToListAsync(ct);
            db.CollectionItems.RemoveRange(existing);
            foreach (var raw in body.CollectionIds.Distinct())
            {
                var colId = raw.Trim();
                if (colId.Length == 0) continue;
                var colOk = await db.Collections.AsNoTracking()
                    .AnyAsync(c => c.Id == colId && c.TenantId == tenantId, ct);
                if (!colOk)
                    return Results.BadRequest(new { error = $"Unknown collection {colId}" });
                db.CollectionItems.Add(new CollectionItem
                {
                    CollectionId = colId,
                    ProductId = productId,
                    SortOrder = 0,
                    Pinned = false
                });
            }
        }

        if (body.Attributes is not null)
        {
            var oldFacets = await db.ProductFacets.Where(f => f.ProductId == productId).ToListAsync(ct);
            db.ProductFacets.RemoveRange(oldFacets);
            foreach (var (defId, valId) in body.Attributes)
            {
                if (string.IsNullOrWhiteSpace(defId) || string.IsNullOrWhiteSpace(valId))
                    continue;
                var defOk = await db.AttributeDefs.AsNoTracking()
                    .AnyAsync(d => d.Id == defId && d.TenantId == tenantId, ct);
                var valOk = await db.AttributeValues.AsNoTracking()
                    .AnyAsync(v => v.Id == valId && v.AttributeDefId == defId, ct);
                if (!defOk || !valOk)
                    return Results.BadRequest(new { error = $"Invalid attribute {defId}:{valId}" });
                db.ProductFacets.Add(new ProductFacet
                {
                    ProductId = productId,
                    AttributeDefId = defId,
                    AttributeValueId = valId
                });
            }
        }

        if (body.Skus is not null)
        {
            foreach (var row in body.Skus)
            {
                var code = row.SkuCode?.Trim() ?? "";
                if (code.Length == 0) continue;
                Sku? sku = null;
                if (!string.IsNullOrEmpty(row.Id))
                    sku = await db.Skus.FirstOrDefaultAsync(s => s.Id == row.Id && s.ProductId == productId, ct);
                if (sku is null)
                {
                    sku = new Sku
                    {
                        Id = "sku_" + Guid.NewGuid().ToString("N")[..12],
                        TenantId = tenantId,
                        ProductId = productId,
                        SkuCode = code,
                        Barcode = row.Barcode?.Trim(),
                        Status = string.IsNullOrWhiteSpace(row.Status) ? "active" : row.Status.Trim(),
                        ListPriceMinor = row.ListPriceMinor,
                        CompareAtPriceMinor = row.CompareAtPriceMinor
                    };
                    db.Skus.Add(sku);
                }
                else
                {
                    sku.SkuCode = code;
                    sku.Barcode = row.Barcode?.Trim();
                    if (!string.IsNullOrWhiteSpace(row.Status))
                        sku.Status = row.Status.Trim();
                    sku.ListPriceMinor = row.ListPriceMinor;
                    sku.CompareAtPriceMinor = row.CompareAtPriceMinor;
                }
            }
        }

        if (body.Inventory is not null)
        {
            foreach (var row in body.Inventory)
            {
                if (string.IsNullOrWhiteSpace(row.SkuId) || string.IsNullOrWhiteSpace(row.LocationId))
                    continue;
                var skuOk = await db.Skus.AsNoTracking()
                    .AnyAsync(s => s.Id == row.SkuId && s.ProductId == productId, ct);
                if (!skuOk)
                    continue;
                var locOk = await db.Locations.AsNoTracking()
                    .AnyAsync(l => l.Id == row.LocationId && l.TenantId == tenantId, ct);
                if (!locOk)
                    return Results.BadRequest(new { error = $"Unknown location {row.LocationId}" });

                var pos = await db.InventoryPositions
                    .FirstOrDefaultAsync(ip => ip.SkuId == row.SkuId && ip.LocationId == row.LocationId, ct);
                if (pos is null)
                {
                    db.InventoryPositions.Add(new InventoryPosition
                    {
                        Id = "ip_" + Guid.NewGuid().ToString("N")[..12],
                        SkuId = row.SkuId,
                        LocationId = row.LocationId,
                        OnHand = row.OnHand,
                        Reserved = row.Reserved ?? 0,
                        UpdatedAt = DateTimeOffset.UtcNow
                    });
                }
                else
                {
                    pos.OnHand = row.OnHand;
                    if (row.Reserved.HasValue)
                        pos.Reserved = row.Reserved.Value;
                    pos.UpdatedAt = DateTimeOffset.UtcNow;
                }
            }
        }

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            return Results.Conflict(new { error = "Could not save workspace" });
        }

        await audit.RecordAsync(
            AuditActions.CatalogProductMutate,
            "success",
            tenantId,
            uid,
            "product",
            productId,
            new { action = "workspace_put" },
            request.HttpContext,
            ct);

        return Results.NoContent();
    }

    private static bool IsHeroishMediaRole(string role) =>
        role.Equals("front", StringComparison.OrdinalIgnoreCase)
        || role.Equals("hero", StringComparison.OrdinalIgnoreCase)
        || role.Equals("primary", StringComparison.OrdinalIgnoreCase);

    /// <summary>Pick PLP/card hero from remaining gallery rows (same rules as upload).</summary>
    private static string? PickHeroStorageKeyFromMediaRows(IReadOnlyList<(string Role, string StorageKey)> rows)
    {
        if (rows.Count == 0)
            return null;
        foreach (var (role, key) in rows)
        {
            if (IsHeroishMediaRole(role))
                return key;
        }

        return rows[0].StorageKey;
    }

    private static async Task<IResult> DeleteWorkspaceMedia(
        string productId,
        string productMediaId,
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
            .FirstOrDefaultAsync(x => x.Id == productId && x.TenantId == tenantId && x.VendorPortalUserId == uid, ct);
        if (product is null)
            return Results.NotFound();

        var row = await db.ProductMedia
            .Include(pm => pm.MediaAsset)
            .FirstOrDefaultAsync(pm => pm.Id == productMediaId && pm.ProductId == productId, ct);
        if (row is null)
            return Results.NotFound();

        var remaining = await (
            from pm in db.ProductMedia.AsNoTracking()
            join ma in db.MediaAssets.AsNoTracking() on pm.MediaAssetId equals ma.Id
            where pm.ProductId == productId && pm.Id != productMediaId
            orderby pm.SortOrder, pm.Id
            select new { pm.Role, ma.StorageKey }
        ).ToListAsync(ct);

        db.ProductMedia.Remove(row);
        product.HeroStorageKey = PickHeroStorageKeyFromMediaRows(
            remaining.Select(r => (r.Role, r.StorageKey)).ToList());

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            return Results.Conflict(new { error = "Could not remove media" });
        }

        await audit.RecordAsync(
            AuditActions.MediaDelete,
            "success",
            tenantId,
            uid,
            "product_media",
            productMediaId,
            new { productId, mediaAssetId = row.MediaAssetId },
            request.HttpContext,
            ct);

        return Results.NoContent();
    }

    private static JsonObject ParseCommerce(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return new JsonObject();
        try
        {
            var n = JsonNode.Parse(json);
            return n as JsonObject ?? new JsonObject();
        }
        catch
        {
            return new JsonObject();
        }
    }

    private static void EnsureCommerceStubs(JsonObject root)
    {
        root["pricing"] ??= new JsonObject();
        var pr = root["pricing"]!.AsObject();
        pr["offerLabel"] ??= "";
        pr["promoEndsAt"] ??= "";
        pr["offerType"] ??= "none";
        pr["offerCardText"] ??= "";
        root["tax"] ??= new JsonObject
        {
            ["hsnCode"] = "",
            ["gstPercent"] = "",
            ["taxCategoryId"] = "",
            ["gstState"] = ""
        };
        root["enquiries"] ??= new JsonObject
        {
            ["note"] = "Customer enquiries will appear when the engagement service is wired.",
            ["openCount"] = 0
        };
        root["orders"] ??= new JsonObject
        {
            ["note"] = "Order summaries will appear when the order pipeline is wired.",
            ["recentIds"] = new JsonArray()
        };
        root["typeAttributes"] ??= new JsonObject();
    }

    private static string MergeCommerceJson(string? existing, JsonElement patch)
    {
        var root = ParseCommerce(existing);
        EnsureCommerceStubs(root);
        foreach (var prop in patch.EnumerateObject())
        {
            if (prop.Value.ValueKind == JsonValueKind.Object && root[prop.Name] is JsonObject existingChild)
            {
                var patchObj = JsonNode.Parse(prop.Value.GetRawText())!.AsObject();
                foreach (var inner in patchObj)
                    existingChild[inner.Key] = inner.Value?.DeepClone();
            }
            else
            {
                root[prop.Name] = JsonNode.Parse(prop.Value.GetRawText());
            }
        }

        return root.ToJsonString(new JsonSerializerOptions { WriteIndented = false });
    }

    private static async Task<bool> SlugFree(
        CommerceDbContext db,
        string tenantId,
        string slug,
        string productId,
        CancellationToken ct) =>
        !await db.Products.AnyAsync(
            p => p.TenantId == tenantId && p.Slug == slug && p.Id != productId,
            ct);

    public sealed class WorkspacePutBody
    {
        public JsonElement? Core { get; set; }
        public JsonElement? CommercePatch { get; set; }
        public string[]? CollectionIds { get; set; }
        public Dictionary<string, string>? Attributes { get; set; }
        public List<SkuRowPut>? Skus { get; set; }
        public List<InventoryRowPut>? Inventory { get; set; }
    }

    public sealed class SkuRowPut
    {
        public string? Id { get; set; }
        public string? SkuCode { get; set; }
        public string? Barcode { get; set; }
        public string? Status { get; set; }
        public long? ListPriceMinor { get; set; }
        public long? CompareAtPriceMinor { get; set; }
    }

    public sealed class InventoryRowPut
    {
        public string? SkuId { get; set; }
        public string? LocationId { get; set; }
        public int OnHand { get; set; }
        public int? Reserved { get; set; }
    }
}
