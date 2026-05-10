using System.Security.Claims;
using Commerce.Api.Audit;
using Commerce.Api.Data;
using Commerce.Api.Entities;
using Commerce.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using WebkitFx.Platform.Media;
using WebkitFx.Platform.Tenancy;

namespace Commerce.Api.Features;

public static class MediaEndpoints
{
    private static string? PortalUserId(ClaimsPrincipal user) =>
        user.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? user.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);

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
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var http = request.HttpContext;
        var tenantFail = await TenantGate.RequireTenantAsync(http, tenantContext, audit, ct);
        if (tenantFail is not null)
            return tenantFail;

        var tenantId = request.ResolveTenantId(tenantContext)!;
        var actorId = AuditLogWriter.ActorFromPrincipal(http.User);

        if (!request.HasFormContentType)
        {
            await audit.RecordAsync(
                AuditActions.MediaUpload,
                "failure",
                tenantId,
                actorId,
                "media_asset",
                null,
                new { reason = "not_multipart" },
                http,
                ct);
            return Results.BadRequest(new { error = "multipart/form-data required" });
        }

        var form = await request.ReadFormAsync(ct);
        var productIdRaw = form["productId"].ToString();
        var roleRaw = form["role"].ToString();
        var skuIdRaw = form["skuId"].ToString();
        string? skuIdNorm = string.IsNullOrWhiteSpace(skuIdRaw) ? null : skuIdRaw.Trim();

        if (skuIdNorm is not null && string.IsNullOrWhiteSpace(productIdRaw))
        {
            await audit.RecordAsync(
                AuditActions.MediaUpload,
                "failure",
                tenantId,
                actorId,
                "media_asset",
                null,
                new { reason = "skuId_requires_productId" },
                http,
                ct);
            return Results.BadRequest(new { error = "productId is required when skuId is set." });
        }

        var file = form.Files.GetFile("file") ?? form.Files.FirstOrDefault();
        if (file is null || file.Length == 0)
        {
            await audit.RecordAsync(
                AuditActions.MediaUpload,
                "failure",
                tenantId,
                actorId,
                "media_asset",
                null,
                new { reason = "missing_file" },
                http,
                ct);
            return Results.BadRequest(new { error = "file field required" });
        }

        string? pid = null;
        Product? trackedProduct = null;
        if (!string.IsNullOrWhiteSpace(productIdRaw))
        {
            pid = productIdRaw.Trim();
            trackedProduct = await db.Products
                .FirstOrDefaultAsync(p => p.Id == pid && p.TenantId == tenantId, ct);
            if (trackedProduct is null)
            {
                await audit.RecordAsync(
                    AuditActions.MediaUpload,
                    "failure",
                    tenantId,
                    actorId,
                    "media_asset",
                    null,
                    new { reason = "unknown_product" },
                    http,
                    ct);
                return Results.NotFound();
            }

            var uid = PortalUserId(http.User);
            if (string.IsNullOrEmpty(uid))
            {
                await audit.RecordAsync(
                    AuditActions.MediaUpload,
                    "failure",
                    tenantId,
                    actorId,
                    "media_asset",
                    null,
                    new { reason = "missing_user_id" },
                    http,
                    ct);
                return Results.Unauthorized();
            }

            if (!http.User.IsInRole("vendor"))
            {
                await audit.RecordAsync(
                    AuditActions.MediaUpload,
                    "failure",
                    tenantId,
                    actorId,
                    "media_asset",
                    null,
                    new { reason = "not_vendor" },
                    http,
                    ct);
                return Results.Json(
                    new { error = "Only vendor accounts can attach images to a product." },
                    statusCode: StatusCodes.Status403Forbidden);
            }

            if (trackedProduct.VendorPortalUserId != uid)
            {
                if (!string.IsNullOrEmpty(trackedProduct.VendorPortalUserId))
                {
                    await audit.RecordAsync(
                        AuditActions.MediaUpload,
                        "failure",
                        tenantId,
                        actorId,
                        "media_asset",
                        null,
                        new { reason = "not_product_owner" },
                        http,
                        ct);
                    return Results.Json(
                        new { error = "You can only add images to products you created (your vendor account)." },
                        statusCode: StatusCodes.Status403Forbidden);
                }

                trackedProduct.VendorPortalUserId = uid;
            }

            if (skuIdNorm is not null)
            {
                var skuOk = await db.Skus.AsNoTracking()
                    .AnyAsync(s => s.Id == skuIdNorm && s.ProductId == pid, ct);
                if (!skuOk)
                {
                    await audit.RecordAsync(
                        AuditActions.MediaUpload,
                        "failure",
                        tenantId,
                        actorId,
                        "media_asset",
                        null,
                        new { reason = "invalid_sku_for_product" },
                        http,
                        ct);
                    return Results.BadRequest(new { error = "skuId does not belong to this product." });
                }
            }
        }

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

        if (pid is not null)
        {
            var r = string.IsNullOrWhiteSpace(roleRaw) ? "gallery" : roleRaw.Trim();
            if (r.Length > 64)
                r = r[..64];

            db.ProductMedia.Add(new ProductMediaRow
            {
                Id = $"pm_{Guid.NewGuid().ToString("N")[..12]}",
                ProductId = pid,
                SkuId = skuIdNorm,
                MediaAssetId = entity.Id,
                Role = r,
                SortOrder = await db.ProductMedia.CountAsync(x => x.ProductId == pid, ct),
                Locale = null
            });
        }

        await db.SaveChangesAsync(ct);

        await audit.RecordAsync(
            AuditActions.MediaUpload,
            "success",
            tenantId,
            actorId,
            "media_asset",
            entity.Id,
            new
            {
                entity.Bytes,
                entity.MimeType,
                linkedProductId = string.IsNullOrWhiteSpace(productIdRaw) ? null : productIdRaw.Trim(),
                skuId = skuIdNorm,
                mediaRole = string.IsNullOrWhiteSpace(roleRaw) ? null : roleRaw.Trim()
            },
            http,
            ct);

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
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(request.HttpContext, tenantContext, audit, ct);
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
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(request.HttpContext, tenantContext, audit, ct);
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
                pm.SkuId,
                pm.Role,
                pm.SortOrder,
                pm.Locale,
                Asset = new { ma.Id, ma.StorageKey, ma.MimeType, ma.Bytes, PublicUrl = $"/media/{ma.StorageKey}" }
            }).ToListAsync(ct);

        return Results.Ok(rows);
    }
}
