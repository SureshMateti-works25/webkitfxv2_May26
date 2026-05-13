namespace Commerce.Api.Entities;

public sealed class PortalUser
{
    public required string Id { get; set; }
    public required string TenantId { get; set; }
    /// <summary>Original email for display; unique with TenantId.</summary>
    public required string Email { get; set; }
    public required string NormalizedEmail { get; set; }
    public required string PasswordHash { get; set; }
    /// <summary>shopper | vendor | admin (admin is not self-serve registered; seed or ops only).</summary>
    public required string Role { get; set; }
    public string? ProfileJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    /// <summary>When true, password login is rejected until an admin clears the flag.</summary>
    public bool LoginDisabled { get; set; }
}
