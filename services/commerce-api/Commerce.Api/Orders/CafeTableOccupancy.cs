using Commerce.Api.Entities;

namespace Commerce.Api.Orders;

/// <summary>
/// Derives whether a café order still occupies a dining table (for floor-plan views).
/// </summary>
public static class CafeTableOccupancy
{
    private static readonly HashSet<string> FreedStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "cancelled",
        "rejected",
        "invoice_finalized",
        "inventory_deducted",
        "loyalty_credited",
        "delivered",
    };

    public static bool OccupiesTable(StorefrontOrder order)
    {
        if (string.IsNullOrWhiteSpace(order.TableCode)) return false;
        var channel = CafeOrderWorkflow.NormalizeChannel(order.OrderChannel);
        if (channel == CafeOrderWorkflow.ChannelAggregator) return false;
        var status = (order.FulfillmentStatus ?? "").Trim();
        if (status.Length == 0) return true;
        return !FreedStatuses.Contains(status);
    }

    public static string NormalizeTableCode(string? code) =>
        (code ?? "").Trim().ToLowerInvariant();
}
