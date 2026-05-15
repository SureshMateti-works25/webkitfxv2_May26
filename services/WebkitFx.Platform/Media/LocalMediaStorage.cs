using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Options;

namespace WebkitFx.Platform.Media;

file static class LocalMediaPathUtil
{
    internal static string? TryResolveStorageFile(string storageKey, params string?[] roots)
    {
        var key = storageKey.Trim().Replace('\\', '/').TrimStart('/');
        if (key.Length == 0 || key.Contains("..", StringComparison.Ordinal))
            return null;

        var keyOs = key.Replace('/', Path.DirectorySeparatorChar);
        foreach (var root in roots)
        {
            if (string.IsNullOrWhiteSpace(root))
                continue;
            var rootFull = Path.GetFullPath(root.Trim());
            var full = Path.GetFullPath(Path.Combine(rootFull, keyOs));
            if (!full.StartsWith(rootFull, StringComparison.OrdinalIgnoreCase) || !File.Exists(full))
                continue;
            return full;
        }

        return null;
    }
}

public sealed class LocalMediaStorageOptions
{
    /// <summary>Root directory for uploaded blobs (absolute, or relative to <see cref="IWebHostEnvironment.ContentRootPath"/>).</summary>
    public string RootPath { get; set; } = "uploads/media";

    /// <summary>URL path prefix for static file middleware (e.g. /media).</summary>
    public string PublicPathPrefix { get; set; } = "/media";
}

public sealed class LocalMediaStorage : IMediaStorage
{
    private readonly LocalMediaStorageOptions _opt;
    private readonly string _root;
    private readonly string? _cwdLegacyRoot;

    /// <summary>
    /// Resolves the on-disk media folder the same way as <c>UseStaticFiles</c>: relative paths are under
    /// <paramref name="contentRootPath"/> (not the process working directory).
    /// </summary>
    public static string ResolveMediaRootPath(string contentRootPath, string? configuredRoot)
    {
        var raw = string.IsNullOrWhiteSpace(configuredRoot) ? "uploads/media" : configuredRoot.Trim();
        if (Path.IsPathRooted(raw))
            return Path.GetFullPath(raw);
        return Path.GetFullPath(Path.Combine(contentRootPath, raw));
    }

    /// <summary>
    /// Finds an on-disk blob for <paramref name="storageKey"/> under any of <paramref name="roots"/> (first match).
    /// Rejects path traversal. Used by HTTP <c>/media</c> middleware and <see cref="OpenReadAsync"/>.
    /// </summary>
    public static string? TryResolveStorageFile(string storageKey, params string?[] roots) =>
        LocalMediaPathUtil.TryResolveStorageFile(storageKey, roots);

    public LocalMediaStorage(IOptions<LocalMediaStorageOptions> options, IWebHostEnvironment webHost)
    {
        _opt = options.Value;
        _root = ResolveMediaRootPath(webHost.ContentRootPath, options.Value.RootPath);
        var raw = options.Value.RootPath ?? "uploads/media";
        if (!Path.IsPathRooted(raw.Trim()))
        {
            var legacy = Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), raw.Trim()));
            _cwdLegacyRoot = string.Equals(legacy, _root, StringComparison.OrdinalIgnoreCase) ? null : legacy;
        }
        else
            _cwdLegacyRoot = null;
    }

    public async Task<StoredMediaObject> SaveAsync(
        string tenantId,
        string suggestedFileName,
        string? contentType,
        Stream stream,
        CancellationToken cancellationToken = default)
    {
        Directory.CreateDirectory(_root);

        var safeName = Path.GetFileName(suggestedFileName);
        if (string.IsNullOrEmpty(safeName))
            safeName = "file.bin";

        var id = Guid.NewGuid().ToString("N");
        var ext = Path.GetExtension(safeName);
        var relativeDir = Path.Combine(tenantId, DateTime.UtcNow.ToString("yyyyMM"));
        var physicalDir = Path.Combine(_root, relativeDir);
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
        var path = TryResolveStorageFile(storageKey, _root, _cwdLegacyRoot);
        if (path is null)
            return Task.FromResult<Stream?>(null);
        return Task.FromResult<Stream?>(File.OpenRead(path));
    }
}
