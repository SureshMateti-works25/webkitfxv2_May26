namespace Commerce.Api.Entities;

/// <summary>Append-only security / operations audit trail (no secrets or tokens).</summary>
public sealed class AuditLog
{
    public string Id { get; set; } = "";
    public DateTimeOffset OccurredAt { get; set; }
    public string? TenantId { get; set; }
    public string? ActorUserId { get; set; }
    public string Action { get; set; } = "";
    public string? ResourceType { get; set; }
    public string? ResourceId { get; set; }
    public string Outcome { get; set; } = "";
    public string? DetailJson { get; set; }
    public string? ClientIp { get; set; }
    public string? UserAgentSnippet { get; set; }
    public string? RequestId { get; set; }
}
