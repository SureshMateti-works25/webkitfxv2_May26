using Commerce.Api.Data;
using Commerce.Api.Orders;
using Microsoft.EntityFrameworkCore;

namespace Commerce.Api.Catalog;

public sealed record FulfillmentStatusLookupRow(string Code, string Label, int SortOrder);

/// <summary>
/// Resolves <c>order_fulfillment_status</c> (and vendor subset) from tenant lookups.
/// </summary>
public static class FulfillmentStatusLookup
{
    public const string AdminLookupTypeId = "order_fulfillment_status";
    public const string VendorLookupTypeId = "order_fulfillment_status_vendor";

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

        return rows.Count > 0 ? rows : DefaultRows(lookupTypeId);
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

    public static IReadOnlyList<FulfillmentStatusLookupRow> DefaultRows(string lookupTypeId)
    {
        if (string.Equals(lookupTypeId, VendorLookupTypeId, StringComparison.Ordinal))
        {
            return
            [
                new(StorefrontOrderFulfillment.InReview, "In review", 15),
                new(StorefrontOrderFulfillment.Confirmed, "Confirmed", 20),
                new(StorefrontOrderFulfillment.Packed, "Packed", 30),
                new(StorefrontOrderFulfillment.Shipped, "Shipped", 40),
                new(StorefrontOrderFulfillment.Cancelled, "Cancelled", 90),
                new(StorefrontOrderFulfillment.Rejected, "Rejected", 95),
            ];
        }

        return
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
    }
}
