namespace Catalog.Api.Entities;

public sealed class AttributeDef
{
    public required string Id { get; set; }
    public required string TenantId { get; set; }
    public required string Code { get; set; }
    public required string LabelKey { get; set; }
    public bool Filterable { get; set; }
    public bool Sortable { get; set; }
    public bool Searchable { get; set; }
    public string? DisplayType { get; set; }
    public int? VariantAxisOrder { get; set; }
}
