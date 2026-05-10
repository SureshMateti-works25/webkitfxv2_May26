namespace WebkitFx.Platform.Media;

/// <summary>
/// Object storage abstraction: local disk today; swap for S3 / Azure Blob without changing upload handlers.
/// </summary>
public interface IMediaStorage
{
    /// <param name="tenantId">Namespace prefix for keys.</param>
    /// <param name="suggestedFileName">Original file name (sanitized by implementation).</param>
    /// <param name="contentType">MIME type.</param>
    /// <param name="stream">Readable stream; implementation disposes if needed.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Stable storage key and byte length.</returns>
    Task<StoredMediaObject> SaveAsync(
        string tenantId,
        string suggestedFileName,
        string? contentType,
        Stream stream,
        CancellationToken cancellationToken = default);

    /// <summary>Open a read stream for an existing key, or null if missing.</summary>
    Task<Stream?> OpenReadAsync(string storageKey, CancellationToken cancellationToken = default);
}

public sealed record StoredMediaObject(string StorageKey, long Bytes, string? ContentType);
