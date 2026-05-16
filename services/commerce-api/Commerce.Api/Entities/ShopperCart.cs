namespace Commerce.Api.Entities;

public sealed class ShopperCart
{
    public required string Id { get; set; }
    public required string TenantId { get; set; }
    public required string PortalUserId { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public ICollection<ShopperCartLine> Lines { get; set; } = new List<ShopperCartLine>();
}
