using Microsoft.Extensions.Options;

namespace WebkitFx.Platform.Media;

public sealed class LocalMediaStorageOptions
{
    /// <summary>Root directory for uploaded blobs (absolute or app-relative).</summary>
    public string RootPath { get; set; } = "uploads/media";

    /// <summary>URL path prefix for static file middleware (e.g. /media).</summary>
    public string PublicPathPrefix { get; set; } = "/media";
}

public sealed class LocalMediaStorage(IOptions<LocalMediaStorageOptions> options) : IMediaStorage
{
    private readonly LocalMediaStorageOptions _opt = options.Value;

    public async Task<StoredMediaObject> SaveAsync(
        string tenantId,
        string suggestedFileName,
        string? contentType,
        Stream stream,
        CancellationToken cancellationToken = default)
    {
        var root = Path.GetFullPath(_opt.RootPath);
        Directory.CreateDirectory(root);

        var safeName = Path.GetFileName(suggestedFileName);
        if (string.IsNullOrEmpty(safeName))
            safeName = "file.bin";

        var id = Guid.NewGuid().ToString("N");
        var ext = Path.GetExtension(safeName);
        var relativeDir = Path.Combine(tenantId, DateTime.UtcNow.ToString("yyyyMM"));
        var physicalDir = Path.Combine(root, relativeDir);
        Directory.CreateDirectory(physicalDir);

        var storedFileName = $"{id}{ext}";
        var physicalPath = Path.Combine(physicalDir, storedFileName);
        await using (var fs = File.Create(physicalPath))
        {
            await stream.CopyToAsync(fs, cancellationToken);
        }

        var info = new FileInfo(physicalPath);
        var key = string.Join('/', relativeDir.Replace('\\', '/'), storedFileName);
        return new StoredMediaObject(key, info.Length, contentType);
    }

    public Task<Stream?> OpenReadAsync(string storageKey, CancellationToken cancellationToken = default)
    {
        var root = Path.GetFullPath(_opt.RootPath);
        var full = Path.GetFullPath(Path.Combine(root, storageKey));
        if (!full.StartsWith(root, StringComparison.OrdinalIgnoreCase) || !File.Exists(full))
            return Task.FromResult<Stream?>(null);

        return Task.FromResult<Stream?>(File.OpenRead(full));
    }
}
