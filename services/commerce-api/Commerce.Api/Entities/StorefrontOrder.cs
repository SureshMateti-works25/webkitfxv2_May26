namespace Commerce.Api.Entities;

public sealed class StorefrontOrder
{
    public required string Id { get; set; }
    public required string TenantId { get; set; }
    public string? ShopperPortalUserId { get; set; }
    public required string ShopperEmail { get; set; }
    public string? ShopperName { get; set; }
    public string? ShopperPhone { get; set; }
    public string? ShippingAddressJson { get; set; }
    public required string ProductTypeId { get; set; }
    public required string Status { get; set; }
    /// <summary>Shopper-facing fulfillment code (lookup-driven: placed, inreview, confirmed, packed, shipped, delivered, cancelled, rejected).</summary>
    public required string FulfillmentStatus { get; set; }
    public string? TrackingNote { get; set; }
    public DateTimeOffset StatusUpdatedAt { get; set; }
    public required string PaymentMethod { get; set; }
    public required string PaymentStatus { get; set; }
    public long TotalMinor { get; set; }
    public required string Currency { get; set; }
    public DateTimeOffset PlacedAt { get; set; }
    public ICollection<StorefrontOrderLine> Lines { get; set; } = new List<StorefrontOrderLine>();
}

public sealed class StorefrontOrderLine
{
    public required string Id { get; set; }
    public required string OrderId { get; set; }
    public required string ProductId { get; set; }
    public string? SkuId { get; set; }
    public string? SkuCode { get; set; }
    public required string TitleDisplay { get; set; }
    public string? VendorPortalUserId { get; set; }
    public string? VendorCode { get; set; }
    public int Quantity { get; set; }
    public long UnitPriceMinor { get; set; }
    public required string Currency { get; set; }
    public StorefrontOrder? Order { get; set; }
}
