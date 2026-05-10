namespace Commerce.Api.Entities;

public sealed class AttributeValue
{
    public required string Id { get; set; }
    public required string AttributeDefId { get; set; }
    public required string Code { get; set; }
    public required string LabelKey { get; set; }
    public int SortKey { get; set; }
    public string? SwatchHex { get; set; }

    public AttributeDef? AttributeDef { get; set; }
}
