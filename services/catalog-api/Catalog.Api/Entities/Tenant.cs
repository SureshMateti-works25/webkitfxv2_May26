namespace Catalog.Api.Entities;

public sealed class Tenant
{
    public required string Id { get; set; }
    public required string Name { get; set; }
    public required string Slug { get; set; }
}
