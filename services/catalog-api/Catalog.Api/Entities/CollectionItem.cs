namespace Catalog.Api.Entities;

public sealed class CollectionItem
{
    public required string CollectionId { get; set; }
    public required string ProductId { get; set; }
    public int SortOrder { get; set; }
    public bool Pinned { get; set; }

    public Collection? Collection { get; set; }
    public Product? Product { get; set; }
}
