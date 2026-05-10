namespace WebkitFx.Platform.Tenancy;

/// <summary>Scoped tenant for the current HTTP request. Set by <see cref="TenantResolutionMiddleware"/>.</summary>
public interface ITenantContext
{
    /// <summary>Resolved tenant id, or null if the route allows anonymous / cross-tenant ops.</summary>
    string? TenantId { get; }
}
