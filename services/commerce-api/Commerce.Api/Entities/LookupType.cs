namespace Commerce.Api.Entities;

/// <summary>
/// Tenant-scoped configurable lookup dimension (e.g. regions, cities, payment_methods).
/// Parent–child between <em>types</em>: <see cref="ParentLookupTypeId"/> references another row's <see cref="Id"/> in the same tenant.
/// </summary>
public sealed class LookupType
{
    public required string TenantId { get; set; }
    /// <summary>Stable type key (matches storefront JSON <c>id</c>).</summary>
    public required string Id { get; set; }
    public required string Title { get; set; }
    public string? Description { get; set; }
    /// <summary>When set, <see cref="LookupValue"/> rows of this type use <see cref="LookupValue.ParentValueId"/> pointing at a value whose type is this id.</summary>
    public string? ParentLookupTypeId { get; set; }
    public string? ParentFieldLabel { get; set; }
    public required string EntryIdPrefix { get; set; }
}
