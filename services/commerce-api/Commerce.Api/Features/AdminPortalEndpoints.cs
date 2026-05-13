using System.Security.Claims;
using Commerce.Api.Audit;
using Commerce.Api.Data;
using Commerce.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using WebkitFx.Platform.Tenancy;

namespace Commerce.Api.Features;

/// <summary>Site administration: directory of portal accounts (vendors, shoppers, admins).</summary>
public static class AdminPortalEndpoints
{
    public static void MapAdminPortalV1(this WebApplication app)
    {
        const string tag = "admin";
        app.MapGet("/api/v1/admin/portal-users", ListPortalUsers)
            .RequireAuthorization("Admin")
            .WithTags(tag)
            .WithName("AdminListPortalUsers");

        app.MapPatch("/api/v1/admin/portal-users/{userId}", PatchPortalUser)
            .RequireAuthorization("Admin")
            .WithTags(tag)
            .WithName("AdminPatchPortalUser");
    }

    private static string? ActorId(ClaimsPrincipal user) =>
        user.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? user.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);

    private static async Task<IResult> ListPortalUsers(
        string? role,
        HttpRequest request,
        ClaimsPrincipal user,
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(request.HttpContext, tenantContext, audit, ct);
        if (tenantFail is not null)
            return tenantFail;
        var tenantId = request.ResolveTenantId(tenantContext)!;
        if (string.IsNullOrWhiteSpace(ActorId(user)))
            return Results.Unauthorized();

        var filter = role?.Trim().ToLowerInvariant();
        if (filter is { Length: > 0 } && filter is not ("shopper" or "vendor" or "admin"))
            return Results.BadRequest(new { error = "invalid_role_filter", allowed = new[] { "shopper", "vendor", "admin" } });

        var q = db.PortalUsers.AsNoTracking().Where(u => u.TenantId == tenantId);
        if (!string.IsNullOrEmpty(filter))
            q = q.Where(u => u.Role == filter);

        var rows = await q
            .OrderBy(u => u.Role)
            .ThenBy(u => u.Email)
            .Select(u => new PortalUserDirectoryRow(u.Id, u.Email, u.Role, u.CreatedAt, u.LoginDisabled))
            .ToListAsync(ct);

        return Results.Ok(rows);
    }

    private static async Task<IResult> PatchPortalUser(
        string userId,
        PatchPortalUserRequest body,
        HttpRequest request,
        ClaimsPrincipal user,
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(request.HttpContext, tenantContext, audit, ct);
        if (tenantFail is not null)
            return tenantFail;
        var tenantId = request.ResolveTenantId(tenantContext)!;
        var actor = ActorId(user);
        if (string.IsNullOrWhiteSpace(actor))
            return Results.Unauthorized();

        if (body.LoginDisabled is null)
            return Results.BadRequest(new { error = "loginDisabled_required" });

        userId = userId.Trim();
        if (userId.Length is < 1 or > 64)
            return Results.BadRequest(new { error = "invalid_user_id" });

        if (string.Equals(userId, actor, StringComparison.Ordinal))
            return Results.BadRequest(new { error = "cannot_change_own_login_flag" });

        var row = await db.PortalUsers.FirstOrDefaultAsync(u => u.TenantId == tenantId && u.Id == userId, ct);
        if (row is null)
            return Results.NotFound();

        var previous = row.LoginDisabled;
        row.LoginDisabled = body.LoginDisabled.Value;
        await db.SaveChangesAsync(ct);

        await audit.RecordAsync(
            AuditActions.PortalUserMutate,
            "success",
            tenantId,
            actor,
            "portal_user",
            row.Id,
            new { op = "login_disabled", previous, next = row.LoginDisabled },
            request.HttpContext,
            ct);

        return Results.Ok(new PortalUserDirectoryRow(row.Id, row.Email, row.Role, row.CreatedAt, row.LoginDisabled));
    }

    private sealed record PortalUserDirectoryRow(string Id, string Email, string Role, DateTimeOffset CreatedAt, bool LoginDisabled);

    public sealed class PatchPortalUserRequest
    {
        public bool? LoginDisabled { get; set; }
    }
}
