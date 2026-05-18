using Commerce.Api.Catalog;

namespace Commerce.Api.Orders;

/// <summary>
/// Café dine-in / QR / aggregator status progression (aligned with apps/cafe config/workflows/cafe-order-workflows.json).
/// </summary>
public static class CafeOrderWorkflow
{
    public const string ChannelDineIn = "dine_in";
    public const string ChannelQr = "qr";
    public const string ChannelAggregator = "aggregator";

    public static readonly string[] Channels = [ChannelDineIn, ChannelQr, ChannelAggregator];

    private static readonly FulfillmentStatusLookupRow[] DineInSteps =
    [
        new("customer_seated", "Customer seated", 10),
        new("table_assigned", "Table assigned", 20),
        new("pos_order_created", "POS order created", 30),
        new("payment_pending", "Payment pending", 40),
        new("payment_captured", "Payment captured", 50),
        new("kot_generated", "KOT generated", 100),
        new("kitchen_accepted", "Kitchen accepted", 110),
        new("preparation", "Preparation", 120),
        new("ready_to_serve", "Ready for serving", 130),
        new("served", "Served", 140),
        new("invoice_finalized", "Invoice finalized", 200),
        new("inventory_deducted", "Inventory deducted", 210),
        new("loyalty_credited", "Loyalty points credited", 220),
    ];

    private static readonly FulfillmentStatusLookupRow[] QrSteps =
    [
        new("qr_scanned", "QR scanned", 10),
        new("menu_fetched", "Menu fetched (branch)", 20),
        new("order_placed", "Order placed", 30),
        new("payment_captured", "Online payment", 40),
        new("routed_to_kds", "Routed to KDS", 90),
        new("kot_generated", "KOT generated", 100),
        new("kitchen_accepted", "Kitchen accepted", 110),
        new("preparation", "Preparation", 120),
        new("ready_to_serve", "Ready for serving", 130),
        new("table_delivery", "Table delivery", 140),
        new("invoice_finalized", "Invoice finalized", 200),
    ];

    private static readonly FulfillmentStatusLookupRow[] AggregatorSteps =
    [
        new("webhook_received", "Webhook received", 10),
        new("order_ingested", "Order ingested", 20),
        new("menu_mapping_validated", "Menu mapping validated", 30),
        new("kot_generated", "KOT generated", 100),
        new("preparation", "Preparation", 120),
        new("pickup_ready", "Pickup ready", 130),
        new("rider_assigned", "Rider assigned", 140),
        new("delivered", "Delivered", 150),
    ];

    public static IReadOnlyList<FulfillmentStatusLookupRow> StepsForChannel(string? channel)
    {
        var c = NormalizeChannel(channel);
        return c switch
        {
            ChannelQr => QrSteps,
            ChannelAggregator => AggregatorSteps,
            _ => DineInSteps,
        };
    }

    public static string InitialStatusForChannel(string? channel)
    {
        var c = NormalizeChannel(channel);
        return c switch
        {
            ChannelQr => "order_placed",
            ChannelAggregator => "webhook_received",
            _ => "kot_generated",
        };
    }

    /// <summary>Dine-in and QR table orders; payment captured online at checkout for QR only.</summary>
    public static bool UsesPayAtTableSettlement(string? channel, string? paymentStatus)
    {
        if (NormalizeChannel(channel) != ChannelDineIn) return false;
        var ps = (paymentStatus ?? "").Trim();
        return ps.Length == 0
            || ps.Equals("pending", StringComparison.OrdinalIgnoreCase)
            || ps.Equals("pay_at_table", StringComparison.OrdinalIgnoreCase);
    }

    public static IReadOnlyList<FulfillmentStatusLookupRow> VendorAssignableRows()
    {
        var codes = new HashSet<string>(StringComparer.Ordinal);
        var rows = new List<FulfillmentStatusLookupRow>();
        foreach (var step in DineInSteps.Concat(QrSteps).Concat(AggregatorSteps))
        {
            if (step.SortOrder is < 100 or >= 200) continue;
            if (!codes.Add(step.Code)) continue;
            rows.Add(step);
        }

        rows.Add(new FulfillmentStatusLookupRow("delivered", "Delivered", 150));
        rows.Add(new FulfillmentStatusLookupRow("cancelled", "Cancelled", 900));
        rows.Add(new FulfillmentStatusLookupRow("rejected", "Rejected", 910));
        return rows.OrderBy(r => r.SortOrder).ToList();
    }

    public static IReadOnlyList<FulfillmentStatusLookupRow> AllStatusRows()
    {
        var byCode = new Dictionary<string, FulfillmentStatusLookupRow>(StringComparer.Ordinal);
        foreach (var step in DineInSteps.Concat(QrSteps).Concat(AggregatorSteps))
        {
            if (!byCode.ContainsKey(step.Code))
                byCode[step.Code] = step;
        }

        byCode["cancelled"] = new FulfillmentStatusLookupRow("cancelled", "Cancelled", 900);
        byCode["rejected"] = new FulfillmentStatusLookupRow("rejected", "Rejected", 910);
        return byCode.Values.OrderBy(r => r.SortOrder).ToList();
    }

    public static string NormalizeChannel(string? channel)
    {
        var c = (channel ?? ChannelDineIn).Trim().ToLowerInvariant();
        if (c is ChannelQr or ChannelAggregator) return c;
        return ChannelDineIn;
    }
}
