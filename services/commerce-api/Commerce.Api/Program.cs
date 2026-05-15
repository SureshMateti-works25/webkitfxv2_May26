using Commerce.Api.Audit;
using Commerce.Api.Auth;
using Commerce.Api.Catalog;
using Commerce.Api.Data;
using Commerce.Api.Lookups;
using Commerce.Api.Entities;
using Microsoft.AspNetCore.Identity;
using Commerce.Api.Features;
using Commerce.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.AspNetCore.StaticFiles;
using Npgsql;
using WebkitFx.Platform;
using WebkitFx.Platform.Media;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<LocalMediaStorageOptions>(builder.Configuration.GetSection("Media"));

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<AuditLogWriter>();

builder.Services.AddExceptionHandler<EfCoreExceptionHandler>();
builder.Services.AddWebkitFxPlatform();

var commerceConnectionString = builder.Configuration.GetConnectionString("Commerce")
    ?? throw new InvalidOperationException(
        "Connection string 'Commerce' is missing. Use appsettings, User Secrets, or env ConnectionStrings__Commerce.");

if (!builder.Environment.IsDevelopment())
{
    var csb = new NpgsqlConnectionStringBuilder(commerceConnectionString);
    if (string.Equals(csb.Host, "localhost", StringComparison.OrdinalIgnoreCase)
        || string.Equals(csb.Host, "127.0.0.1", StringComparison.OrdinalIgnoreCase))
    {
        throw new InvalidOperationException(
            "Commerce API is not configured for this environment: ConnectionStrings__Commerce still points to localhost. "
            + "In Azure Portal → your App Service → Environment variables, add ConnectionStrings__Commerce with your PostgreSQL "
            + "connection string (Host=… from Azure Database for PostgreSQL or your server), save, and restart the app.");
    }
}

builder.Services.AddDbContext<CommerceDbContext>(options => { options.UseNpgsql(commerceConnectionString); });

builder.Services.AddCommerceJwtAuthentication(builder.Configuration);

builder.Services.AddSingleton<PortalJwtIssuer>();
builder.Services.AddSingleton<IPasswordHasher<PortalUser>, PasswordHasher<PortalUser>>();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        var defaultOrigins = new List<string>();
        if (builder.Environment.IsDevelopment())
        {
            // Vite dev servers (Sarees default 5175, Groceries 5183, plus common fallback ports).
            foreach (var port in Enumerable.Range(5170, 40))
            {
                defaultOrigins.Add($"http://localhost:{port}");
                defaultOrigins.Add($"http://127.0.0.1:{port}");
            }
        }

        var extraOrigins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? Array.Empty<string>();
        var origins = defaultOrigins
            .Concat(extraOrigins.Where(static o => !string.IsNullOrWhiteSpace(o)).Select(static o => o.Trim()))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        policy.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod();
    });
});

builder.Services.AddOpenApi();

var app = builder.Build();

// Production / staging: apply EF migrations when explicitly enabled (e.g. first deploy to private Postgres from the Web App itself).
if (!app.Environment.IsDevelopment()
    && string.Equals(app.Configuration["Commerce:ApplyPendingMigrations"], "true", StringComparison.OrdinalIgnoreCase))
{
    await using var scope = app.Services.CreateAsyncScope();
    var migrateLogger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("Commerce.Api.Bootstrap");
    var dbMigrate = scope.ServiceProvider.GetRequiredService<CommerceDbContext>();
    migrateLogger.LogInformation("Applying EF Core migrations (Commerce:ApplyPendingMigrations=true).");
    await dbMigrate.Database.MigrateAsync();
}

// Production: ensure default tenant exists when flag set (empty DB after migrate).
if (!app.Environment.IsDevelopment()
    && string.Equals(app.Configuration["Commerce:EnsureDefaultTenant"], "true", StringComparison.OrdinalIgnoreCase))
{
    await using var scope = app.Services.CreateAsyncScope();
    var dbTenant = scope.ServiceProvider.GetRequiredService<CommerceDbContext>();
    if (!await dbTenant.Tenants.AnyAsync())
    {
        dbTenant.Tenants.Add(new Tenant { Id = "t1", Name = "Acme Sarees", Slug = "acme" });
        await dbTenant.SaveChangesAsync();
    }
}

// Production / staging: idempotent grocery aisle rows (Fresh vegetables, Atta, …) — dev seed does not run on Azure.
if (!app.Environment.IsDevelopment()
    && !string.Equals(app.Configuration["Commerce:EnsureGroceryStorefrontAisles"], "false", StringComparison.OrdinalIgnoreCase))
{
    await using var scope = app.Services.CreateAsyncScope();
    var dbAisles = scope.ServiceProvider.GetRequiredService<CommerceDbContext>();
    var aisleLogger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("Commerce.Api.Bootstrap");
    await CommerceDevDataSeeder.EnsureGroceryStorefrontAisleLookupsAsync(dbAisles);
    aisleLogger.LogInformation("Grocery storefront aisle lookups ensured (Commerce:EnsureGroceryStorefrontAisles).");
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    await using (var scope = app.Services.CreateAsyncScope())
    {
        var bootstrapLogger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>()
            .CreateLogger("Commerce.Api.Bootstrap");
        bootstrapLogger.LogInformation("Applying EF Core migrations (development).");

        var db = scope.ServiceProvider.GetRequiredService<CommerceDbContext>();
        await db.Database.MigrateAsync();

        var audit = scope.ServiceProvider.GetRequiredService<AuditLogWriter>();
        await audit.RecordAsync(
            AuditActions.BootstrapMigrate,
            "success",
            tenantId: null,
            actorUserId: null,
            resourceType: "database",
            resourceId: "efcore",
            detail: new { phase = "migrate" },
            http: null,
            CancellationToken.None);

        if (!await db.Tenants.AnyAsync())
        {
            db.Tenants.Add(new Tenant { Id = "t1", Name = "Acme Sarees", Slug = "acme" });
            await db.SaveChangesAsync();
        }

        var skipLookupReseed = string.Equals(
            builder.Configuration["Commerce:SkipLookupReseed"],
            "true",
            StringComparison.OrdinalIgnoreCase);
        if (skipLookupReseed)
            bootstrapLogger.LogInformation("Skipping dev lookup re-seed (Commerce:SkipLookupReseed=true).");

        if (!skipLookupReseed)
        {
            await CommerceDevDataSeeder.EnsureConfigurableLookupSeedAsync(db);
            await CommerceDevDataSeeder.EnsureProductTypesLookupAndLinkCategoriesParentAsync(db);
            await CommerceDevDataSeeder.RemoveGroceryProduceDairyDemoDepartmentValuesAsync(db, CancellationToken.None);
            await CommerceDevDataSeeder.EnsureDevSareeProductCategoryLookupsAsync(db);
            await CommerceDevDataSeeder.EnsureProductCategoryLookupParentTypesAsync(db);
        }

        var skipProductReseed = string.Equals(
            builder.Configuration["Commerce:SkipProductReseed"],
            "true",
            StringComparison.OrdinalIgnoreCase);
        if (skipProductReseed)
            bootstrapLogger.LogInformation("Skipping dev product re-seed (Commerce:SkipProductReseed=true).");

        if (!skipProductReseed)
        {
            await CommerceDevDataSeeder.SeedAsync(db);
            await CommerceDevDataSeeder.EnsureOperationalSeedAsync(db);
            await CommerceDevDataSeeder.EnsureDemoProductCardPricingAsync(db);
            await CommerceDevDataSeeder.EnsureDemoProductColorGalleryAsync(db);
        }

        if (!skipLookupReseed)
        {
            await CommerceDevDataSeeder.EnsureKalamkariCategoryAsync(db);
        }

        await CommerceDevDataSeeder.EnsureLegacySareeProductTypeAsync(db);

        var mediaRootForSeed = Path.GetFullPath(Path.Combine(
            app.Environment.ContentRootPath,
            builder.Configuration.GetSection("Media").Get<LocalMediaStorageOptions>()?.RootPath ?? "uploads/media"));
        if (!skipLookupReseed && !skipProductReseed)
        {
            await CommerceDevDataSeeder.EnsureGroceryCatalogDevSeedAsync(db, mediaRootForSeed);
            await CommerceDevDataSeeder.EnsureProductCategoryLookupParentTypesAsync(db);
        }

        if (!skipProductReseed)
            await CommerceDevDataSeeder.EnsureStorefrontSponsoredDevSeedAsync(db);

        var passwordHasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<PortalUser>>();
        var configuration = scope.ServiceProvider.GetRequiredService<IConfiguration>();
        await CommerceDevDataSeeder.EnsureDevSiteAdminAsync(db, passwordHasher, configuration, bootstrapLogger, CancellationToken.None);

        if (!skipProductReseed)
            CommerceDevDataSeeder.EnsureSeedHeroMediaBlobExists(mediaRootForSeed);

        await audit.RecordAsync(
            AuditActions.BootstrapMigrate,
            "success",
            tenantId: null,
            actorUserId: null,
            resourceType: "database",
            resourceId: "seed",
            detail: new { phase = "dev_seed" },
            http: null,
            CancellationToken.None);
    }
}

app.UseWebkitFxPlatform();
// Local dev runs on http://localhost:5055 only; HTTPS redirection breaks Vite's /api proxy and curl tests.
if (!app.Environment.IsDevelopment())
    app.UseHttpsRedirection();
app.UseCors();

// Public blobs must be reachable without JWT (storefront + Vite `/media` proxy). Register before auth.
var mediaOpts = app.Configuration.GetSection("Media").Get<LocalMediaStorageOptions>() ?? new LocalMediaStorageOptions();
var mediaRoot = LocalMediaStorage.ResolveMediaRootPath(app.Environment.ContentRootPath, mediaOpts.RootPath);
Directory.CreateDirectory(mediaRoot);
// Older runs resolved relative Media:RootPath against cwd (e.g. repo root) while seeding used ContentRootPath.
// If that folder still exists, serve blobs from there too so existing uploads keep working.
var rawMediaRoot = mediaOpts.RootPath ?? "uploads/media";
string? cwdMediaLegacy = null;
if (!Path.IsPathRooted(rawMediaRoot.Trim()))
    cwdMediaLegacy = Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), rawMediaRoot));

IFileProvider mediaFiles = new PhysicalFileProvider(mediaRoot);
if (cwdMediaLegacy is not null
    && Directory.Exists(cwdMediaLegacy)
    && !string.Equals(mediaRoot, cwdMediaLegacy, StringComparison.OrdinalIgnoreCase))
{
    mediaFiles = new CompositeFileProvider(
        new PhysicalFileProvider(mediaRoot),
        new PhysicalFileProvider(cwdMediaLegacy));
}

var mediaServeSearchRoots = new List<string> { mediaRoot };
if (cwdMediaLegacy is not null && !string.Equals(mediaRoot, cwdMediaLegacy, StringComparison.OrdinalIgnoreCase))
    mediaServeSearchRoots.Add(cwdMediaLegacy);

// Explicit /media resolution (content root + legacy cwd) so blobs always match upload paths even if static file mapping misses.
app.Use(async (context, next) =>
{
    if (!HttpMethods.IsGet(context.Request.Method) && !HttpMethods.IsHead(context.Request.Method))
    {
        await next();
        return;
    }

    var prefix = (mediaOpts.PublicPathPrefix ?? "/media").TrimEnd('/');
    if (!prefix.StartsWith('/'))
        prefix = "/" + prefix;

    var pathValue = context.Request.Path.Value ?? "";
    if (!pathValue.StartsWith(prefix + "/", StringComparison.OrdinalIgnoreCase))
    {
        await next();
        return;
    }

    var encodedRel = pathValue.AsSpan(prefix.Length).TrimStart('/').ToString();
    if (string.IsNullOrEmpty(encodedRel))
    {
        await next();
        return;
    }

    string rel;
    try
    {
        rel = Uri.UnescapeDataString(encodedRel).Replace('\\', '/').TrimStart('/');
    }
    catch (UriFormatException)
    {
        await next();
        return;
    }

    var physical = LocalMediaStorage.TryResolveStorageFile(rel, mediaServeSearchRoots.ToArray());
    if (physical is null)
    {
        await next();
        return;
    }

    var provider = new FileExtensionContentTypeProvider();
    if (!provider.TryGetContentType(physical, out var contentType))
        contentType = "application/octet-stream";

    context.Response.ContentType = contentType;
    context.Response.Headers.CacheControl = "public, max-age=3600";
    await context.Response.SendFileAsync(physical);
});

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = mediaFiles,
    RequestPath = mediaOpts.PublicPathPrefix
});

app.UseAuthentication();
app.UseAuthorization();

app.MapAuthV1();
app.MapMediaV1();
app.MapLocationsAndInventoryV1();
app.MapCatalogV1();
app.MapStorefrontSponsoredV1();
app.MapAdminPortalV1();
app.MapLookupsV1();
app.MapVendorProductsV1();
app.MapVendorProductWorkspaceV1();

if (app.Environment.IsDevelopment())
    app.MapDevJwt();

app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "commerce-api" }))
    .WithName("Health");

app.MapGet("/api/v1/tenants", async (CommerceDbContext db, CancellationToken ct) =>
{
    var list = await db.Tenants.AsNoTracking().OrderBy(t => t.Slug).ToListAsync(ct);
    return Results.Ok(list);
}).WithName("ListTenants");

app.MapPost("/api/v1/tenants", async (
    Tenant body,
    HttpContext http,
    CommerceDbContext db,
    AuditLogWriter audit,
    CancellationToken ct) =>
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

    db.Tenants.Add(body);
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
        body.Id,
        actor,
        "tenant",
        body.Id,
        new { slug = body.Slug, name = body.Name },
        http,
        ct);

    return Results.Created($"/api/v1/tenants/{Uri.EscapeDataString(body.Id)}", body);
}).RequireAuthorization().WithName("CreateTenant");

app.Run();
