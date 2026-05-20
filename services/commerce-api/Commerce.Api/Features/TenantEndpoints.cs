using Commerce.Api.Audit;
using Commerce.Api.Data;
using Commerce.Api.Entities;
using Commerce.Api.Tenancy;
using Microsoft.EntityFrameworkCore;
using WebkitFx.Platform.Tenancy;

namespace Commerce.Api.Features;

public static class TenantEndpoints
{
    public static void MapTenantV1(this WebApplication app)
    {
        app.MapGet("/api/v1/tenants", ListTenants).WithName("ListTenants");
        app.MapGet("/api/v1/tenants/by-host", ResolveByHost).WithName("ResolveTenantByHost");
        app.MapGet("/api/v1/tenants/{slugOrId}/bootstrap", BootstrapBySlugOrId).WithName("TenantBootstrap");
        app.MapGet("/api/v1/tenants/{tenantId}/rbac", GetTenantRbac).WithName("TenantRbac");
        app.MapPost("/api/v1/tenants", CreateTenant).RequireAuthorization("Admin").WithName("CreateTenant");
    }

    private static async Task<IResult> ListTenants(CommerceDbContext db, CancellationToken ct)
    {
        var list = await db.Tenants.AsNoTracking()
            .OrderBy(t => t.Slug)
            .Select(t => TenantPublicDto.FromEntity(t))
            .ToListAsync(ct);
        return Results.Ok(list);
    }

    private static async Task<IResult> ResolveByHost(
        string? host,
        CommerceDbContext db,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(host))
            return Results.BadRequest(new { error = "Query parameter 'host' is required." });

        var normalized = NormalizeHost(host);
        var tenants = await db.Tenants.AsNoTracking().Where(t => t.IsActive).ToListAsync(ct);
        foreach (var tenant in tenants)
        {
            if (!HostMatches(tenant, normalized))
                continue;
            return Results.Ok(TenantBootstrapDto.FromEntity(tenant));
        }

        return Results.NotFound(new { error = "No active tenant for host.", host = normalized });
    }

    private static async Task<IResult> BootstrapBySlugOrId(
        string slugOrId,
        CommerceDbContext db,
        TenantRbacService rbac,
        CancellationToken ct)
    {
        var key = slugOrId.Trim();
        var tenant = await db.Tenants.AsNoTracking()
            .FirstOrDefaultAsync(
                t => t.Id == key || t.Slug == key.ToLowerInvariant(),
                ct);

        if (tenant is null)
            return Results.NotFound(new { error = "Tenant not found.", slugOrId = key });

        if (!tenant.IsActive)
            return Results.Json(
                new { error = "Tenant is not active.", tenantId = tenant.Id },
                statusCode: StatusCodes.Status403Forbidden);

        var dto = TenantBootstrapDto.FromEntity(tenant);
        return Results.Ok(new
        {
            dto.TenantId,
            dto.Name,
            dto.Slug,
            dto.StorefrontMode,
            dto.Vertical,
            dto.IsActive,
            features = rbac.FeaturesFor(tenant.StorefrontMode, tenant.Vertical),
            rbacVersion = rbac.Manifest.Version
        });
    }

    private static async Task<IResult> GetTenantRbac(
        string tenantId,
        CommerceDbContext db,
        TenantRbacService rbac,
        CancellationToken ct)
    {
        var tenant = await db.Tenants.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == tenantId.Trim(), ct);

        if (tenant is null)
            return Results.NotFound(new { error = "Tenant not found.", tenantId });

        var manifest = rbac.GetEffectiveManifest(tenant.Vertical);
        return Results.Ok(new
        {
            version = manifest.Version,
            vertical = tenant.Vertical,
            registerableRoles = manifest.RegisterableRoles,
            roles = manifest.Roles,
            storefrontModes = manifest.StorefrontModes,
            permissionCatalog = manifest.PermissionCatalog
        });
    }

    private static async Task<IResult> CreateTenant(
        TenantCreateRequest body,
        HttpContext http,
        CommerceDbContext db,
        AuditLogWriter audit,
        CancellationToken ct)
    {
        var actor = AuditLogWriter.ActorFromPrincipal(http.User);
        if (string.IsNullOrWhiteSpace(body.Id) || string.IsNullOrWhiteSpace(body.Name) || string.IsNullOrWhiteSpace(body.Slug))
        {
            await audit.RecordAsync(
                AuditActions.TenantCreate,
                "failure",
                tenantId: null,
                actor,
                "tenant",
                body.Id,
                new { reason = "validation" },
                http,
                ct);
            return Results.BadRequest(new { error = "id, name, and slug are required" });
        }

        if (!StorefrontModes.IsKnown(body.StorefrontMode))
            return Results.BadRequest(new { error = "storefrontMode must be marketplace or isolated_shop." });

        var entity = new Tenant
        {
            Id = body.Id.Trim(),
            Name = body.Name.Trim(),
            Slug = body.Slug.Trim().ToLowerInvariant(),
            StorefrontMode = body.StorefrontMode.Trim().ToLowerInvariant(),
            Vertical = string.IsNullOrWhiteSpace(body.Vertical) ? null : body.Vertical.Trim(),
            IsActive = body.IsActive ?? true,
            CreatedAt = DateTimeOffset.UtcNow,
            HostAliasesJson = body.HostAliases is { Count: > 0 }
                ? System.Text.Json.JsonSerializer.Serialize(body.HostAliases)
                : null
        };

        db.Tenants.Add(entity);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            await audit.RecordAsync(
                AuditActions.TenantCreate,
                "failure",
                tenantId: null,
                actor,
                "tenant",
                body.Id,
                new { reason = "duplicate" },
                http,
                ct);
            return Results.Conflict(new { error = "duplicate id or slug" });
        }

        await audit.RecordAsync(
            AuditActions.TenantCreate,
            "success",
            entity.Id,
            actor,
            "tenant",
            entity.Id,
            new { slug = entity.Slug, name = entity.Name, storefrontMode = entity.StorefrontMode },
            http,
            ct);

        return Results.Created($"/api/v1/tenants/{Uri.EscapeDataString(entity.Id)}", TenantPublicDto.FromEntity(entity));
    }

    private static string NormalizeHost(string host)
    {
        var trimmed = host.Trim();
        if (trimmed.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
            || trimmed.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            if (Uri.TryCreate(trimmed, UriKind.Absolute, out var uri))
                return uri.Host.ToLowerInvariant();
        }

        var withoutPort = trimmed.Split(':')[0];
        return withoutPort.ToLowerInvariant();
    }

    private static bool HostMatches(Tenant tenant, string normalizedHost)
    {
        if (string.Equals(tenant.Slug, normalizedHost, StringComparison.OrdinalIgnoreCase))
            return true;

        if (string.IsNullOrWhiteSpace(tenant.HostAliasesJson))
            return false;

        try
        {
            var aliases = System.Text.Json.JsonSerializer.Deserialize<List<string>>(tenant.HostAliasesJson);
            return aliases?.Any(a => string.Equals(NormalizeHost(a), normalizedHost, StringComparison.OrdinalIgnoreCase)) == true;
        }
        catch (System.Text.Json.JsonException)
        {
            return false;
        }
    }

    public sealed record TenantPublicDto(
        string Id,
        string Name,
        string Slug,
        string StorefrontMode,
        string? Vertical,
        bool IsActive,
        DateTimeOffset CreatedAt)
    {
        public static TenantPublicDto FromEntity(Tenant t) =>
            new(t.Id, t.Name, t.Slug, t.StorefrontMode, t.Vertical, t.IsActive, t.CreatedAt);
    }

    public sealed record TenantBootstrapDto(
        string TenantId,
        string Name,
        string Slug,
        string StorefrontMode,
        string? Vertical,
        bool IsActive)
    {
        public static TenantBootstrapDto FromEntity(Tenant t) =>
            new(t.Id, t.Name, t.Slug, t.StorefrontMode, t.Vertical, t.IsActive);
    }

    public sealed class TenantCreateRequest
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public string Slug { get; set; } = "";
        public string StorefrontMode { get; set; } = StorefrontModes.IsolatedShop;
        public string? Vertical { get; set; }
        public bool? IsActive { get; set; }
        public List<string>? HostAliases { get; set; }
    }
}
