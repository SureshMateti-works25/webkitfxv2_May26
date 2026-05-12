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
    string? ParentValueId);

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
    string? ParentValueId);
