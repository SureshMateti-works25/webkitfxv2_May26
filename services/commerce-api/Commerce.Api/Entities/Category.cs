namespace Commerce.Api.Entities;

public sealed class Category
{
    public required string Id { get; set; }
    public required string TenantId { get; set; }
    public string? ParentId { get; set; }
    public required string Slug { get; set; }
    public int SortOrder { get; set; }
}
