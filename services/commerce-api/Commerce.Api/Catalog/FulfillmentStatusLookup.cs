using Commerce.Api.Data;
using Commerce.Api.Entities;
using Commerce.Api.Orders;
using Microsoft.EntityFrameworkCore;

namespace Commerce.Api.Catalog;

public sealed record FulfillmentStatusLookupRow(string Code, string Label, int SortOrder);

/// <summary>
/// Resolves <c>order_fulfillment_status</c> from tenant lookups (shopper timeline + vendor-assignable subset).
/// </summary>
public static class FulfillmentStatusLookup
{
    public const string LookupTypeId = "order_fulfillment_status";

    /// <summary>Café dine-in / QR / aggregator kitchen statuses.</summary>
    public const string CafeOrderStatusLookupTypeId = "cafe_order_status";

    /// <summary>Alias for <see cref="LookupTypeId"/> (timeline progression).</summary>
    public const string AdminLookupTypeId = LookupTypeId;

    /// <summary>Legacy duplicate lookup type — removed; values live under <see cref="LookupTypeId"/>.</summary>
    [Obsolete("Merged into order_fulfillment_status.")]
    public const string VendorLookupTypeId = "order_fulfillment_status_vendor";

    public static readonly string[] VendorAssignableCodes =
    [
        StorefrontOrderFulfillment.InReview,
        StorefrontOrderFulfillment.Confirmed,
        StorefrontOrderFulfillment.Packed,
        StorefrontOrderFulfillment.Shipped,
        StorefrontOrderFulfillment.Cancelled,
        StorefrontOrderFulfillment.Rejected,
    ];

    public static async Task<IReadOnlyList<FulfillmentStatusLookupRow>> LoadAsync(
        CommerceDbContext db,
        string tenantId,
        string lookupTypeId,
        CancellationToken ct = default)
    {
        var rows = await db.LookupValues.AsNoTracking()
            .Where(v => v.TenantId == tenantId && v.LookupTypeId == lookupTypeId)
            .OrderBy(v => v.SortOrder)
            .ThenBy(v => v.Code)
            .Select(v => new FulfillmentStatusLookupRow(
                v.Code.Trim().ToLowerInvariant(),
                v.Label,
                v.SortOrder))
            .ToListAsync(ct);

        return rows.Count > 0 ? rows : DefaultRows();
    }

    public static async Task<IReadOnlyList<FulfillmentStatusLookupRow>> LoadVendorAssignableAsync(
        CommerceDbContext db,
        string tenantId,
        CancellationToken ct = default)
    {
        var all = await LoadAsync(db, tenantId, LookupTypeId, ct);
        var allowed = new HashSet<string>(VendorAssignableCodes, StringComparer.Ordinal);
        var filtered = all.Where(r => allowed.Contains(r.Code)).ToList();
        return filtered.Count > 0 ? filtered : DefaultVendorAssignableRows();
    }

    public static bool IsAllowedCode(IReadOnlyList<FulfillmentStatusLookupRow> rows, string? code)
    {
        if (string.IsNullOrWhiteSpace(code)) return false;
        var norm = StorefrontOrderFulfillment.Normalize(code);
        return rows.Any(r => r.Code == norm);
    }

    public static IReadOnlyList<object> BuildTimeline(
        IReadOnlyList<FulfillmentStatusLookupRow> progressionRows,
        string currentCode)
    {
        var current = StorefrontOrderFulfillment.Normalize(currentCode);
        if (current is StorefrontOrderFulfillment.Cancelled or StorefrontOrderFulfillment.Rejected)
        {
            var placed = progressionRows.FirstOrDefault(r => r.Code == StorefrontOrderFulfillment.Placed);
            var terminal = progressionRows.FirstOrDefault(r => r.Code == current);
            var terminalLabel = terminal?.Label ?? (current == StorefrontOrderFulfillment.Cancelled ? "Cancelled" : "Rejected");
            return
            [
                new { id = StorefrontOrderFulfillment.Placed, label = placed?.Label ?? "Order placed", done = true, current = false },
                new { id = current, label = terminalLabel, done = true, current = true },
            ];
        }

        var progression = progressionRows
            .Where(r => r.Code is not StorefrontOrderFulfillment.Cancelled and not StorefrontOrderFulfillment.Rejected)
            .OrderBy(r => r.SortOrder)
            .ToList();

        var idx = progression.FindIndex(r => r.Code == current);
        if (idx < 0) idx = 0;

        return progression.Select((step, i) => new
        {
            id = step.Code,
            label = step.Label,
            done = i <= idx,
            current = i == idx,
        }).Cast<object>().ToList();
    }

    public static IReadOnlyList<FulfillmentStatusLookupRow> DefaultRows() =>
    [
        new(StorefrontOrderFulfillment.Placed, "Placed", 10),
        new(StorefrontOrderFulfillment.InReview, "In review", 15),
        new(StorefrontOrderFulfillment.Confirmed, "Confirmed", 20),
        new(StorefrontOrderFulfillment.Packed, "Packed", 30),
        new(StorefrontOrderFulfillment.Shipped, "Shipped", 40),
        new(StorefrontOrderFulfillment.Delivered, "Delivered", 50),
        new(StorefrontOrderFulfillment.Cancelled, "Cancelled", 90),
        new(StorefrontOrderFulfillment.Rejected, "Rejected", 95),
    ];

    public static IReadOnlyList<FulfillmentStatusLookupRow> DefaultVendorAssignableRows() =>
        DefaultRows().Where(r => VendorAssignableCodes.Contains(r.Code)).ToList();

    public static async Task<bool> IsCafeVerticalOrderAsync(
        CommerceDbContext db,
        string tenantId,
        string productTypeId,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(productTypeId)) return false;
        var matchIds = await CatalogApplicationVertical.ResolveProductTypeIdsForCatalogFilterAsync(
            db, tenantId, "app_cafe", ct);
        return matchIds.Contains(productTypeId.Trim());
    }

    public static async Task<IReadOnlyList<FulfillmentStatusLookupRow>> LoadCafeVendorAssignableAsync(
        CommerceDbContext db,
        string tenantId,
        CancellationToken ct = default)
    {
        var rows = await LoadAsync(db, tenantId, CafeOrderStatusLookupTypeId, ct);
        var allowed = CafeOrderWorkflow.VendorAssignableRows().Select(r => r.Code).ToHashSet(StringComparer.Ordinal);
        var filtered = rows.Where(r => allowed.Contains(r.Code)).ToList();
        return filtered.Count > 0 ? filtered : CafeOrderWorkflow.VendorAssignableRows();
    }

    public static async Task<IReadOnlyList<FulfillmentStatusLookupRow>> LoadProgressionForOrderAsync(
        CommerceDbContext db,
        string tenantId,
        StorefrontOrder order,
        CancellationToken ct = default)
    {
        if (!await IsCafeVerticalOrderAsync(db, tenantId, order.ProductTypeId, ct))
            return await LoadAsync(db, tenantId, AdminLookupTypeId, ct);

        var channel = CafeOrderWorkflow.NormalizeChannel(order.OrderChannel);
        var fromDb = await LoadAsync(db, tenantId, CafeOrderStatusLookupTypeId, ct);
        var channelSteps = CafeOrderWorkflow.StepsForChannel(channel);
        if (fromDb.Count == 0)
            return channelSteps;

        var stepCodes = channelSteps.Select(s => s.Code).ToHashSet(StringComparer.Ordinal);
        var progression = fromDb.Where(r => stepCodes.Contains(r.Code)).OrderBy(r => r.SortOrder).ToList();
        return progression.Count > 0 ? progression : channelSteps;
    }

    public static async Task<IReadOnlyList<FulfillmentStatusLookupRow>> LoadVendorAssignableForOrderAsync(
        CommerceDbContext db,
        string tenantId,
        StorefrontOrder order,
        CancellationToken ct = default)
    {
        if (!await IsCafeVerticalOrderAsync(db, tenantId, order.ProductTypeId, ct))
            return await LoadVendorAssignableAsync(db, tenantId, ct);

        return await LoadCafeVendorAssignableAsync(db, tenantId, ct);
    }
}
