namespace Commerce.Api.Catalog;

public sealed record ProductImageIndicatorDto(string Kind, string? Label, string Placement);

public sealed record ProductGalleryImageDto(string StorageKey, string Role, int SortOrder);

public sealed record ProductCardDto(
    string Id,
    string Slug,
    string TitleDisplay,
    string? HeroStorageKey,
    long? MinPriceMinor,
    string? Currency,
    DateTimeOffset? PublishedAt,
    long? ListPriceMinor,
    string? OfferType,
    string? OfferCardText,
    long? OfferPriceMinor,
    IReadOnlyList<ProductImageIndicatorDto> ImageIndicators);

public sealed record ProductDetailDto(
    string Id,
    string Slug,
    string TitleDisplay,
    string? HeroStorageKey,
    long? MinPriceMinor,
    string? Currency,
    DateTimeOffset? PublishedAt,
    long? ListPriceMinor,
    string? OfferType,
    string? OfferCardText,
    long? OfferPriceMinor,
    IReadOnlyList<ProductImageIndicatorDto> ImageIndicators,
    IReadOnlyList<ProductGalleryImageDto> Gallery);

public sealed record PagedProductsResponse(
    string View,
    int Page,
    int PageSize,
    int TotalCount,
    IReadOnlyList<ProductCardDto> Items);

public sealed record FacetValueOptionDto(
    string Id,
    string Code,
    string LabelKey,
    int SortKey,
    string? SwatchHex,
    int ProductCount);

public sealed record FacetGroupDto(
    string AttributeDefId,
    string Code,
    string LabelKey,
    string? DisplayType,
    IReadOnlyList<FacetValueOptionDto> Values);

public sealed record FacetOptionsResponse(IReadOnlyList<FacetGroupDto> Facets);
