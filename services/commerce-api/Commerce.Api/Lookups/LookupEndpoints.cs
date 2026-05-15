using System.Security.Claims;
using Commerce.Api.Audit;
using Commerce.Api.Data;
using Commerce.Api.Entities;
using Commerce.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using WebkitFx.Platform.Tenancy;

namespace Commerce.Api.Lookups;

public static class LookupEndpoints
{
    public static void MapLookupsV1(this WebApplication app)
    {
        const string tag = "lookups";
        const string basePath = "/api/v1/lookups";

        app.MapGet($"{basePath}/types", ListTypes).WithTags(tag).WithName("LookupsListTypes");
        app.MapGet($"{basePath}/types/{{lookupTypeId}}/values", ListValues).WithTags(tag).WithName("LookupsListValues");
        app.MapGet($"{basePath}/bundle", GetBundle).WithTags(tag).WithName("LookupsGetBundle");

        app.MapPut($"{basePath}/types/{{lookupTypeId}}", UpsertType)
            .RequireAuthorization()
            .WithTags(tag)
            .WithName("LookupsUpsertType");

        app.MapDelete($"{basePath}/types/{{lookupTypeId}}", DeleteType)
            .RequireAuthorization()
            .WithTags(tag)
            .WithName("LookupsDeleteType");

        app.MapPost($"{basePath}/types/{{lookupTypeId}}/values", CreateValue)
            .RequireAuthorization()
            .WithTags(tag)
            .WithName("LookupsCreateValue");

        app.MapPut($"{basePath}/values/{{valueId}}", UpdateValue)
            .RequireAuthorization()
            .WithTags(tag)
            .WithName("LookupsUpdateValue");

        app.MapDelete($"{basePath}/values/{{valueId}}", DeleteValue)
            .RequireAuthorization()
            .WithTags(tag)
            .WithName("LookupsDeleteValue");
    }

    private static string? ActorId(ClaimsPrincipal user) =>
        user.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? user.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);

    private static LookupTypeResponse ToDto(LookupType t) =>
        new(t.Id, t.Title, t.Description, t.ParentLookupTypeId, t.ParentFieldLabel, t.EntryIdPrefix);

    private static LookupValueResponse ToDto(LookupValue v) =>
        new(v.Id, v.LookupTypeId, v.Code, v.Label, v.SortOrder, v.ParentValueId, v.MerchandisingParentId, v.ImageStorageKey);

    /// <summary>Maps legacy URL segment <c>product_department</c> to <c>product_departments</c> when only the plural type exists.</summary>
    private static async Task<string> ResolveLegacyProductDepartmentTypeIdAsync(
        CommerceDbContext db,
        string tenantId,
        string lookupTypeId,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(lookupTypeId))
            return lookupTypeId;
        var id = lookupTypeId.Trim();
        if (!string.Equals(id, "product_department", StringComparison.Ordinal))
            return id;
        if (await db.LookupTypes.AsNoTracking().AnyAsync(t => t.TenantId == tenantId && t.Id == id, ct))
            return id;
        if (await db.LookupTypes.AsNoTracking().AnyAsync(t => t.TenantId == tenantId && t.Id == "product_departments", ct))
            return "product_departments";
        return id;
    }

    /// <summary>Sanitize optional media path; rejects traversal.</summary>
    private static string? NormalizeLookupImageStorageKey(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return null;
        var s = raw.Trim().Replace('\\', '/').TrimStart('/');
        if (s.Length == 0)
            return null;
        if (s.Contains("..", StringComparison.Ordinal))
            return null;
        return s.Length > 512 ? s[..512] : s;
    }

    private static async Task<IResult> ListTypes(
        HttpRequest request,
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(request.HttpContext, tenantContext, audit, ct);
        if (tenantFail is not null)
            return tenantFail;
        var tenantId = request.ResolveTenantId(tenantContext)!;

        var rows = await db.LookupTypes.AsNoTracking()
            .Where(t => t.TenantId == tenantId)
            .OrderBy(t => t.Id)
            .ToListAsync(ct);
        return Results.Ok(rows.Select(ToDto).ToList());
    }

    private static async Task<IResult> ListValues(
        string lookupTypeId,
        HttpRequest request,
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(request.HttpContext, tenantContext, audit, ct);
        if (tenantFail is not null)
            return tenantFail;
        var tenantId = request.ResolveTenantId(tenantContext)!;

        lookupTypeId = await ResolveLegacyProductDepartmentTypeIdAsync(db, tenantId, lookupTypeId, ct);

        if (!await db.LookupTypes.AsNoTracking().AnyAsync(t => t.TenantId == tenantId && t.Id == lookupTypeId, ct))
            return Results.NotFound(new { error = "unknown_lookup_type", lookupTypeId });

        var rows = await db.LookupValues.AsNoTracking()
            .Where(v => v.TenantId == tenantId && v.LookupTypeId == lookupTypeId)
            .OrderBy(v => v.SortOrder).ThenBy(v => v.Code)
            .ToListAsync(ct);
        return Results.Ok(rows.Select(ToDto).ToList());
    }

    private static async Task<IResult> GetBundle(
        HttpRequest request,
        ITenantContext tenantContext,
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var tenantFail = await TenantGate.RequireTenantAsync(request.HttpContext, tenantContext, audit, ct);
        if (tenantFail is not null)
            return tenantFail;
        var tenantId = request.ResolveTenantId(tenantContext)!;

        var types = await db.LookupTypes.AsNoTracking()
            .Where(t => t.TenantId == tenantId)
            .OrderBy(t => t.Id)
            .ToListAsync(ct);

        var values = await db.LookupValues.AsNoTracking()
            .Where(v => v.TenantId == tenantId)
            .OrderBy(v => v.LookupTypeId).ThenBy(v => v.SortOrder).ThenBy(v => v.Code)
            .ToListAsync(ct);

        var byType = values
            .GroupBy(v => v.LookupTypeId)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<LookupValueResponse>)g.Select(ToDto).ToList());

        foreach (var t in types)
        {
            if (!byType.ContainsKey(t.Id))
                byType[t.Id] = Array.Empty<LookupValueResponse>();
        }

        return Results.Ok(new LookupBundleResponse("2", types.Select(ToDto).ToList(), byType));
    }

    private static async Task<IResult> UpsertType(
        string lookupTypeId,
        UpsertLookupTypeRequest body,
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

        lookupTypeId = lookupTypeId.Trim();
        if (string.IsNullOrWhiteSpace(lookupTypeId) || lookupTypeId.Length > 64)
            return Results.BadRequest(new { error = "invalid_lookup_type_id" });

        if (string.IsNullOrWhiteSpace(body.Title) || string.IsNullOrWhiteSpace(body.EntryIdPrefix))
            return Results.BadRequest(new { error = "title_and_entryIdPrefix_required" });

        var prefix = body.EntryIdPrefix.Trim();
        if (prefix.Length is < 1 or > 32)
            return Results.BadRequest(new { error = "invalid_entryIdPrefix" });

        if (body.ParentLookupTypeId is { Length: > 0 } pid)
        {
            if (string.Equals(pid, lookupTypeId, StringComparison.Ordinal))
                return Results.BadRequest(new { error = "parent_cannot_equal_self" });
            if (!await db.LookupTypes.AnyAsync(t => t.TenantId == tenantId && t.Id == pid, ct))
                return Results.BadRequest(new { error = "unknown_parent_lookup_type", parentLookupTypeId = pid });
        }

        var row = await db.LookupTypes.FirstOrDefaultAsync(
            t => t.TenantId == tenantId && t.Id == lookupTypeId, ct);
        if (row is null)
        {
            row = new LookupType
            {
                TenantId = tenantId,
                Id = lookupTypeId,
                Title = body.Title.Trim(),
                Description = string.IsNullOrWhiteSpace(body.Description) ? null : body.Description.Trim(),
                ParentLookupTypeId = string.IsNullOrWhiteSpace(body.ParentLookupTypeId) ? null : body.ParentLookupTypeId.Trim(),
                ParentFieldLabel = string.IsNullOrWhiteSpace(body.ParentFieldLabel) ? null : body.ParentFieldLabel.Trim(),
                EntryIdPrefix = prefix
            };
            db.LookupTypes.Add(row);
        }
        else
        {
            row.Title = body.Title.Trim();
            row.Description = string.IsNullOrWhiteSpace(body.Description) ? null : body.Description.Trim();
            row.ParentLookupTypeId = string.IsNullOrWhiteSpace(body.ParentLookupTypeId) ? null : body.ParentLookupTypeId.Trim();
            row.ParentFieldLabel = string.IsNullOrWhiteSpace(body.ParentFieldLabel) ? null : body.ParentFieldLabel.Trim();
            row.EntryIdPrefix = prefix;
        }

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            return Results.Conflict(new { error = "constraint" });
        }

        await audit.RecordAsync(
            AuditActions.LookupMutate,
            "success",
            tenantId,
            ActorId(user),
            "lookup_type",
            lookupTypeId,
            new { op = "upsert" },
            request.HttpContext,
            ct);

        return Results.Ok(ToDto(row));
    }

    private static async Task<IResult> DeleteType(
        string lookupTypeId,
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

        var row = await db.LookupTypes.FirstOrDefaultAsync(t => t.TenantId == tenantId && t.Id == lookupTypeId, ct);
        if (row is null)
            return Results.NotFound();

        if (await db.LookupTypes.AnyAsync(t => t.TenantId == tenantId && t.ParentLookupTypeId == lookupTypeId, ct))
            return Results.Conflict(new { error = "child_types_reference_this_type" });

        await db.LookupValues.Where(v => v.TenantId == tenantId && v.LookupTypeId == lookupTypeId).ExecuteDeleteAsync(ct);
        db.LookupTypes.Remove(row);
        await db.SaveChangesAsync(ct);

        await audit.RecordAsync(
            AuditActions.LookupMutate,
            "success",
            tenantId,
            ActorId(user),
            "lookup_type",
            lookupTypeId,
            new { op = "delete" },
            request.HttpContext,
            ct);

        return Results.NoContent();
    }

    private static async Task<IResult> CreateValue(
        string lookupTypeId,
        CreateLookupValueRequest body,
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

        lookupTypeId = await ResolveLegacyProductDepartmentTypeIdAsync(db, tenantId, lookupTypeId, ct);

        var type = await db.LookupTypes.AsNoTracking()
            .FirstOrDefaultAsync(t => t.TenantId == tenantId && t.Id == lookupTypeId, ct);
        if (type is null)
            return Results.NotFound(new { error = "unknown_lookup_type", lookupTypeId });

        var code = body.Code.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(code) || code.Length > 128)
            return Results.BadRequest(new { error = "invalid_code" });
        if (string.IsNullOrWhiteSpace(body.Label) || body.Label.Length > 512)
            return Results.BadRequest(new { error = "invalid_label" });

        if (await db.LookupValues.AnyAsync(v => v.TenantId == tenantId && v.LookupTypeId == lookupTypeId && v.Code == code, ct))
            return Results.Conflict(new { error = "duplicate_code", code });

        string? parentValueId = string.IsNullOrWhiteSpace(body.ParentValueId) ? null : body.ParentValueId.Trim();
        if (type.ParentLookupTypeId is { Length: > 0 } parentTypeId)
        {
            if (string.IsNullOrEmpty(parentValueId))
                return Results.BadRequest(new { error = "parent_value_required" });

            var parentRow = await db.LookupValues.AsNoTracking()
                .FirstOrDefaultAsync(
                    v => v.TenantId == tenantId && v.Id == parentValueId && v.LookupTypeId == parentTypeId, ct);
            if (parentRow is null)
                return Results.BadRequest(new { error = "parent_value_not_found", parentLookupTypeId = parentTypeId });
        }
        else if (parentValueId is not null)
            return Results.BadRequest(new { error = "parent_value_not_applicable" });

        var raw = $"{type.EntryIdPrefix.Trim()}{Guid.NewGuid():N}";
        var id = raw.Length > 64 ? raw[..64] : raw;

        var imageKey = NormalizeLookupImageStorageKey(body.ImageStorageKey);

        var entity = new LookupValue
        {
            Id = id,
            TenantId = tenantId,
            LookupTypeId = lookupTypeId,
            Code = code,
            Label = body.Label.Trim(),
            SortOrder = body.SortOrder,
            ParentValueId = parentValueId,
            ImageStorageKey = imageKey
        };
        db.LookupValues.Add(entity);

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            return Results.Conflict(new { error = "constraint" });
        }

        await audit.RecordAsync(
            AuditActions.LookupMutate,
            "success",
            tenantId,
            ActorId(user),
            "lookup_value",
            entity.Id,
            new { op = "create", lookupTypeId },
            request.HttpContext,
            ct);

        var location =
            $"{request.PathBase}/api/v1/lookups/types/{Uri.EscapeDataString(lookupTypeId)}/values?created={Uri.EscapeDataString(entity.Id)}";
        return Results.Created(location, ToDto(entity));
    }

    private static async Task<IResult> UpdateValue(
        string valueId,
        UpdateLookupValueRequest body,
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

        valueId = valueId.Trim();
        if (string.IsNullOrWhiteSpace(valueId))
            return Results.BadRequest(new { error = "invalid_value_id" });

        var row = await db.LookupValues.FirstOrDefaultAsync(v => v.TenantId == tenantId && v.Id == valueId, ct);
        if (row is null)
            return Results.NotFound();

        var type = await db.LookupTypes.AsNoTracking()
            .FirstOrDefaultAsync(t => t.TenantId == tenantId && t.Id == row.LookupTypeId, ct);
        if (type is null)
            return Results.NotFound(new { error = "unknown_lookup_type", lookupTypeId = row.LookupTypeId });

        var code = body.Code.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(code) || code.Length > 128)
            return Results.BadRequest(new { error = "invalid_code" });
        if (string.IsNullOrWhiteSpace(body.Label) || body.Label.Length > 512)
            return Results.BadRequest(new { error = "invalid_label" });

        if (await db.LookupValues.AnyAsync(
                v => v.TenantId == tenantId && v.LookupTypeId == row.LookupTypeId && v.Code == code && v.Id != valueId,
                ct))
            return Results.Conflict(new { error = "duplicate_code", code });

        string? parentValueId = string.IsNullOrWhiteSpace(body.ParentValueId) ? null : body.ParentValueId.Trim();
        if (type.ParentLookupTypeId is { Length: > 0 } parentTypeId)
        {
            if (string.IsNullOrEmpty(parentValueId))
                return Results.BadRequest(new { error = "parent_value_required" });

            var parentRow = await db.LookupValues.AsNoTracking()
                .FirstOrDefaultAsync(
                    v => v.TenantId == tenantId && v.Id == parentValueId && v.LookupTypeId == parentTypeId, ct);
            if (parentRow is null)
                return Results.BadRequest(new { error = "parent_value_not_found", parentLookupTypeId = parentTypeId });
        }
        else if (parentValueId is not null)
            return Results.BadRequest(new { error = "parent_value_not_applicable" });

        row.Code = code;
        row.Label = body.Label.Trim();
        row.SortOrder = body.SortOrder;
        row.ParentValueId = parentValueId;
        row.ImageStorageKey = NormalizeLookupImageStorageKey(body.ImageStorageKey);

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            return Results.Conflict(new { error = "constraint" });
        }

        await audit.RecordAsync(
            AuditActions.LookupMutate,
            "success",
            tenantId,
            ActorId(user),
            "lookup_value",
            row.Id,
            new { op = "update", lookupTypeId = row.LookupTypeId },
            request.HttpContext,
            ct);

        return Results.Ok(ToDto(row));
    }

    private static async Task<IResult> DeleteValue(
        string valueId,
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

        var row = await db.LookupValues.FirstOrDefaultAsync(v => v.TenantId == tenantId && v.Id == valueId, ct);
        if (row is null)
            return Results.NotFound();

        await DeleteValueSubtreeAsync(db, tenantId, valueId, ct);

        await audit.RecordAsync(
            AuditActions.LookupMutate,
            "success",
            tenantId,
            ActorId(user),
            "lookup_value",
            valueId,
            new { op = "delete" },
            request.HttpContext,
            ct);

        return Results.NoContent();
    }

    /// <summary>Post-order delete: descendants first (self-FK on <see cref="LookupValue.ParentValueId"/>).</summary>
    private static async Task DeleteValueSubtreeAsync(CommerceDbContext db, string tenantId, string rootId, CancellationToken ct)
    {
        var all = await db.LookupValues.AsNoTracking()
            .Where(v => v.TenantId == tenantId)
            .Select(v => new { v.Id, v.ParentValueId })
            .ToListAsync(ct);

        var byParent = new Dictionary<string, List<string>>();
        foreach (var v in all)
        {
            if (v.ParentValueId is null)
                continue;
            if (!byParent.TryGetValue(v.ParentValueId, out var list))
            {
                list = [];
                byParent[v.ParentValueId] = list;
            }

            list.Add(v.Id);
        }

        var order = new List<string>();
        void Visit(string id)
        {
            foreach (var child in byParent.GetValueOrDefault(id) ?? [])
                Visit(child);
            order.Add(id);
        }

        Visit(rootId);

        for (var i = 0; i < order.Count; i++)
        {
            var id = order[i];
            await db.LookupValues.Where(v => v.TenantId == tenantId && v.Id == id).ExecuteDeleteAsync(ct);
        }
    }
}
