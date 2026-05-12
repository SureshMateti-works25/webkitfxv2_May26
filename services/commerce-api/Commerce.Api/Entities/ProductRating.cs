namespace Commerce.Api.Entities;

public sealed class ProductRating
{
    public required string Id { get; set; }
    public required string TenantId { get; set; }
    public required string ProductId { get; set; }
    public int Score { get; set; }
    public string? AuthorName { get; set; }
    public string? CommentText { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
