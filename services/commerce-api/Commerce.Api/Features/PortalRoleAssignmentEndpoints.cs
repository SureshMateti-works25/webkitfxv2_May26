using System.Security.Claims;
using Commerce.Api.Audit;
using Commerce.Api.Auth;
using Commerce.Api.Data;
using Commerce.Api.Entities;
using Commerce.Api.Infrastructure;
using Commerce.Api.Tenancy;
using Microsoft.EntityFrameworkCore;
using WebkitFx.Platform.Tenancy;

namespace Commerce.Api.Features;

public static class PortalRoleAssignmentEndpoints
{
    public static void MapPortalRoleAssignmentsV1(this WebApplication app)
    {
        const string tag = "portal-role-assignments";
        var g = app.MapGroup("/api/v1/portal-users/{portalUserId}/role-assignments").WithTags(tag);

        g.MapGet("/", ListAssignments)
            .RequireAuthorization(PermissionPolicyNames.For("roles:read"))
            .WithName("ListPortalUserRoleAssignments");

        g.MapPost("/", CreateAssignment)
            .RequireAuthorization(PermissionPolicyNames.For("roles:manage"))
            .WithName("CreatePortalUserRoleAssignment");

        g.MapPut("/{assignmentId}", UpdateAssignment)
            .RequireAuthorization(PermissionPolicyNames.For("roles:manage"))
            .WithName("UpdatePortalUserRoleAssignment");

        g.MapDelete("/{assignmentId}", DeleteAssignment)
            .RequireAuthorization(PermissionPolicyNames.For("roles:manage"))
            .WithName("DeletePortalUserRoleAssignment");
    }

    private static string? ActorId(ClaimsPrincipal user) =>
        user.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? user.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);

    private static async Task<IResult> ListAssignments(
        string portalUserId,
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

        portalUserId = portalUserId.Trim();
        var target = await db.PortalUsers.AsNoTracking()
            .FirstOrDefaultAsync(u => u.TenantId == tenantId && u.Id == portalUserId, ct);
        if (target is null)
            return Results.NotFound();

        var rows = await db.PortalUserRoleAssignments.AsNoTracking()
            .Where(a => a.TenantId == tenantId && a.PortalUserId == portalUserId)
            .OrderByDescending(a => a.IsPrimary)
            .ThenBy(a => a.RoleKey)
            .Select(a => AssignmentDto.FromEntity(a))
            .ToListAsync(ct);

        return Results.Ok(new
        {
            portalUserId,
            email = target.Email,
            portalRole = target.Role,
            assignments = rows
        });
    }

    private static async Task<IResult> CreateAssignment(
        string portalUserId,
        RoleAssignmentUpsertRequest body,
        HttpRequest request,
        ClaimsPrincipal user,
        ITenantContext tenantContext,
        CommerceDbContext db,
        TenantRbacEvaluator rbac,
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

        portalUserId = portalUserId.Trim();
        var target = await db.PortalUsers.FirstOrDefaultAsync(
            u => u.TenantId == tenantId && u.Id == portalUserId,
            ct);
        if (target is null)
            return Results.NotFound();

        var validation = await ValidateAssignmentAsync(body, tenantId, rbac, db, ct);
        if (validation is not null)
            return validation;

        var roleKey = body.RoleKey!.Trim().ToLowerInvariant();
        var portalBase = AuthRoleResolver.NormalizePortalRole(body.PortalBaseRole!);

        if (body.IsPrimary == true)
            await ClearPrimaryAsync(db, tenantId, portalUserId, ct);

        var entity = new PortalUserRoleAssignment
        {
            Id = Guid.NewGuid().ToString("N"),
            TenantId = tenantId,
            PortalUserId = portalUserId,
            RoleKey = roleKey,
            PortalBaseRole = portalBase,
            IsPrimary = body.IsPrimary == true,
            ScopeJson = string.IsNullOrWhiteSpace(body.ScopeJson) ? null : body.ScopeJson.Trim(),
            ValidFrom = body.ValidFrom,
            ValidTo = body.ValidTo,
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedByUserId = actor
        };

        db.PortalUserRoleAssignments.Add(entity);
        if (entity.IsPrimary)
            target.Role = portalBase;

        await db.SaveChangesAsync(ct);

        await audit.RecordAsync(
            AuditActions.PortalRoleAssignmentMutate,
            "success",
            tenantId,
            actor,
            "portal_role_assignment",
            entity.Id,
            new { op = "create", portalUserId, roleKey, portalBase },
            request.HttpContext,
            ct);

        return Results.Created(
            $"/api/v1/portal-users/{Uri.EscapeDataString(portalUserId)}/role-assignments/{entity.Id}",
            AssignmentDto.FromEntity(entity));
    }

    private static async Task<IResult> UpdateAssignment(
        string portalUserId,
        string assignmentId,
        RoleAssignmentUpsertRequest body,
        HttpRequest request,
        ClaimsPrincipal user,
        ITenantContext tenantContext,
        CommerceDbContext db,
        TenantRbacEvaluator rbac,
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

        portalUserId = portalUserId.Trim();
        assignmentId = assignmentId.Trim();
        var row = await db.PortalUserRoleAssignments.FirstOrDefaultAsync(
            a => a.TenantId == tenantId && a.PortalUserId == portalUserId && a.Id == assignmentId,
            ct);
        if (row is null)
            return Results.NotFound();

        if (string.IsNullOrWhiteSpace(body.RoleKey))
            body.RoleKey = row.RoleKey;
        var validation = await ValidateAssignmentAsync(body, tenantId, rbac, db, ct, isUpdate: true);
        if (validation is not null)
            return validation;

        row.RoleKey = (body.RoleKey ?? row.RoleKey).Trim().ToLowerInvariant();
        row.PortalBaseRole = AuthRoleResolver.NormalizePortalRole(body.PortalBaseRole ?? row.PortalBaseRole);
        row.ScopeJson = string.IsNullOrWhiteSpace(body.ScopeJson) ? null : body.ScopeJson.Trim();
        row.ValidFrom = body.ValidFrom;
        row.ValidTo = body.ValidTo;

        if (body.IsPrimary == true && !row.IsPrimary)
        {
            await ClearPrimaryAsync(db, tenantId, portalUserId, ct);
            row.IsPrimary = true;
        }
        else if (body.IsPrimary == false)
        {
            row.IsPrimary = false;
        }

        if (row.IsPrimary)
        {
            var target = await db.PortalUsers.FirstAsync(
                u => u.TenantId == tenantId && u.Id == portalUserId,
                ct);
            target.Role = row.PortalBaseRole;
        }

        await db.SaveChangesAsync(ct);

        await audit.RecordAsync(
            AuditActions.PortalRoleAssignmentMutate,
            "success",
            tenantId,
            actor,
            "portal_role_assignment",
            row.Id,
            new { op = "update", roleKey = row.RoleKey },
            request.HttpContext,
            ct);

        return Results.Ok(AssignmentDto.FromEntity(row));
    }

    private static async Task<IResult> DeleteAssignment(
        string portalUserId,
        string assignmentId,
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

        var row = await db.PortalUserRoleAssignments.FirstOrDefaultAsync(
            a => a.TenantId == tenantId && a.PortalUserId == portalUserId.Trim() && a.Id == assignmentId.Trim(),
            ct);
        if (row is null)
            return Results.NotFound();

        var wasPrimary = row.IsPrimary;
        db.PortalUserRoleAssignments.Remove(row);
        await db.SaveChangesAsync(ct);

        if (wasPrimary)
        {
            var target = await db.PortalUsers.FirstOrDefaultAsync(
                u => u.TenantId == tenantId && u.Id == portalUserId,
                ct);
            if (target is not null)
            {
                var nextPrimary = await db.PortalUserRoleAssignments
                    .Where(a => a.TenantId == tenantId && a.PortalUserId == portalUserId)
                    .OrderByDescending(a => a.CreatedAt)
                    .FirstOrDefaultAsync(ct);
                if (nextPrimary is not null)
                {
                    nextPrimary.IsPrimary = true;
                    target.Role = nextPrimary.PortalBaseRole;
                }

                await db.SaveChangesAsync(ct);
            }
        }

        await audit.RecordAsync(
            AuditActions.PortalRoleAssignmentMutate,
            "success",
            tenantId,
            actor,
            "portal_role_assignment",
            row.Id,
            new { op = "delete" },
            request.HttpContext,
            ct);

        return Results.NoContent();
    }

    private static async Task ClearPrimaryAsync(
        CommerceDbContext db,
        string tenantId,
        string portalUserId,
        CancellationToken ct)
    {
        var others = await db.PortalUserRoleAssignments
            .Where(a => a.TenantId == tenantId && a.PortalUserId == portalUserId && a.IsPrimary)
            .ToListAsync(ct);
        foreach (var a in others)
            a.IsPrimary = false;
    }

    private static async Task<IResult?> ValidateAssignmentAsync(
        RoleAssignmentUpsertRequest body,
        string tenantId,
        TenantRbacEvaluator rbac,
        CommerceDbContext db,
        CancellationToken ct,
        bool isUpdate = false)
    {
        if (!isUpdate && string.IsNullOrWhiteSpace(body.RoleKey))
            return Results.BadRequest(new { error = "roleKey_required" });
        if (string.IsNullOrWhiteSpace(body.PortalBaseRole))
            return Results.BadRequest(new { error = "portalBaseRole_required" });

        var portalBase = AuthRoleResolver.NormalizePortalRole(body.PortalBaseRole!);
        if (!PortalRoles.IsKnown(portalBase))
            return Results.BadRequest(new { error = "invalid_portal_base_role" });

        var roleKey = (body.RoleKey ?? "").Trim().ToLowerInvariant();
        if (!isUpdate && roleKey.Length is < 2 or > 48)
            return Results.BadRequest(new { error = "invalid_role_key" });

        var manifest = await rbac.GetEffectiveManifestAsync(tenantId, ct);

        if (!isUpdate)
        {
            var known =
                manifest.Roles.ContainsKey(roleKey)
                || await db.TenantCustomRoles.AnyAsync(
                    r => r.TenantId == tenantId && r.RoleKey == roleKey,
                    ct);
            if (!known)
                return Results.BadRequest(new { error = "unknown_role_key", roleKey });
        }
        else if (!string.IsNullOrWhiteSpace(body.RoleKey))
        {
            var known =
                manifest.Roles.ContainsKey(roleKey)
                || await db.TenantCustomRoles.AnyAsync(
                    r => r.TenantId == tenantId && r.RoleKey == roleKey,
                    ct);
            if (!known)
                return Results.BadRequest(new { error = "unknown_role_key", roleKey });
        }

        return null;
    }

    public sealed record AssignmentDto(
        string Id,
        string RoleKey,
        string PortalBaseRole,
        bool IsPrimary,
        string? ScopeJson,
        DateTimeOffset? ValidFrom,
        DateTimeOffset? ValidTo,
        DateTimeOffset CreatedAt)
    {
        public static AssignmentDto FromEntity(PortalUserRoleAssignment a) =>
            new(
                a.Id,
                a.RoleKey,
                a.PortalBaseRole,
                a.IsPrimary,
                a.ScopeJson,
                a.ValidFrom,
                a.ValidTo,
                a.CreatedAt);
    }

    public sealed class RoleAssignmentUpsertRequest
    {
        public string? RoleKey { get; set; }
        public string? PortalBaseRole { get; set; }
        public bool? IsPrimary { get; set; }
        public string? ScopeJson { get; set; }
        public DateTimeOffset? ValidFrom { get; set; }
        public DateTimeOffset? ValidTo { get; set; }
    }
}
