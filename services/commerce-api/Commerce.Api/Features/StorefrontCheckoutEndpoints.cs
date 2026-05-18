using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text.Json;
using Commerce.Api.Audit;
using Commerce.Api.Catalog;
using Commerce.Api.Data;
using Commerce.Api.Entities;
using Commerce.Api.Infrastructure;
using Commerce.Api.Orders;
using static Commerce.Api.Orders.StorefrontOrderFulfillment;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using WebkitFx.Platform.Tenancy;

namespace Commerce.Api.Features;

public static class StorefrontCheckoutEndpoints
{
    public static void MapStorefrontCheckoutV1(this WebApplication app)
    {
        var g = app.MapGroup("/api/v1/storefront/checkout");
        g.MapPost("/place-order", PlaceOrder).AllowAnonymous().WithName("StorefrontPlaceOrder");
        g.MapGet("/orders", ListShopperOrders).RequireAuthorization("Shopper").WithName("StorefrontListShopperOrders");
        g.MapGet("/orders/{orderId}", GetOrder).AllowAnonymous().WithName("StorefrontGetOrder");
    }

    private static string? UserId(ClaimsPrincipal user) =>
        user.FindFirstValue(JwtRegisteredClaimNames.Sub)
        ?? user.FindFirstValue(ClaimTypes.NameIdentifier);

    private static async Task<IResult> PlaceOrder(
        PlaceStorefrontOrderRequest body,
        HttpRequest req,
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        IOrderEmailNotifier emailNotifier,
        IOptions<OrderEmailOptions> emailOptions,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(req.HttpContext, tenantContext, audit, ct);
        if (tenantFail is not null) return tenantFail;
        var tenantId = req.ResolveTenantId(tenantContext)!;

        var email = (body.ShopperEmail ?? "").Trim();
        if (email.Length == 0 || !email.Contains('@'))
            return Results.BadRequest(new { error = "shopperEmail is required." });

        var linesIn = body.Lines ?? [];
        if (linesIn.Count == 0)
            return Results.BadRequest(new { error = "At least one line is required." });

        var productTypeId = (body.ProductTypeId ?? "app_sr").Trim();
        if (productTypeId.Length == 0) productTypeId = "app_sr";

        var canonicalProductTypeId = await CatalogApplicationVertical.ResolveToProductTypeIdAsync(
            db, tenantId, productTypeId, ct);
        var allowedProductTypeIds = await CatalogApplicationVertical.ResolveProductTypeIdsForCatalogFilterAsync(
            db, tenantId, productTypeId, ct);

        var shopperUserId = UserId(req.HttpContext.User);
        var now = DateTimeOffset.UtcNow;
        var orderId = $"ord_{Guid.NewGuid():N}"[..20];

        var productIds = linesIn.Select(l => (l.ProductId ?? "").Trim()).Where(id => id.Length > 0).Distinct().ToList();
        var products = await db.Products.AsNoTracking()
            .Where(p => p.TenantId == tenantId && productIds.Contains(p.Id) && p.Status == "active")
            .ToDictionaryAsync(p => p.Id, ct);

        if (products.Count != productIds.Count)
            return Results.BadRequest(new { error = "One or more products are missing or inactive." });

        long totalMinor = 0;
        var currency = "INR";
        var orderLines = new List<StorefrontOrderLine>();
        var emailRows = new List<OrderLineEmailRow>();

        foreach (var line in linesIn)
        {
            var productId = (line.ProductId ?? "").Trim();
            if (!products.TryGetValue(productId, out var product))
                return Results.BadRequest(new { error = $"Unknown product: {productId}" });

            var lineProductTypeId = product.ProductTypeId?.Trim();
            if (!string.IsNullOrEmpty(lineProductTypeId)
                && !allowedProductTypeIds.Contains(lineProductTypeId))
            {
                return Results.BadRequest(new { error = $"Product {productId} is not in storefront scope." });
            }

            var qty = Math.Clamp(line.Quantity <= 0 ? 1 : line.Quantity, 1, 999);
            var unit = line.UnitPriceMinor ?? product.MinPriceMinor ?? 0;
            if (unit < 0) unit = 0;
            var lineCurrency = (line.Currency ?? product.Currency ?? "INR").Trim().ToUpperInvariant();
            currency = lineCurrency;

            var title = (line.TitleDisplay ?? product.TitleDisplay).Trim();
            var vendorCode = CommerceVendorDisplayReader.ResolveVendorCode(product.CommerceJson, product.VendorPortalUserId);

            var lineId = $"ol_{Guid.NewGuid():N}"[..20];
            orderLines.Add(new StorefrontOrderLine
            {
                Id = lineId,
                OrderId = orderId,
                ProductId = productId,
                SkuId = string.IsNullOrWhiteSpace(line.SkuId) ? null : line.SkuId.Trim(),
                SkuCode = string.IsNullOrWhiteSpace(line.SkuCode) ? null : line.SkuCode.Trim(),
                TitleDisplay = title.Length > 0 ? title : product.TitleDisplay,
                VendorPortalUserId = product.VendorPortalUserId,
                VendorCode = vendorCode,
                Quantity = qty,
                UnitPriceMinor = unit,
                Currency = lineCurrency,
            });

            totalMinor += unit * qty;
            emailRows.Add(new OrderLineEmailRow(
                title.Length > 0 ? title : product.TitleDisplay,
                string.IsNullOrWhiteSpace(line.SkuCode) ? null : line.SkuCode.Trim(),
                qty,
                unit,
                lineCurrency,
                vendorCode,
                product.VendorPortalUserId));
        }

        var shippingJson = body.ShippingAddress == null
            ? null
            : JsonSerializer.Serialize(body.ShippingAddress);
        var shippingText = FormatShippingAddress(body.ShippingAddress);

        var isCafe = await FulfillmentStatusLookup.IsCafeVerticalOrderAsync(db, tenantId, productTypeId, ct);
        var orderChannel = isCafe
            ? CafeOrderWorkflow.NormalizeChannel(body.OrderChannel)
            : null;
        var tableCode = isCafe && !string.IsNullOrWhiteSpace(body.TableCode)
            ? body.TableCode.Trim()[..Math.Min(32, body.TableCode.Trim().Length)]
            : null;
        var initialFulfillment = isCafe
            ? CafeOrderWorkflow.InitialStatusForChannel(orderChannel)
            : Placed;

        var order = new StorefrontOrder
        {
            Id = orderId,
            TenantId = tenantId,
            ShopperPortalUserId = shopperUserId,
            ShopperEmail = email,
            ShopperName = string.IsNullOrWhiteSpace(body.ShopperName) ? null : body.ShopperName.Trim(),
            ShopperPhone = string.IsNullOrWhiteSpace(body.ShopperPhone) ? null : body.ShopperPhone.Trim(),
            ShippingAddressJson = shippingJson,
            ProductTypeId = canonicalProductTypeId.Length > 64
                ? canonicalProductTypeId[..64]
                : canonicalProductTypeId,
            OrderChannel = orderChannel,
            TableCode = tableCode,
            Status = "placed",
            FulfillmentStatus = initialFulfillment,
            TrackingNote = null,
            StatusUpdatedAt = now,
            PaymentMethod = (body.PaymentMethod ?? "mock").Trim(),
            PaymentStatus = (body.PaymentStatus ?? "captured").Trim(),
            TotalMinor = totalMinor,
            Currency = currency,
            PlacedAt = now,
            Lines = orderLines,
        };

        db.StorefrontOrders.Add(order);
        await db.SaveChangesAsync(ct);

        var adminEmails = await db.PortalUsers.AsNoTracking()
            .Where(u => u.TenantId == tenantId && u.Role == "admin" && !u.LoginDisabled)
            .Select(u => u.Email)
            .ToListAsync(ct);

        var configuredAdmins = emailOptions.Value.AdminNotificationEmails ?? [];
        var adminRecipients = adminEmails
            .Concat(configuredAdmins)
            .Where(e => !string.IsNullOrWhiteSpace(e))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Select(e => new OrderEmailRecipient(e.Trim(), "admin"))
            .ToList();

        var vendorIds = orderLines
            .Select(l => l.VendorPortalUserId)
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Distinct(StringComparer.Ordinal)!
            .Cast<string>()
            .ToList();

        var vendorUsers = vendorIds.Count == 0
            ? new Dictionary<string, string>()
            : await db.PortalUsers.AsNoTracking()
                .Where(u => u.TenantId == tenantId && vendorIds.Contains(u.Id) && u.Role == "vendor")
                .ToDictionaryAsync(u => u.Id, u => u.Email, ct);

        var vendorRecipients = new Dictionary<string, IReadOnlyList<OrderEmailRecipient>>(StringComparer.Ordinal);
        foreach (var vendorId in vendorIds)
        {
            if (!vendorUsers.TryGetValue(vendorId, out var vendorEmail) || string.IsNullOrWhiteSpace(vendorEmail))
                continue;
            vendorRecipients[vendorId] = [new OrderEmailRecipient(vendorEmail.Trim(), "vendor")];
        }

        var emailCtx = new OrderPlacedEmailContext(
            tenantId,
            orderId,
            email,
            order.ShopperName,
            order.ShopperPhone,
            shippingText,
            order.PaymentMethod,
            order.PaymentStatus,
            currency,
            totalMinor,
            now,
            emailRows);

        await emailNotifier.NotifyOrderPlacedAsync(emailCtx, adminRecipients, vendorRecipients, ct);

        var progression = await FulfillmentStatusLookup.LoadProgressionForOrderAsync(db, tenantId, order, ct);
        return Results.Created($"/api/v1/storefront/checkout/orders/{orderId}", StorefrontOrderDtoMapper.ToDto(order, fulfillmentProgression: progression));
    }

    private static async Task<IResult> ListShopperOrders(
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

        var orders = await db.StorefrontOrders.AsNoTracking()
            .Include(o => o.Lines)
            .Where(o => o.TenantId == tenantId && o.ShopperPortalUserId == userId)
            .OrderByDescending(o => o.PlacedAt)
            .Take(50)
            .ToListAsync(ct);

        var progression = await FulfillmentStatusLookup.LoadAsync(db, tenantId, FulfillmentStatusLookup.AdminLookupTypeId, ct);
        return Results.Ok(new { items = orders.Select(o => StorefrontOrderDtoMapper.ToDto(o, fulfillmentProgression: progression)).ToList() });
    }

    private static async Task<IResult> GetOrder(
        string orderId,
        string? email,
        HttpRequest req,
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(req.HttpContext, tenantContext, audit, ct);
        if (tenantFail is not null) return tenantFail;
        var tenantId = req.ResolveTenantId(tenantContext)!;
        var id = orderId.Trim();
        if (id.Length == 0) return Results.BadRequest();

        var order = await db.StorefrontOrders.AsNoTracking()
            .Include(o => o.Lines)
            .FirstOrDefaultAsync(o => o.TenantId == tenantId && o.Id == id, ct);
        if (order is null) return Results.NotFound();
        var progression = await FulfillmentStatusLookup.LoadAsync(db, tenantId, FulfillmentStatusLookup.AdminLookupTypeId, ct);

        var shopperUserId = UserId(req.HttpContext.User);
        if (!string.IsNullOrEmpty(shopperUserId)
            && string.Equals(order.ShopperPortalUserId, shopperUserId, StringComparison.Ordinal))
        {
            return Results.Ok(StorefrontOrderDtoMapper.ToDto(order, fulfillmentProgression: progression));
        }

        var emailNorm = email?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(emailNorm)
            || !string.Equals(order.ShopperEmail.Trim().ToLowerInvariant(), emailNorm, StringComparison.Ordinal))
        {
            return Results.Json(new { error = "Provide the checkout email as ?email= to view this order." }, statusCode: 403);
        }

        return Results.Ok(StorefrontOrderDtoMapper.ToDto(order, fulfillmentProgression: progression));
    }

    private static string FormatShippingAddress(ShippingAddressDto? addr)
    {
        if (addr is null) return "—";
        var parts = new[]
        {
            addr.Line1,
            addr.Line2,
            addr.City,
            addr.State,
            addr.PostalCode,
            addr.Country,
        }.Where(p => !string.IsNullOrWhiteSpace(p)).Select(p => p!.Trim());
        var text = string.Join(", ", parts);
        return string.IsNullOrWhiteSpace(text) ? "—" : text;
    }

    public sealed class PlaceStorefrontOrderRequest
    {
        public string? ShopperEmail { get; set; }
        public string? ShopperName { get; set; }
        public string? ShopperPhone { get; set; }
        public ShippingAddressDto? ShippingAddress { get; set; }
        public string? ProductTypeId { get; set; }
        /// <summary>Café: dine_in | qr | aggregator.</summary>
        public string? OrderChannel { get; set; }
        public string? TableCode { get; set; }
        public string? PaymentMethod { get; set; }
        public string? PaymentStatus { get; set; }
        public List<PlaceStorefrontOrderLineRequest>? Lines { get; set; }
    }

    public sealed class PlaceStorefrontOrderLineRequest
    {
        public string? ProductId { get; set; }
        public string? SkuId { get; set; }
        public string? SkuCode { get; set; }
        public string? TitleDisplay { get; set; }
        public int Quantity { get; set; }
        public long? UnitPriceMinor { get; set; }
        public string? Currency { get; set; }
    }

    public sealed class ShippingAddressDto
    {
        public string? Line1 { get; set; }
        public string? Line2 { get; set; }
        public string? City { get; set; }
        public string? State { get; set; }
        public string? PostalCode { get; set; }
        public string? Country { get; set; }
    }
}
