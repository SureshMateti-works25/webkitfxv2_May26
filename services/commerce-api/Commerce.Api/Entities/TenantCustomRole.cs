namespace Commerce.Api.Entities;

/// <summary>Tenant-defined role with a permission bundle (assignable to portal users in a later phase).</summary>
public sealed class TenantCustomRole
{
    public required string Id { get; set; }
    public required string TenantId { get; set; }
    /// <summary>Stable slug unique per tenant (e.g. floor_manager).</summary>
    public required string RoleKey { get; set; }
    public required string DisplayName { get; set; }
    public string? Description { get; set; }
    /// <summary>JSON array of permission ids.</summary>
    public required string PermissionsJson { get; set; }
    /// <summary>Seeded from app workspace defaults; cannot be deleted by vendors.</summary>
    public bool IsBuiltIn { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public string? CreatedByUserId { get; set; }
}
