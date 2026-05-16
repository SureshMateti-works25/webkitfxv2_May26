namespace Commerce.Api.Entities;

public sealed class ShopperProductView
{
    public required string TenantId { get; set; }
    public required string PortalUserId { get; set; }
    public required string ProductId { get; set; }
    public DateTimeOffset ViewedAt { get; set; }
}
