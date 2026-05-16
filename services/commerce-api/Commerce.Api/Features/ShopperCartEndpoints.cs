using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Commerce.Api.Audit;
using Commerce.Api.Catalog;
using Commerce.Api.Data;
using Commerce.Api.Entities;
using Commerce.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using WebkitFx.Platform.Tenancy;

namespace Commerce.Api.Features;

public static class ShopperCartEndpoints
{
    private const string DefaultTenantId = "t1";

    public static void MapShopperCartV1(this WebApplication app)
    {
        var g = app.MapGroup("/api/v1/cart").RequireAuthorization("Shopper");
        g.MapGet("/", GetCart).WithName("ShopperGetCart");
        g.MapPost("/lines", UpsertLine).WithName("ShopperUpsertCartLine");
        g.MapPatch("/lines/{lineId}", SetLineQuantity).WithName("ShopperSetCartLineQuantity");
        g.MapDelete("/lines/{lineId}", RemoveLine).WithName("ShopperRemoveCartLine");
        g.MapDelete("/", ClearCart).WithName("ShopperClearCart");
        g.MapPost("/views/{productId}", RecordProductView).WithName("ShopperRecordProductView");
        g.MapGet("/views", ListRecentProductViews).WithName("ShopperListRecentProductViews");
    }

    private static string? UserId(ClaimsPrincipal user) =>
        user.FindFirstValue(JwtRegisteredClaimNames.Sub)
        ?? user.FindFirstValue(ClaimTypes.NameIdentifier);

    private static async Task<IResult> GetCart(
        HttpRequest req,
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(req.HttpContext, tenantContext, audit, ct);
        if (tenantFail is not null) return tenantFail;
        var tenantId = req.ResolveTenantId(tenantContext)!;
        var userId = UserId(req.HttpContext.User);
        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

        var lines = await LoadCartLineDtosAsync(db, tenantId, userId, ct);
        return Results.Ok(new { lines });
    }

    private static async Task<IResult> UpsertLine(
        UpsertCartLineRequest body,
        HttpRequest req,
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(req.HttpContext, tenantContext, audit, ct);
        if (tenantFail is not null) return tenantFail;
        var tenantId = req.ResolveTenantId(tenantContext)!;
        var userId = UserId(req.HttpContext.User);
        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

        var productId = (body.ProductId ?? "").Trim();
        if (productId.Length == 0) return Results.BadRequest(new { error = "productId is required." });

        var product = await db.Products.AsNoTracking()
            .FirstOrDefaultAsync(p => p.TenantId == tenantId && p.Id == productId && p.Status == "active", ct);
        if (product is null) return Results.NotFound(new { error = "Product not found or inactive." });

        var qty = Math.Clamp(body.Quantity <= 0 ? 1 : body.Quantity, 1, 999);
        var skuId = string.IsNullOrWhiteSpace(body.SkuId) ? null : body.SkuId.Trim();
        if (skuId is not null
            && !await db.Skus.AnyAsync(
                s => s.TenantId == tenantId && s.ProductId == productId && s.Id == skuId && s.Status == "active",
                ct))
        {
            return Results.BadRequest(new { error = "Invalid skuId for this product." });
        }

        var cart = await GetOrCreateCartAsync(db, tenantId, userId, ct);
        var existing = await db.ShopperCartLines
            .Where(l => l.CartId == cart.Id && l.ProductId == productId && l.SkuId == skuId)
            .FirstOrDefaultAsync(ct);

        if (existing is null)
        {
            db.ShopperCartLines.Add(new ShopperCartLine
            {
                Id = "cl_" + Guid.NewGuid().ToString("N")[..12],
                CartId = cart.Id,
                ProductId = productId,
                SkuId = skuId,
                Quantity = qty,
                UnitPriceMinor = body.UnitPriceMinor,
                Currency = TrimOrNull(body.Currency, 8),
                PackLabel = TrimOrNull(body.PackLabel, 128),
                PackUnitType = TrimOrNull(body.PackUnitType, 32),
                PackQuantity = body.PackQuantity,
                UnitsPerPack = body.UnitsPerPack
            });
        }
        else
        {
            existing.Quantity = Math.Min(999, existing.Quantity + qty);
            if (body.UnitPriceMinor.HasValue) existing.UnitPriceMinor = body.UnitPriceMinor;
            if (body.Currency is not null) existing.Currency = TrimOrNull(body.Currency, 8);
            if (body.PackLabel is not null) existing.PackLabel = TrimOrNull(body.PackLabel, 128);
            if (body.PackUnitType is not null) existing.PackUnitType = TrimOrNull(body.PackUnitType, 32);
            if (body.PackQuantity.HasValue) existing.PackQuantity = body.PackQuantity;
            if (body.UnitsPerPack.HasValue) existing.UnitsPerPack = body.UnitsPerPack;
        }

        cart.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        var lines = await LoadCartLineDtosAsync(db, tenantId, userId, ct);
        return Results.Ok(new { lines });
    }

    private static async Task<IResult> SetLineQuantity(
        string lineId,
        SetCartLineQuantityRequest body,
        HttpRequest req,
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(req.HttpContext, tenantContext, audit, ct);
        if (tenantFail is not null) return tenantFail;
        var tenantId = req.ResolveTenantId(tenantContext)!;
        var userId = UserId(req.HttpContext.User);
        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

        var cart = await db.ShopperCarts.FirstOrDefaultAsync(c => c.TenantId == tenantId && c.PortalUserId == userId, ct);
        if (cart is null) return Results.NotFound();

        var line = await db.ShopperCartLines.FirstOrDefaultAsync(l => l.CartId == cart.Id && l.Id == lineId, ct);
        if (line is null) return Results.NotFound();

        var qty = Math.Clamp(body.Quantity, 0, 999);
        if (qty <= 0)
        {
            db.ShopperCartLines.Remove(line);
        }
        else
        {
            line.Quantity = qty;
        }

        cart.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        var lines = await LoadCartLineDtosAsync(db, tenantId, userId, ct);
        return Results.Ok(new { lines });
    }

    private static async Task<IResult> RemoveLine(
        string lineId,
        HttpRequest req,
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(req.HttpContext, tenantContext, audit, ct);
        if (tenantFail is not null) return tenantFail;
        var tenantId = req.ResolveTenantId(tenantContext)!;
        var userId = UserId(req.HttpContext.User);
        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

        var cart = await db.ShopperCarts.FirstOrDefaultAsync(c => c.TenantId == tenantId && c.PortalUserId == userId, ct);
        if (cart is null) return Results.NoContent();

        var line = await db.ShopperCartLines.FirstOrDefaultAsync(l => l.CartId == cart.Id && l.Id == lineId, ct);
        if (line is not null)
        {
            db.ShopperCartLines.Remove(line);
            cart.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);
        }

        return Results.NoContent();
    }

    private static async Task<IResult> ClearCart(
        HttpRequest req,
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(req.HttpContext, tenantContext, audit, ct);
        if (tenantFail is not null) return tenantFail;
        var tenantId = req.ResolveTenantId(tenantContext)!;
        var userId = UserId(req.HttpContext.User);
        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

        var cart = await db.ShopperCarts
            .Include(c => c.Lines)
            .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.PortalUserId == userId, ct);
        if (cart is not null)
        {
            db.ShopperCartLines.RemoveRange(cart.Lines);
            cart.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);
        }

        return Results.NoContent();
    }

    private static async Task<IResult> RecordProductView(
        string productId,
        HttpRequest req,
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(req.HttpContext, tenantContext, audit, ct);
        if (tenantFail is not null) return tenantFail;
        var tenantId = req.ResolveTenantId(tenantContext)!;
        var userId = UserId(req.HttpContext.User);
        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

        productId = productId.Trim();
        if (productId.Length == 0) return Results.BadRequest(new { error = "productId is required." });

        if (!await db.Products.AnyAsync(p => p.TenantId == tenantId && p.Id == productId && p.Status == "active", ct))
            return Results.NotFound();

        var row = await db.ShopperProductViews
            .FirstOrDefaultAsync(v => v.TenantId == tenantId && v.PortalUserId == userId && v.ProductId == productId, ct);
        var now = DateTimeOffset.UtcNow;
        if (row is null)
        {
            db.ShopperProductViews.Add(new ShopperProductView
            {
                TenantId = tenantId,
                PortalUserId = userId,
                ProductId = productId,
                ViewedAt = now
            });
        }
        else
        {
            row.ViewedAt = now;
        }

        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    }

    private static async Task<IResult> ListRecentProductViews(
        HttpRequest req,
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(req.HttpContext, tenantContext, audit, ct);
        if (tenantFail is not null) return tenantFail;
        var tenantId = req.ResolveTenantId(tenantContext)!;
        var userId = UserId(req.HttpContext.User);
        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

        var productIds = await db.ShopperProductViews.AsNoTracking()
            .Where(v => v.TenantId == tenantId && v.PortalUserId == userId)
            .OrderByDescending(v => v.ViewedAt)
            .Select(v => v.ProductId)
            .Take(16)
            .ToListAsync(ct);

        if (productIds.Count == 0) return Results.Ok(Array.Empty<ProductCardDto>());

        var products = await db.Products.AsNoTracking()
            .Where(p => p.TenantId == tenantId && p.Status == "active" && productIds.Contains(p.Id))
            .ToListAsync(ct);

        var order = productIds.Select((id, i) => (id, i)).ToDictionary(x => x.id, x => x.i);
        var sorted = products.OrderBy(p => order.GetValueOrDefault(p.Id, int.MaxValue)).ToList();

        var skuByProduct = await LoadSkuCodesByProductAsync(db, tenantId, sorted.Select(p => p.Id).ToList(), ct);
        var nowCard = DateTimeOffset.UtcNow;
        var cards = sorted
            .Select(p => ToProductCardDto(p, skuByProduct, nowCard))
            .ToList();

        return Results.Ok(cards);
    }

    private static async Task<IReadOnlyDictionary<string, IReadOnlyList<string>>> LoadSkuCodesByProductAsync(
        CommerceDbContext db,
        string tenantId,
        IReadOnlyList<string> productIds,
        CancellationToken ct)
    {
        if (productIds.Count == 0) return new Dictionary<string, IReadOnlyList<string>>();
        var skuRows = await db.Skus.AsNoTracking()
            .Where(s => s.TenantId == tenantId && productIds.Contains(s.ProductId) && s.Status == "active")
            .OrderBy(s => s.SkuCode)
            .Select(s => new { s.ProductId, s.SkuCode })
            .ToListAsync(ct);
        return skuRows
            .GroupBy(x => x.ProductId)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<string>)g.Select(x => x.SkuCode).ToList());
    }

    private static ProductCardDto ToProductCardDto(
        Product p,
        IReadOnlyDictionary<string, IReadOnlyList<string>> skuByProduct,
        DateTimeOffset nowCard)
    {
        var f = CommercePricingCardReader.ReadCard(p.CommerceJson);
        var offerMinor = CommercePricingCardReader.ResolveOfferPriceMinorForCard(f, p.MinPriceMinor);
        var imageIndicators = ProductMerchandisingIndicators.Build(
            p.CommerceJson,
            p.MinPriceMinor,
            f.ListPriceMinor,
            offerMinor,
            f.OfferType,
            f.OfferCardText,
            p.PublishedAt,
            nowCard,
            ProductMerchandisingIndicators.DefaultCardMax,
            compactCard: true);
        var vendorCode = CommerceVendorDisplayReader.ResolveVendorCode(p.CommerceJson, p.VendorPortalUserId);
        var skuCodes = skuByProduct.TryGetValue(p.Id, out var codes) ? codes : Array.Empty<string>();
        return new ProductCardDto(
            p.Id,
            p.Slug,
            p.TitleDisplay,
            p.HeroStorageKey,
            p.MinPriceMinor,
            p.Currency,
            p.PublishedAt,
            f.ListPriceMinor,
            f.OfferType,
            f.OfferCardText,
            offerMinor,
            imageIndicators,
            vendorCode,
            skuCodes,
            p.ProductTypeId);
    }

    private static async Task<ShopperCart> GetOrCreateCartAsync(
        CommerceDbContext db,
        string tenantId,
        string userId,
        CancellationToken ct)
    {
        var cart = await db.ShopperCarts.FirstOrDefaultAsync(c => c.TenantId == tenantId && c.PortalUserId == userId, ct);
        if (cart is not null) return cart;

        cart = new ShopperCart
        {
            Id = "cart_" + Guid.NewGuid().ToString("N")[..12],
            TenantId = tenantId,
            PortalUserId = userId,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.ShopperCarts.Add(cart);
        await db.SaveChangesAsync(ct);
        return cart;
    }

    private static async Task<List<CartLineDto>> LoadCartLineDtosAsync(
        CommerceDbContext db,
        string tenantId,
        string userId,
        CancellationToken ct)
    {
        var cart = await db.ShopperCarts.AsNoTracking()
            .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.PortalUserId == userId, ct);
        if (cart is null) return [];

        var rows = await db.ShopperCartLines.AsNoTracking()
            .Where(l => l.CartId == cart.Id)
            .OrderBy(l => l.Id)
            .ToListAsync(ct);
        if (rows.Count == 0) return [];

        var productIds = rows.Select(r => r.ProductId).Distinct().ToList();
        var products = await db.Products.AsNoTracking()
            .Where(p => p.TenantId == tenantId && productIds.Contains(p.Id) && p.Status == "active")
            .ToDictionaryAsync(p => p.Id, ct);

        var skuIds = rows.Where(r => r.SkuId != null).Select(r => r.SkuId!).Distinct().ToList();
        var skus = skuIds.Count == 0
            ? new Dictionary<string, Sku>()
            : await db.Skus.AsNoTracking()
                .Where(s => skuIds.Contains(s.Id))
                .ToDictionaryAsync(s => s.Id, ct);

        var dtos = new List<CartLineDto>();
        foreach (var row in rows)
        {
            if (!products.TryGetValue(row.ProductId, out var product)) continue;
            skus.TryGetValue(row.SkuId ?? "", out var sku);
            var skuCode = sku?.SkuCode;
            dtos.Add(new CartLineDto(
                row.Id,
                row.ProductId,
                product.Slug,
                product.TitleDisplay,
                row.SkuId,
                skuCode,
                row.Quantity,
                row.UnitPriceMinor ?? product.MinPriceMinor,
                row.Currency ?? product.Currency,
                product.HeroStorageKey,
                product.VendorPortalUserId,
                row.PackLabel,
                row.PackUnitType,
                row.PackQuantity,
                row.UnitsPerPack));
        }

        return dtos;
    }

    private static string? TrimOrNull(string? value, int maxLen)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var t = value.Trim();
        return t.Length <= maxLen ? t : t[..maxLen];
    }

    private sealed record UpsertCartLineRequest(
        string? ProductId,
        string? SkuId,
        int Quantity,
        long? UnitPriceMinor,
        string? Currency,
        string? PackLabel,
        string? PackUnitType,
        decimal? PackQuantity,
        decimal? UnitsPerPack);

    private sealed record SetCartLineQuantityRequest(int Quantity);

    public sealed record CartLineDto(
        string LineId,
        string ProductId,
        string Slug,
        string TitleDisplay,
        string? SkuId,
        string? SkuCode,
        int Quantity,
        long? UnitPriceMinor,
        string? Currency,
        string? HeroStorageKey,
        string? VendorCode,
        string? PackLabel,
        string? PackUnitType,
        decimal? PackQuantity,
        decimal? UnitsPerPack);
}
