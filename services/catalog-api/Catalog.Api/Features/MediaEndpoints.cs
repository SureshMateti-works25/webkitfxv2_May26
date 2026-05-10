using Catalog.Api.Data;
using Catalog.Api.Entities;
using Microsoft.EntityFrameworkCore;
using WebkitFx.Platform.Media;
using WebkitFx.Platform.Tenancy;

namespace Catalog.Api.Features;

public static class MediaEndpoints
{
    public static void MapMediaV1(this WebApplication app)
    {
        app.MapPost("/api/v1/media/assets", UploadAsset)
            .RequireAuthorization()
            .WithName("MediaUploadAsset");

        app.MapGet("/api/v1/media/assets", ListAssets)
            .WithName("MediaListAssets");

        app.MapGet("/api/v1/products/{productId}/media", ListProductMedia)
            .WithName("MediaListByProduct");
    }

    private static async Task<IResult> UploadAsset(
        HttpRequest request,
        ITenantContext tenantContext,
        IMediaStorage storage,
        CatalogDbContext db,
        CancellationToken ct)
    {
        var tenantFail = TenantResolutionExtensions.RequireTenant(request.ResolveTenantId(tenantContext));
        if (tenantFail is not null)
            return tenantFail;

        var tenantId = request.ResolveTenantId(tenantContext)!;

        if (!request.HasFormContentType)
            return Results.BadRequest(new { error = "multipart/form-data required" });

        var form = await request.ReadFormAsync(ct);
        var file = form.Files.GetFile("file") ?? form.Files.FirstOrDefault();
        if (file is null || file.Length == 0)
            return Results.BadRequest(new { error = "file field required" });

        await using var stream = file.OpenReadStream();
        var stored = await storage.SaveAsync(tenantId, file.FileName, file.ContentType, stream, ct);

        var entity = new MediaAsset
        {
            Id = "m_" + Guid.NewGuid().ToString("N")[..12],
            TenantId = tenantId,
            StorageKey = stored.StorageKey,
            MimeType = stored.ContentType ?? file.ContentType ?? "application/octet-stream",
            Bytes = stored.Bytes,
            Checksum = null,
            UploadedAt = DateTimeOffset.UtcNow
        };
        db.MediaAssets.Add(entity);

        var productId = form["productId"].ToString();
        var role = form["role"].ToString();
        if (!string.IsNullOrWhiteSpace(productId))
        {
            var r = string.IsNullOrWhiteSpace(role) ? "gallery" : role.Trim();
            db.ProductMedia.Add(new ProductMediaRow
            {
                Id = $"pm_{Guid.NewGuid().ToString("N")[..12]}",
                ProductId = productId.Trim(),
                MediaAssetId = entity.Id,
                Role = r,
                SortOrder = await db.ProductMedia.CountAsync(x => x.ProductId == productId.Trim(), ct),
                Locale = null
            });
        }

        await db.SaveChangesAsync(ct);

        return Results.Created($"/api/v1/media/assets?tenantId={Uri.EscapeDataString(tenantId)}", new
        {
            entity.Id,
            entity.StorageKey,
            entity.Bytes,
            entity.MimeType,
            entity.UploadedAt,
            PublicUrl = $"/media/{entity.StorageKey}"
        });
    }

    private static async Task<IResult> ListAssets(
        HttpRequest request,
        ITenantContext tenantContext,
        CatalogDbContext db,
        CancellationToken ct)
    {
        var tenantFail = TenantResolutionExtensions.RequireTenant(request.ResolveTenantId(tenantContext));
        if (tenantFail is not null)
            return tenantFail;

        var tenantId = request.ResolveTenantId(tenantContext)!;
        var list = await db.MediaAssets.AsNoTracking()
            .Where(m => m.TenantId == tenantId)
            .OrderByDescending(m => m.UploadedAt)
            .Select(m => new
            {
                m.Id,
                m.StorageKey,
                m.MimeType,
                m.Bytes,
                m.UploadedAt,
                PublicUrl = $"/media/{m.StorageKey}"
            })
            .ToListAsync(ct);
        return Results.Ok(list);
    }

    private static async Task<IResult> ListProductMedia(
        string productId,
        HttpRequest request,
        ITenantContext tenantContext,
        CatalogDbContext db,
        CancellationToken ct)
    {
        var tenantFail = TenantResolutionExtensions.RequireTenant(request.ResolveTenantId(tenantContext));
        if (tenantFail is not null)
            return tenantFail;

        var tenantId = request.ResolveTenantId(tenantContext)!;
        var ok = await db.Products.AsNoTracking().AnyAsync(p => p.Id == productId && p.TenantId == tenantId, ct);
        if (!ok)
            return Results.NotFound();

        var rows = await (
            from pm in db.ProductMedia.AsNoTracking()
            join ma in db.MediaAssets.AsNoTracking() on pm.MediaAssetId equals ma.Id
            where pm.ProductId == productId && ma.TenantId == tenantId
            orderby pm.SortOrder, pm.Id
            select new
            {
                pm.Id,
                pm.Role,
                pm.SortOrder,
                pm.Locale,
                Asset = new { ma.Id, ma.StorageKey, ma.MimeType, ma.Bytes, PublicUrl = $"/media/{ma.StorageKey}" }
            }).ToListAsync(ct);

        return Results.Ok(rows);
    }
}
