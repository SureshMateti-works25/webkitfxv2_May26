namespace Commerce.Api.Entities;

public sealed class InventoryPosition
{
    public required string Id { get; set; }
    public required string SkuId { get; set; }
    public required string LocationId { get; set; }
    public int OnHand { get; set; }
    public int Reserved { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public Sku? Sku { get; set; }
    public Location? Location { get; set; }
}
