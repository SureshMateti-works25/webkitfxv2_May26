using System.Security.Claims;
using Commerce.Api.Audit;
using Commerce.Api.Data;
using Commerce.Api.Entities;
using Commerce.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using WebkitFx.Platform.Tenancy;

namespace Commerce.Api.Catalog;

public static class StorefrontSponsoredEndpoints
{
    private const string Tag = "catalog";

    public static void MapStorefrontSponsoredV1(this WebApplication app)
    {
        app.MapGet("/api/v1/catalog/sponsored-products", ListPublicSponsored)
            .WithTags(Tag)
            .WithName("CatalogListSponsoredProducts");

        app.MapGet("/api/v1/admin/storefront-sponsored-products", ListAdminSponsored)
            .RequireAuthorization("Admin")
            .WithTags("admin")
            .WithName("AdminListStorefrontSponsoredProducts");

        app.MapPost("/api/v1/admin/storefront-sponsored-products", CreateSponsored)
            .RequireAuthorization("Admin")
            .WithTags("admin")
            .WithName("AdminCreateStorefrontSponsoredProduct");

        app.MapPut("/api/v1/admin/storefront-sponsored-products/{sponsoredId}", UpdateSponsored)
            .RequireAuthorization("Admin")
            .WithTags("admin")
            .WithName("AdminUpdateStorefrontSponsoredProduct");

        app.MapDelete("/api/v1/admin/storefront-sponsored-products/{sponsoredId}", DeleteSponsored)
            .RequireAuthorization("Admin")
            .WithTags("admin")
            .WithName("AdminDeleteStorefrontSponsoredProduct");
    }

    private static string? ActorId(ClaimsPrincipal user) =>
        user.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? user.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);

    private static async Task<IResult> ListPublicSponsored(
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

        var rows = await (
            from s in db.StorefrontSponsoredProducts.AsNoTracking()
            join p in db.Products.AsNoTracking() on s.ProductId equals p.Id
            where s.TenantId == tenantId && s.IsActive && p.TenantId == tenantId && p.Status == "active"
            orderby s.SortOrder, s.Id
            select new StorefrontSponsoredProductPublicDto(
                s.Id,
                s.ProductId,
                p.Slug,
                p.TitleDisplay,
                p.HeroStorageKey,
                p.MinPriceMinor,
                p.Currency,
                s.Label,
                s.SortOrder)
        ).ToListAsync(ct);

        return Results.Ok(rows);
    }

    private static async Task<IResult> ListAdminSponsored(
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
        if (string.IsNullOrWhiteSpace(ActorId(user)))
            return Results.Unauthorized();

        var rows = await (
            from s in db.StorefrontSponsoredProducts.AsNoTracking()
            join p in db.Products.AsNoTracking() on s.ProductId equals p.Id
            where s.TenantId == tenantId && p.TenantId == tenantId
            orderby s.SortOrder, s.Id
            select new StorefrontSponsoredProductAdminDto(
                s.Id,
                s.ProductId,
                p.Slug,
                p.TitleDisplay,
                p.Status,
                s.Label,
                s.SortOrder,
                s.IsActive)
        ).ToListAsync(ct);

        return Results.Ok(rows);
    }

    private static async Task<IResult> CreateSponsored(
        CreateStorefrontSponsoredRequest body,
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
        var actor = ActorId(user);
        if (string.IsNullOrWhiteSpace(actor))
            return Results.Unauthorized();

        var productId = body.ProductId?.Trim() ?? "";
        if (productId.Length is < 1 or > 64)
            return Results.BadRequest(new { error = "invalid_product_id" });

        var product = await db.Products.AsNoTracking()
            .FirstOrDefaultAsync(p => p.TenantId == tenantId && p.Id == productId, ct);
        if (product is null)
            return Results.BadRequest(new { error = "unknown_product", productId });

        var id = "ssp_" + Guid.NewGuid().ToString("N")[..20];

        var label = string.IsNullOrWhiteSpace(body.Label) ? null : body.Label.Trim();
        if (label is { Length: > 160 })
            return Results.BadRequest(new { error = "label_too_long" });

        var row = new StorefrontSponsoredProduct
        {
            Id = id,
            TenantId = tenantId,
            ProductId = productId,
            Label = label,
            SortOrder = body.SortOrder,
            IsActive = body.IsActive ?? true
        };

        db.StorefrontSponsoredProducts.Add(row);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            return Results.Conflict(new { error = "product_already_sponsored" });
        }

        await audit.RecordAsync(
            AuditActions.StorefrontSponsorMutate,
            "success",
            tenantId,
            actor,
            "storefront_sponsored_product",
            row.Id,
            new { op = "create", productId },
            request.HttpContext,
            ct);

        return Results.Created(
            $"/api/v1/admin/storefront-sponsored-products/{Uri.EscapeDataString(row.Id)}",
            new StorefrontSponsoredProductAdminDto(
                row.Id,
                row.ProductId,
                product.Slug,
                product.TitleDisplay,
                product.Status,
                row.Label,
                row.SortOrder,
                row.IsActive));
    }

    private static async Task<IResult> UpdateSponsored(
        string sponsoredId,
        UpdateStorefrontSponsoredRequest body,
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
        var actor = ActorId(user);
        if (string.IsNullOrWhiteSpace(actor))
            return Results.Unauthorized();

        sponsoredId = sponsoredId.Trim();
        var row = await db.StorefrontSponsoredProducts
            .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Id == sponsoredId, ct);
        if (row is null)
            return Results.NotFound();

        if (body.Label is not null)
        {
            var t = body.Label.Trim();
            row.Label = t.Length == 0 ? null : t;
            if (row.Label is { Length: > 160 })
                return Results.BadRequest(new { error = "label_too_long" });
        }

        if (body.SortOrder is { } so)
            row.SortOrder = so;

        if (body.IsActive is { } ia)
            row.IsActive = ia;

        await db.SaveChangesAsync(ct);

        var product = await db.Products.AsNoTracking()
            .FirstAsync(p => p.TenantId == tenantId && p.Id == row.ProductId, ct);

        await audit.RecordAsync(
            AuditActions.StorefrontSponsorMutate,
            "success",
            tenantId,
            actor,
            "storefront_sponsored_product",
            row.Id,
            new { op = "update" },
            request.HttpContext,
            ct);

        return Results.Ok(new StorefrontSponsoredProductAdminDto(
            row.Id,
            row.ProductId,
            product.Slug,
            product.TitleDisplay,
            product.Status,
            row.Label,
            row.SortOrder,
            row.IsActive));
    }

    private static async Task<IResult> DeleteSponsored(
        string sponsoredId,
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
        var actor = ActorId(user);
        if (string.IsNullOrWhiteSpace(actor))
            return Results.Unauthorized();

        sponsoredId = sponsoredId.Trim();
        var row = await db.StorefrontSponsoredProducts
            .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Id == sponsoredId, ct);
        if (row is null)
            return Results.NotFound();

        db.StorefrontSponsoredProducts.Remove(row);
        await db.SaveChangesAsync(ct);

        await audit.RecordAsync(
            AuditActions.StorefrontSponsorMutate,
            "success",
            tenantId,
            actor,
            "storefront_sponsored_product",
            sponsoredId,
            new { op = "delete" },
            request.HttpContext,
            ct);

        return Results.NoContent();
    }

    public sealed record StorefrontSponsoredProductPublicDto(
        string Id,
        string ProductId,
        string Slug,
        string TitleDisplay,
        string? HeroStorageKey,
        long? MinPriceMinor,
        string? Currency,
        string? Label,
        int SortOrder);

    public sealed record StorefrontSponsoredProductAdminDto(
        string Id,
        string ProductId,
        string Slug,
        string TitleDisplay,
        string Status,
        string? Label,
        int SortOrder,
        bool IsActive);

    public sealed class CreateStorefrontSponsoredRequest
    {
        public string? ProductId { get; set; }
        public string? Label { get; set; }
        public int SortOrder { get; set; }
        public bool? IsActive { get; set; }
    }

    public sealed class UpdateStorefrontSponsoredRequest
    {
        public string? Label { get; set; }
        public int? SortOrder { get; set; }
        public bool? IsActive { get; set; }
    }
}
