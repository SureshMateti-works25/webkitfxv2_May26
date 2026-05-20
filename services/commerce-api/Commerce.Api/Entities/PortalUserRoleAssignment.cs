namespace Commerce.Api.Entities;

/// <summary>
/// Assigns a tenant role (system or custom) to a portal user with a portal base role for ASP.NET policies.
/// </summary>
public sealed class PortalUserRoleAssignment
{
    public required string Id { get; set; }
    public required string TenantId { get; set; }
    public required string PortalUserId { get; set; }
    /// <summary>Permission bundle key: shopper, vendor, admin, or custom (e.g. floor_manager).</summary>
    public required string RoleKey { get; set; }
    /// <summary>JWT / RequireRole value: shopper | vendor | admin.</summary>
    public required string PortalBaseRole { get; set; }
    public bool IsPrimary { get; set; }
    /// <summary>JSON scope (location, vendor, sections) — enforced in later phases.</summary>
    public string? ScopeJson { get; set; }
    public DateTimeOffset? ValidFrom { get; set; }
    public DateTimeOffset? ValidTo { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public string? CreatedByUserId { get; set; }
}
