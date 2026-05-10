namespace Catalog.Api.Entities;

public sealed class ProductMediaRow
{
    public required string Id { get; set; }
    public required string ProductId { get; set; }
    public required string MediaAssetId { get; set; }
    public required string Role { get; set; }
    public int SortOrder { get; set; }
    public string? Locale { get; set; }

    public Product? Product { get; set; }
    public MediaAsset? MediaAsset { get; set; }
}
