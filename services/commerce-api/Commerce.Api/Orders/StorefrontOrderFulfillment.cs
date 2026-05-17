namespace Commerce.Api.Orders;

public static class StorefrontOrderFulfillment
{
    public const string Placed = "placed";
    public const string InReview = "inreview";
    public const string Confirmed = "confirmed";
    public const string Packed = "packed";
    public const string Shipped = "shipped";
    public const string Delivered = "delivered";
    public const string Cancelled = "cancelled";
    public const string Rejected = "rejected";

    public static readonly string[] Progression =
        [Placed, InReview, Confirmed, Packed, Shipped, Delivered];

    public static readonly string[] AllStatuses =
        [Placed, InReview, Confirmed, Packed, Shipped, Delivered, Cancelled, Rejected];

    public static bool IsValid(string? status)
    {
        if (string.IsNullOrWhiteSpace(status)) return false;
        var s = status.Trim().ToLowerInvariant();
        return Array.Exists(AllStatuses, x => x == s);
    }

    public static string Normalize(string status) => status.Trim().ToLowerInvariant();

    public static int IndexOf(string status)
    {
        var s = Normalize(status);
        return Array.IndexOf(Progression, s);
    }
}
