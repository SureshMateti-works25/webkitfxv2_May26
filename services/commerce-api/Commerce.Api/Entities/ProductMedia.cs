namespace Commerce.Api.Entities;

public sealed class ProductMediaRow
{
    public required string Id { get; set; }
    public required string ProductId { get; set; }
    /// <summary>Optional: when set, this image is scoped to a SKU (variant); otherwise product-level.</summary>
    public string? SkuId { get; set; }
    public required string MediaAssetId { get; set; }
    public required string Role { get; set; }
    public int SortOrder { get; set; }
    public string? Locale { get; set; }

    public Product? Product { get; set; }
    public Sku? Sku { get; set; }
    public MediaAsset? MediaAsset { get; set; }
}
