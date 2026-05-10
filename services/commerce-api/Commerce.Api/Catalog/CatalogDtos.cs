namespace Commerce.Api.Catalog;

public sealed record ProductCardDto(
    string Id,
    string Slug,
    string TitleDisplay,
    string? HeroStorageKey,
    long? MinPriceMinor,
    string? Currency,
    DateTimeOffset? PublishedAt);

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
