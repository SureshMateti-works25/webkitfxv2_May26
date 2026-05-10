namespace Catalog.Api.Entities;

public sealed class Sku
{
    public required string Id { get; set; }
    public required string TenantId { get; set; }
    public required string ProductId { get; set; }
    public required string SkuCode { get; set; }
    public string? Barcode { get; set; }
    public required string Status { get; set; }

    public Product? Product { get; set; }
}
