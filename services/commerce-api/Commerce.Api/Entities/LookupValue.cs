namespace Commerce.Api.Entities;

/// <summary>One selectable row within a <see cref="LookupType"/>.</summary>
public sealed class LookupValue
{
    public required string Id { get; set; }
    public required string TenantId { get; set; }
    public required string LookupTypeId { get; set; }
    public required string Code { get; set; }
    public required string Label { get; set; }
    public int SortOrder { get; set; }
    /// <summary>References <see cref="Id"/> of a row in the parent lookup type when the owning type declares <see cref="LookupType.ParentLookupTypeId"/>.</summary>
    public string? ParentValueId { get; set; }

    public LookupType? LookupType { get; set; }
    public LookupValue? ParentValue { get; set; }
}
