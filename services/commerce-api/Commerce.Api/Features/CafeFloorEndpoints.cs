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

public static class CafeFloorEndpoints
{
    private const string SectionsLookupTypeId = "cafe_table_sections";
    private const string TablesLookupTypeId = "cafe_tables";

    public static void MapCafeFloorV1(this WebApplication app)
    {
        app.MapGroup("/api/v1/vendor/floor")
            .RequireAuthorization("Vendor")
            .MapGet("", VendorGetFloor)
            .WithName("VendorGetCafeFloor");

        app.MapGroup("/api/v1/admin/floor")
            .RequireAuthorization("Admin")
            .MapGet("", AdminGetFloor)
            .WithName("AdminGetCafeFloor");
    }

    private static string? UserId(ClaimsPrincipal user) =>
        user.FindFirstValue(JwtRegisteredClaimNames.Sub)
        ?? user.FindFirstValue(ClaimTypes.NameIdentifier);

    private static async Task<IResult> VendorGetFloor(
        HttpRequest req,
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var vendorId = UserId(req.HttpContext.User);
        if (string.IsNullOrEmpty(vendorId)) return Results.Unauthorized();
        return await GetFloorAsync(req, tenantContext, db, audit, vendorId, ct);
    }

    private static Task<IResult> AdminGetFloor(
        HttpRequest req,
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct) =>
        GetFloorAsync(req, tenantContext, db, audit, vendorPortalUserId: null, ct);

    private static async Task<IResult> GetFloorAsync(
        HttpRequest req,
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        string? vendorPortalUserId,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(req.HttpContext, tenantContext, audit, ct);
        if (tenantFail is not null) return tenantFail;
        var tenantId = req.ResolveTenantId(tenantContext)!;

        var cafeProductTypeIds = await CatalogApplicationVertical.ResolveProductTypeIdsForCatalogFilterAsync(
            db, tenantId, "app_cafe", ct);

        var sections = await db.LookupValues.AsNoTracking()
            .Where(v => v.TenantId == tenantId && v.LookupTypeId == SectionsLookupTypeId)
            .OrderBy(v => v.SortOrder)
            .ThenBy(v => v.Code)
            .ToListAsync(ct);

        var tables = await db.LookupValues.AsNoTracking()
            .Where(v => v.TenantId == tenantId && v.LookupTypeId == TablesLookupTypeId)
            .OrderBy(v => v.SortOrder)
            .ThenBy(v => v.Code)
            .ToListAsync(ct);

        var ordersQuery = db.StorefrontOrders.AsNoTracking()
            .Include(o => o.Lines)
            .Where(o => o.TenantId == tenantId && o.TableCode != null && o.TableCode != "")
            .Where(o => cafeProductTypeIds.Contains(o.ProductTypeId));

        if (!string.IsNullOrEmpty(vendorPortalUserId))
        {
            ordersQuery = ordersQuery.Where(o =>
                o.Lines.Any(l => l.VendorPortalUserId == vendorPortalUserId));
        }

        var orders = await ordersQuery
            .OrderByDescending(o => o.PlacedAt)
            .Take(500)
            .ToListAsync(ct);

        var activeOrders = orders.Where(CafeTableOccupancy.OccupiesTable).ToList();

        var ordersByTableCode = new Dictionary<string, List<StorefrontOrder>>(StringComparer.Ordinal);
        foreach (var order in activeOrders)
        {
            var key = CafeTableOccupancy.NormalizeTableCode(order.TableCode);
            if (key.Length == 0) continue;
            if (!ordersByTableCode.TryGetValue(key, out var list))
            {
                list = [];
                ordersByTableCode[key] = list;
            }

            list.Add(order);
        }

        var tableCodesInPlan = new HashSet<string>(StringComparer.Ordinal);
        var sectionDtos = new List<object>();

        foreach (var section in sections)
        {
            var sectionTables = tables
                .Where(t => t.ParentValueId == section.Id)
                .ToList();

            List<FloorTableDto> tableDtos = sectionTables.Select(t =>
            {
                var codeKey = CafeTableOccupancy.NormalizeTableCode(t.Code);
                tableCodesInPlan.Add(codeKey);
                var tableOrders = ordersByTableCode.GetValueOrDefault(codeKey) ?? [];
                return ToTableDto(t, tableOrders);
            }).ToList();

            var occupied = tableDtos.Count(t => t.Status == "occupied");
            sectionDtos.Add(new
            {
                id = section.Id,
                code = section.Code,
                label = section.Label,
                sortOrder = section.SortOrder,
                visualKind = ResolveSectionVisualKind(section.Code, section.Label),
                stats = new
                {
                    total = tableDtos.Count,
                    occupied,
                    vacant = tableDtos.Count - occupied,
                },
                tables = tableDtos.Select(t => t.ToResponse()).ToList(),
            });
        }

        var unassignedTables = tables
            .Where(t => string.IsNullOrEmpty(t.ParentValueId)
                        || !sections.Any(s => s.Id == t.ParentValueId))
            .ToList();

        if (unassignedTables.Count > 0)
        {
            List<FloorTableDto> tableDtos = unassignedTables.Select(t =>
            {
                var codeKey = CafeTableOccupancy.NormalizeTableCode(t.Code);
                tableCodesInPlan.Add(codeKey);
                var tableOrders = ordersByTableCode.GetValueOrDefault(codeKey) ?? [];
                return ToTableDto(t, tableOrders);
            }).ToList();

            var occupied = tableDtos.Count(t => t.Status == "occupied");
            sectionDtos.Add(new
            {
                id = "__unassigned__",
                code = "other",
                label = "Other",
                sortOrder = 9999,
                visualKind = "other",
                stats = new
                {
                    total = tableDtos.Count,
                    occupied,
                    vacant = tableDtos.Count - occupied,
                },
                tables = tableDtos.Select(t => t.ToResponse()).ToList(),
            });
        }

        var unmappedOrders = activeOrders
            .Where(o =>
            {
                var key = CafeTableOccupancy.NormalizeTableCode(o.TableCode);
                return key.Length > 0 && !tableCodesInPlan.Contains(key);
            })
            .Select(ToOrderSummary)
            .ToList();

        return Results.Ok(new
        {
            sections = sectionDtos,
            unmappedActiveOrders = unmappedOrders,
            activeOrderCount = activeOrders.Count,
        });
    }

    private static FloorTableDto ToTableDto(LookupValue table, List<StorefrontOrder> tableOrders)
    {
        var active = tableOrders.Select(ToOrderSummary).ToList();
        return new FloorTableDto(
            table.Id,
            table.Code,
            table.Label,
            table.SortOrder,
            table.ParentValueId,
            active.Count > 0 ? "occupied" : "vacant",
            active);
    }

    private sealed record FloorTableDto(
        string Id,
        string Code,
        string Label,
        int Seats,
        string? SectionId,
        string Status,
        IReadOnlyList<object> ActiveOrders)
    {
        public object ToResponse() => new
        {
            id = Id,
            code = Code,
            label = Label,
            seats = Seats,
            sectionId = SectionId,
            status = Status,
            activeOrders = ActiveOrders,
        };
    }

    private static object ToOrderSummary(StorefrontOrder order) => new
    {
        id = order.Id,
        tableCode = order.TableCode,
        orderChannel = order.OrderChannel,
        fulfillmentStatus = order.FulfillmentStatus,
        totalMinor = order.TotalMinor,
        currency = order.Currency,
        placedAt = order.PlacedAt,
        statusUpdatedAt = order.StatusUpdatedAt,
    };

    /// <summary>UI hint for indoor vs outdoor styling (patio, terrace, garden).</summary>
    private static string ResolveSectionVisualKind(string code, string label)
    {
        var text = $"{code} {label}".ToLowerInvariant();
        if (text.Contains("indoor") || text.Contains("inside") || text.Contains("hall"))
            return "indoor";
        if (text.Contains("outdoor") || text.Contains("patio") || text.Contains("terrace")
            || text.Contains("garden") || text.Contains("alfresco") || text.Contains("verandah"))
            return "outdoor";
        if (text.Contains("bar"))
            return "bar";
        return "other";
    }
}
