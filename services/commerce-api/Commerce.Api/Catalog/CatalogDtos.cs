namespace Commerce.Api.Catalog;

public sealed record ProductImageIndicatorDto(string Kind, string? Label, string Placement);

/// <param name="SkuId">When set, this image is attached to that SKU (e.g. colour variant); null = product-level.</param>
public sealed record ProductGalleryImageDto(string StorageKey, string Role, int SortOrder, string? SkuId);

/// <summary>One colour / variant option in the PDP matrix: pick SKU → show that SKU’s angle rail.</summary>
public sealed record SkuGalleryFacetDto(string SkuId, string SkuCode, string? SwatchStorageKey);

/// <summary>Active SKU with storefront list/compare prices for pack-size selection on PDP.</summary>
public sealed record StorefrontSkuDto(
    string Id,
    string SkuCode,
    long? ListPriceMinor,
    long? CompareAtPriceMinor);

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
    IReadOnlyList<ProductImageIndicatorDto> ImageIndicators,
    string? VendorCode,
    IReadOnlyList<string> SkuCodes,
    string? ProductTypeId);

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
    /// <summary>All storefront images: product-level rows first, then per-SKU rows (by SKU code, then sort order).</summary>
    IReadOnlyList<ProductGalleryImageDto> Gallery,
    /// <summary>Angled / variant / hero / gallery roles (excludes color swatch rail).</summary>
    IReadOnlyList<ProductGalleryImageDto> AngleImages,
    /// <summary>Color / swatch rail (product-level media with role color|colour|swatch).</summary>
    IReadOnlyList<ProductGalleryImageDto> ColorImages,
    string? VendorCode,
    string? VendorDisplayName,
    string? PrimaryCategorySlug,
    IReadOnlyList<string> SkuCodes,
    IReadOnlyList<SkuGalleryFacetDto> SkuGalleryFacets,
    string? ProductTypeId,
    ProductSpecDto? ProductSpec,
    IReadOnlyList<StorefrontSkuDto> StorefrontSkus);

public sealed record ProductCommentDto(
    string Id,
    string? AuthorName,
    string CommentText,
    DateTimeOffset CreatedAt);

public sealed record ProductEngagementDto(
    long ViewsCount,
    long LikesCount,
    long DislikesCount,
    int RatingsCount,
    decimal AverageRating,
    int CommentsCount,
    IReadOnlyList<ProductCommentDto> RecentComments);

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
