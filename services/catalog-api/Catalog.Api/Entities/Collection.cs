namespace Catalog.Api.Entities;

public sealed class Collection
{
    public required string Id { get; set; }
    public required string TenantId { get; set; }
    public required string Slug { get; set; }
    public required string Title { get; set; }
    public string? Channel { get; set; }
    public DateTimeOffset? ActiveFrom { get; set; }
    public DateTimeOffset? ActiveTo { get; set; }
}
