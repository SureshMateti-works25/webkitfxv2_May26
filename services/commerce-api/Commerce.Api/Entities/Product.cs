namespace Commerce.Api.Entities;

/// <summary>PLP/PDP list row. TitleDisplay is denormalized for search and cards; resolve L10n in a fuller model later.</summary>
public sealed class Product
{
    public required string Id { get; set; }
    public required string TenantId { get; set; }
    /// <summary>Portal user id when this product was created by a vendor; null for catalogue seed / admin rows.</summary>
    public string? VendorPortalUserId { get; set; }
    /// <summary>Catalog product type id (e.g. pt_saree); drives attribute extensions in the vendor workspace.</summary>
    public string? ProductTypeId { get; set; }
    /// <summary>JSON blob for tax, offers, enquiries/orders stubs, and type-specific fields until fully normalized.</summary>
    public string? CommerceJson { get; set; }
    public required string Slug { get; set; }
    public required string TitleDisplay { get; set; }
    /// <summary>Lowercased concatenation of title + searchable tokens for ILIKE search.</summary>
    public string? SearchText { get; set; }
    public required string Status { get; set; }
    public DateTimeOffset? PublishedAt { get; set; }
    public string? HeroStorageKey { get; set; }
    public long? MinPriceMinor { get; set; }
    public string? Currency { get; set; }
}
