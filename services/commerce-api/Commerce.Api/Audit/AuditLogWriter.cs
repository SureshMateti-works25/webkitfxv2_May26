using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Serialization;
using Commerce.Api.Data;
using Commerce.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Commerce.Api.Audit;

/// <summary>Persists audit rows in a separate scope so failures in the main unit of work do not block auditing.</summary>
public sealed class AuditLogWriter(IServiceScopeFactory scopeFactory, ILogger<AuditLogWriter> logger)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public Task RecordAsync(
        string action,
        string outcome,
        string? tenantId,
        string? actorUserId,
        string? resourceType,
        string? resourceId,
        object? detail,
        HttpContext? http,
        CancellationToken ct)
        => RecordCoreAsync(action, outcome, tenantId, actorUserId, resourceType, resourceId, detail, http, ct);

    public static string? ActorFromPrincipal(ClaimsPrincipal? user)
    {
        if (user?.Identity?.IsAuthenticated != true)
            return null;
        return user.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? user.FindFirst("sub")?.Value;
    }

    private async Task RecordCoreAsync(
        string action,
        string outcome,
        string? tenantId,
        string? actorUserId,
        string? resourceType,
        string? resourceId,
        object? detail,
        HttpContext? http,
        CancellationToken ct)
    {
        try
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<CommerceDbContext>();

            string? detailJson = detail is null ? null : JsonSerializer.Serialize(detail, JsonOptions);
            if (detailJson is { Length: > 8000 })
                detailJson = detailJson[..8000];

            var row = new AuditLog
            {
                Id = "al_" + Guid.NewGuid().ToString("N")[..12],
                OccurredAt = DateTimeOffset.UtcNow,
                TenantId = Truncate(tenantId, 64),
                ActorUserId = Truncate(actorUserId, 64),
                Action = Truncate(action, 64) ?? action,
                ResourceType = Truncate(resourceType, 64),
                ResourceId = Truncate(resourceId, 128),
                Outcome = Truncate(outcome, 32) ?? outcome,
                DetailJson = detailJson,
                ClientIp = Truncate(ExtractClientIp(http), 45),
                UserAgentSnippet = Truncate(http?.Request.Headers.UserAgent.ToString(), 256),
                RequestId = Truncate(http?.TraceIdentifier, 64)
            };

            db.AuditLogs.Add(row);
            await db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to persist audit event {Action}", action);
        }
    }

    private static string? Truncate(string? s, int max)
    {
        if (string.IsNullOrEmpty(s))
            return s;
        return s.Length <= max ? s : s[..max];
    }

    private static string? ExtractClientIp(HttpContext? http)
    {
        if (http is null)
            return null;
        var fwd = http.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(fwd))
            return fwd.Split(',')[0].Trim();
        return http.Connection.RemoteIpAddress?.ToString();
    }
}
