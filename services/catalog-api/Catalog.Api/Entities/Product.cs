namespace Catalog.Api.Entities;

/// <summary>PLP/PDP list row. TitleDisplay is denormalized for search and cards; resolve L10n in a fuller model later.</summary>
public sealed class Product
{
    public required string Id { get; set; }
    public required string TenantId { get; set; }
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
