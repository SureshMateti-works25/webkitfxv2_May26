namespace Commerce.Api.Lookups;

public sealed record LookupTypeResponse(
    string Id,
    string Title,
    string? Description,
    string? ParentLookupTypeId,
    string? ParentFieldLabel,
    string EntryIdPrefix);

public sealed record LookupValueResponse(
    string Id,
    string LookupTypeId,
    string Code,
    string Label,
    int SortOrder,
    string? ParentValueId,
    string? MerchandisingParentId,
    string? ImageStorageKey);

public sealed record LookupBundleResponse(
    string Version,
    IReadOnlyList<LookupTypeResponse> Types,
    IReadOnlyDictionary<string, IReadOnlyList<LookupValueResponse>> ValuesByLookupTypeId);

public sealed record UpsertLookupTypeRequest(
    string Title,
    string? Description,
    string? ParentLookupTypeId,
    string? ParentFieldLabel,
    string EntryIdPrefix);

public sealed record CreateLookupValueRequest(
    string Code,
    string Label,
    int SortOrder,
    string? ParentValueId,
    string? ImageStorageKey);

/// <summary>Replace mutable fields on an existing <c>lookup_values</c> row (e.g. parent product type for a category).</summary>
public sealed record UpdateLookupValueRequest(
    string Code,
    string Label,
    int SortOrder,
    string? ParentValueId,
    string? ImageStorageKey);
