namespace Commerce.Api.Entities;

public sealed class ProductComment
{
    public required string Id { get; set; }
    public required string TenantId { get; set; }
    public required string ProductId { get; set; }
    public required string CommentText { get; set; }
    public string? AuthorName { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
