namespace WebkitFx.Platform.Web;

/// <summary>Standard cursor-agnostic page envelope for list endpoints.</summary>
public sealed record PagedResult<T>(
    int Page,
    int PageSize,
    int TotalCount,
    IReadOnlyList<T> Items);

public static class PageRequest
{
    public const int DefaultPageSize = 24;
    public const int MaxPageSize = 100;

    public static (int Page, int PageSize) Normalize(int? page, int? pageSize)
    {
        var p = page is >= 1 ? page.Value : 1;
        var s = pageSize is >= 1 ? pageSize.Value : DefaultPageSize;
        s = Math.Min(s, MaxPageSize);
        return (p, s);
    }
}
