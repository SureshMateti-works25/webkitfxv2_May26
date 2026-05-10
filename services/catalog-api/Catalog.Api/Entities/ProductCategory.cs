namespace Catalog.Api.Entities;

public sealed class ProductCategory
{
    public required string ProductId { get; set; }
    public required string CategoryId { get; set; }
    public bool IsPrimary { get; set; }
    public int SortOrder { get; set; }

    public Product? Product { get; set; }
    public Category? Category { get; set; }
}
