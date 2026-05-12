namespace Commerce.Api.Entities;

/// <summary>Admin-curated sponsored placement linking an active catalogue product into the storefront promo rail.</summary>
public sealed class StorefrontSponsoredProduct
{
    public required string Id { get; set; }
    public required string TenantId { get; set; }
    public required string ProductId { get; set; }
    /// <summary>Optional short label shown on the sponsored card (e.g. “Featured vendor”).</summary>
    public string? Label { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}
