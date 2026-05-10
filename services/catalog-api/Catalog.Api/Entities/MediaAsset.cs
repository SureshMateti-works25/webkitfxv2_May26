namespace Catalog.Api.Entities;

public sealed class MediaAsset
{
    public required string Id { get; set; }
    public required string TenantId { get; set; }
    public required string StorageKey { get; set; }
    public required string MimeType { get; set; }
    public long Bytes { get; set; }
    public string? Checksum { get; set; }
    public DateTimeOffset UploadedAt { get; set; }
}
