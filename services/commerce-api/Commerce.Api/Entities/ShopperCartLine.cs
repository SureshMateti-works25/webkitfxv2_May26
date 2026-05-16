namespace Commerce.Api.Entities;

public sealed class ShopperCartLine
{
    public required string Id { get; set; }
    public required string CartId { get; set; }
    public ShopperCart? Cart { get; set; }
    public required string ProductId { get; set; }
    public string? SkuId { get; set; }
    public int Quantity { get; set; }
    public long? UnitPriceMinor { get; set; }
    public string? Currency { get; set; }
    public string? PackLabel { get; set; }
    public string? PackUnitType { get; set; }
    public decimal? PackQuantity { get; set; }
    public decimal? UnitsPerPack { get; set; }
}
