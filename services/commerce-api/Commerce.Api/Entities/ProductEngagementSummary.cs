namespace Commerce.Api.Entities;

public sealed class ProductEngagementSummary
{
    public required string TenantId { get; set; }
    public required string ProductId { get; set; }
    public long ViewsCount { get; set; }
    public long LikesCount { get; set; }
    public long DislikesCount { get; set; }
    public long RatingsTotal { get; set; }
    public int RatingsCount { get; set; }
    public int CommentsCount { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
