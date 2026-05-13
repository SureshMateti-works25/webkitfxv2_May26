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

    /// <summary>
    /// Optional merchandising tree parent for <c>product_categories</c> rows (another <see cref="LookupValue"/> id).
    /// Distinct from <see cref="ParentValueId"/>, which links to the declared parent lookup type (e.g. <c>product_types</c>).
    /// </summary>
    public string? MerchandisingParentId { get; set; }

    public LookupType? LookupType { get; set; }
    public LookupValue? ParentValue { get; set; }
    public LookupValue? MerchandisingParent { get; set; }

    /// <summary>Optional image served from static media (same pattern as <see cref="Product.HeroStorageKey"/>).</summary>
    public string? ImageStorageKey { get; set; }
}
