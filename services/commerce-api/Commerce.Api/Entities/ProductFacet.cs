namespace Commerce.Api.Entities;

/// <summary>Denormalized facet row per product (union of SKU attributes) for PLP filters.</summary>
public sealed class ProductFacet
{
    public required string ProductId { get; set; }
    public required string AttributeDefId { get; set; }
    public required string AttributeValueId { get; set; }

    public Product? Product { get; set; }
}
