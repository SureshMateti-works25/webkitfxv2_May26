using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Commerce.Api.Audit;
using Commerce.Api.Catalog;
using Commerce.Api.Data;
using Commerce.Api.Entities;
using Commerce.Api.Infrastructure;
using Commerce.Api.Orders;
using Microsoft.EntityFrameworkCore;
using WebkitFx.Platform.Tenancy;

namespace Commerce.Api.Features;

public static class StorefrontOrderManagementEndpoints
{
    public static void MapStorefrontOrderManagementV1(this WebApplication app)
    {
        var admin = app.MapGroup("/api/v1/admin/orders").RequireAuthorization("Admin");
        admin.MapGet("", AdminListOrders).WithName("AdminListOrders");
        admin.MapGet("{orderId}", AdminGetOrder).WithName("AdminGetOrder");
        admin.MapPatch("{orderId}", AdminPatchOrder).WithName("AdminPatchOrder");

        var vendor = app.MapGroup("/api/v1/vendor/orders").RequireAuthorization("Vendor");
        vendor.MapGet("", VendorListOrders).WithName("VendorListOrders");
        vendor.MapGet("{orderId}", VendorGetOrder).WithName("VendorGetOrder");
        vendor.MapPatch("{orderId}", VendorPatchOrder).WithName("VendorPatchOrder");

        var track = app.MapGroup("/api/v1/storefront/checkout");
        track.MapGet("/orders/{orderId}/track", TrackOrder).AllowAnonymous().WithName("StorefrontTrackOrder");
    }

    private static string? UserId(ClaimsPrincipal user) =>
        user.FindFirstValue(JwtRegisteredClaimNames.Sub)
        ?? user.FindFirstValue(ClaimTypes.NameIdentifier);

    private static async Task<IResult> TrackOrder(
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

        var order = await LoadOrderAsync(db, tenantId, orderId.Trim(), ct);
        if (order is null) return Results.NotFound();
        var progression = await FulfillmentStatusLookup.LoadAsync(db, tenantId, FulfillmentStatusLookup.AdminLookupTypeId, ct);

        var shopperUserId = UserId(req.HttpContext.User);
        if (!string.IsNullOrEmpty(shopperUserId)
            && string.Equals(order.ShopperPortalUserId, shopperUserId, StringComparison.Ordinal))
        {
            return Results.Ok(StorefrontOrderDtoMapper.ToDto(order, fulfillmentProgression: progression));
        }

        var emailNorm = NormalizeEmail(email);
        if (emailNorm is null || !string.Equals(NormalizeEmail(order.ShopperEmail), emailNorm, StringComparison.Ordinal))
            return Results.Json(new { error = "Enter the email used at checkout to view this order." }, statusCode: 403);

        return Results.Ok(StorefrontOrderDtoMapper.ToDto(order, fulfillmentProgression: progression));
    }

    private static async Task<IResult> AdminListOrders(
        HttpRequest req,
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(req.HttpContext, tenantContext, audit, ct);
        if (tenantFail is not null) return tenantFail;
        var tenantId = req.ResolveTenantId(tenantContext)!;

        var orders = await db.StorefrontOrders.AsNoTracking()
            .Include(o => o.Lines)
            .Where(o => o.TenantId == tenantId)
            .OrderByDescending(o => o.PlacedAt)
            .Take(100)
            .ToListAsync(ct);

        var progression = await FulfillmentStatusLookup.LoadAsync(db, tenantId, FulfillmentStatusLookup.AdminLookupTypeId, ct);
        return Results.Ok(new
        {
            items = orders.Select(o => StorefrontOrderDtoMapper.ToDto(o, fulfillmentProgression: progression)).ToList(),
        });
    }

    private static async Task<IResult> AdminGetOrder(
        string orderId,
        HttpRequest req,
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(req.HttpContext, tenantContext, audit, ct);
        if (tenantFail is not null) return tenantFail;
        var tenantId = req.ResolveTenantId(tenantContext)!;

        var order = await LoadOrderAsync(db, tenantId, orderId.Trim(), ct);
        if (order is null) return Results.NotFound();
        var progression = await FulfillmentStatusLookup.LoadAsync(db, tenantId, FulfillmentStatusLookup.AdminLookupTypeId, ct);
        return Results.Ok(StorefrontOrderDtoMapper.ToDto(order, fulfillmentProgression: progression));
    }

    private static async Task<IResult> AdminPatchOrder(
        string orderId,
        PatchOrderRequest body,
        HttpRequest req,
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(req.HttpContext, tenantContext, audit, ct);
        if (tenantFail is not null) return tenantFail;
        _ = req.ResolveTenantId(tenantContext);

        return Results.Json(
            new { error = "Admins cannot change fulfillment. Vendors pack and ship; use GET to monitor orders." },
            statusCode: 403);
    }

    private static async Task<IResult> VendorListOrders(
        HttpRequest req,
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(req.HttpContext, tenantContext, audit, ct);
        if (tenantFail is not null) return tenantFail;
        var tenantId = req.ResolveTenantId(tenantContext)!;
        var vendorId = UserId(req.HttpContext.User);
        if (string.IsNullOrEmpty(vendorId)) return Results.Unauthorized();

        var orders = await db.StorefrontOrders.AsNoTracking()
            .Include(o => o.Lines)
            .Where(o => o.TenantId == tenantId && o.Lines.Any(l => l.VendorPortalUserId == vendorId))
            .OrderByDescending(o => o.PlacedAt)
            .Take(100)
            .ToListAsync(ct);

        var progression = await FulfillmentStatusLookup.LoadAsync(db, tenantId, FulfillmentStatusLookup.AdminLookupTypeId, ct);
        return Results.Ok(new
        {
            items = orders
                .Select(o => StorefrontOrderDtoMapper.ToDto(o, vendorScoped: true, vendorPortalUserId: vendorId, fulfillmentProgression: progression))
                .ToList(),
        });
    }

    private static async Task<IResult> VendorGetOrder(
        string orderId,
        HttpRequest req,
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(req.HttpContext, tenantContext, audit, ct);
        if (tenantFail is not null) return tenantFail;
        var tenantId = req.ResolveTenantId(tenantContext)!;
        var vendorId = UserId(req.HttpContext.User);
        if (string.IsNullOrEmpty(vendorId)) return Results.Unauthorized();

        var order = await LoadOrderAsync(db, tenantId, orderId.Trim(), ct);
        if (order is null || !order.Lines.Any(l => l.VendorPortalUserId == vendorId))
            return Results.NotFound();

        var progression = await FulfillmentStatusLookup.LoadAsync(db, tenantId, FulfillmentStatusLookup.AdminLookupTypeId, ct);
        return Results.Ok(StorefrontOrderDtoMapper.ToDto(order, vendorScoped: true, vendorPortalUserId: vendorId, fulfillmentProgression: progression));
    }

    private static async Task<IResult> VendorPatchOrder(
        string orderId,
        PatchOrderRequest body,
        HttpRequest req,
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(req.HttpContext, tenantContext, audit, ct);
        if (tenantFail is not null) return tenantFail;
        var tenantId = req.ResolveTenantId(tenantContext)!;
        var vendorId = UserId(req.HttpContext.User);
        if (string.IsNullOrEmpty(vendorId)) return Results.Unauthorized();

        var order = await db.StorefrontOrders
            .Include(o => o.Lines)
            .FirstOrDefaultAsync(o => o.TenantId == tenantId && o.Id == orderId.Trim(), ct);
        if (order is null || !order.Lines.Any(l => l.VendorPortalUserId == vendorId))
            return Results.NotFound();

        var allowed = await FulfillmentStatusLookup.LoadAsync(db, tenantId, FulfillmentStatusLookup.VendorLookupTypeId, ct);
        var err = ApplyPatch(order, body, allowed);
        if (err is not null) return Results.BadRequest(new { error = err });

        await db.SaveChangesAsync(ct);
        var progression = await FulfillmentStatusLookup.LoadAsync(db, tenantId, FulfillmentStatusLookup.AdminLookupTypeId, ct);
        return Results.Ok(StorefrontOrderDtoMapper.ToDto(order, vendorScoped: true, vendorPortalUserId: vendorId, fulfillmentProgression: progression));
    }

    private static string? ApplyPatch(
        StorefrontOrder order,
        PatchOrderRequest body,
        IReadOnlyList<FulfillmentStatusLookupRow> allowedStatuses)
    {
        var changed = false;
        if (body.FulfillmentStatus is not null)
        {
            var next = StorefrontOrderFulfillment.Normalize(body.FulfillmentStatus);
            if (!FulfillmentStatusLookup.IsAllowedCode(allowedStatuses, next))
                return "Invalid fulfillmentStatus for this role. Add or enable the value in Admin → Lookups.";
            order.FulfillmentStatus = next;
            changed = true;
        }

        if (body.TrackingNote is not null)
        {
            order.TrackingNote = string.IsNullOrWhiteSpace(body.TrackingNote) ? null : body.TrackingNote.Trim();
            changed = true;
        }

        if (changed)
            order.StatusUpdatedAt = DateTimeOffset.UtcNow;

        return null;
    }

    private static async Task<StorefrontOrder?> LoadOrderAsync(
        CommerceDbContext db,
        string tenantId,
        string orderId,
        CancellationToken ct)
    {
        if (orderId.Length == 0) return null;
        return await db.StorefrontOrders.AsNoTracking()
            .Include(o => o.Lines)
            .FirstOrDefaultAsync(o => o.TenantId == tenantId && o.Id == orderId, ct);
    }

    private static string? NormalizeEmail(string? email)
    {
        var e = email?.Trim().ToLowerInvariant();
        return string.IsNullOrEmpty(e) ? null : e;
    }

    public sealed class PatchOrderRequest
    {
        public string? FulfillmentStatus { get; set; }
        public string? TrackingNote { get; set; }
    }
}
