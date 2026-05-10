using Catalog.Api.Data;
using Microsoft.EntityFrameworkCore;
using WebkitFx.Platform.Tenancy;

namespace Catalog.Api.Features;

public static class LocationInventoryEndpoints
{
    public static void MapLocationsAndInventoryV1(this WebApplication app)
    {
        app.MapGet("/api/v1/locations", ListLocations).WithName("ListLocations");
        app.MapGet("/api/v1/inventory/positions", ListInventoryPositions).WithName("ListInventoryPositions");
        app.MapGet("/api/v1/skus/{skuId}/inventory", ListInventoryForSku).WithName("ListInventoryForSku");
    }

    private static async Task<IResult> ListLocations(
        HttpRequest request,
        ITenantContext tenantContext,
        CatalogDbContext db,
        CancellationToken ct)
    {
        var tenantFail = TenantResolutionExtensions.RequireTenant(request.ResolveTenantId(tenantContext));
        if (tenantFail is not null)
            return tenantFail;

        var tenantId = request.ResolveTenantId(tenantContext)!;
        var rows = await db.Locations.AsNoTracking()
            .Where(l => l.TenantId == tenantId)
            .OrderBy(l => l.Code)
            .Select(l => new { l.Id, l.Code, l.Name, l.Type })
            .ToListAsync(ct);
        return Results.Ok(rows);
    }

    private static async Task<IResult> ListInventoryPositions(
        HttpRequest request,
        ITenantContext tenantContext,
        CatalogDbContext db,
        CancellationToken ct)
    {
        var tenantFail = TenantResolutionExtensions.RequireTenant(request.ResolveTenantId(tenantContext));
        if (tenantFail is not null)
            return tenantFail;

        var tenantId = request.ResolveTenantId(tenantContext)!;
        var skuId = request.Query["skuId"].ToString();
        var locationId = request.Query["locationId"].ToString();

        var q = from ip in db.InventoryPositions.AsNoTracking()
            join s in db.Skus.AsNoTracking() on ip.SkuId equals s.Id
            join l in db.Locations.AsNoTracking() on ip.LocationId equals l.Id
            where s.TenantId == tenantId
            select new { ip, s, l };

        if (!string.IsNullOrEmpty(skuId))
            q = q.Where(x => x.ip.SkuId == skuId);
        if (!string.IsNullOrEmpty(locationId))
            q = q.Where(x => x.ip.LocationId == locationId);

        var rows = await q
            .OrderBy(x => x.l.Code).ThenBy(x => x.s.SkuCode)
            .Select(x => new
            {
                x.ip.Id,
                x.ip.SkuId,
                SkuCode = x.s.SkuCode,
                x.ip.LocationId,
                LocationCode = x.l.Code,
                x.ip.OnHand,
                x.ip.Reserved,
                Atp = x.ip.OnHand - x.ip.Reserved,
                x.ip.UpdatedAt
            })
            .ToListAsync(ct);

        return Results.Ok(rows);
    }

    private static async Task<IResult> ListInventoryForSku(
        string skuId,
        HttpRequest request,
        ITenantContext tenantContext,
        CatalogDbContext db,
        CancellationToken ct)
    {
        var tenantFail = TenantResolutionExtensions.RequireTenant(request.ResolveTenantId(tenantContext));
        if (tenantFail is not null)
            return tenantFail;

        var tenantId = request.ResolveTenantId(tenantContext)!;
        var exists = await db.Skus.AsNoTracking().AnyAsync(s => s.Id == skuId && s.TenantId == tenantId, ct);
        if (!exists)
            return Results.NotFound();

        var rows = await (
            from ip in db.InventoryPositions.AsNoTracking()
            join l in db.Locations.AsNoTracking() on ip.LocationId equals l.Id
            join s in db.Skus.AsNoTracking() on ip.SkuId equals s.Id
            where ip.SkuId == skuId && s.TenantId == tenantId
            orderby l.Code
            select new
            {
                ip.Id,
                ip.LocationId,
                LocationCode = l.Code,
                ip.OnHand,
                ip.Reserved,
                Atp = ip.OnHand - ip.Reserved,
                ip.UpdatedAt
            }).ToListAsync(ct);

        return Results.Ok(rows);
    }
}
