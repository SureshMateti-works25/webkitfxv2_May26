using Commerce.Api.Audit;
using Commerce.Api.Auth;
using Commerce.Api.Catalog;
using Commerce.Api.Data;
using Commerce.Api.Entities;
using Microsoft.AspNetCore.Identity;
using Commerce.Api.Features;
using Commerce.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using WebkitFx.Platform;
using WebkitFx.Platform.Media;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<LocalMediaStorageOptions>(builder.Configuration.GetSection("Media"));

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<AuditLogWriter>();

builder.Services.AddExceptionHandler<EfCoreExceptionHandler>();
builder.Services.AddWebkitFxPlatform();

builder.Services.AddDbContext<CommerceDbContext>(options =>
{
    var cs = builder.Configuration.GetConnectionString("Commerce")
        ?? throw new InvalidOperationException("Connection string 'Commerce' is missing. Use appsettings, User Secrets, or env ConnectionStrings__Commerce.");
    options.UseNpgsql(cs);
});

builder.Services.AddCommerceJwtAuthentication(builder.Configuration);

builder.Services.AddSingleton<PortalJwtIssuer>();
builder.Services.AddSingleton<IPasswordHasher<PortalUser>, PasswordHasher<PortalUser>>();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        var origins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>()
            ?? [
                "http://localhost:5175", "http://127.0.0.1:5175",
                "http://localhost:5176", "http://127.0.0.1:5176",
                "http://localhost:5177", "http://127.0.0.1:5177",
                "http://localhost:5178", "http://127.0.0.1:5178",
                "http://localhost:5179", "http://127.0.0.1:5179",
                "http://localhost:5180", "http://127.0.0.1:5180",
                "http://localhost:5181", "http://127.0.0.1:5181",
                "http://localhost:5182", "http://127.0.0.1:5182"
            ];
        policy.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod();
    });
});

builder.Services.AddOpenApi();

var app = builder.Build();

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

        await CommerceDevDataSeeder.SeedAsync(db);
        await CommerceDevDataSeeder.EnsureOperationalSeedAsync(db);
        await CommerceDevDataSeeder.EnsureDemoProductCardPricingAsync(db);

        var mediaRootForSeed = Path.GetFullPath(Path.Combine(
            app.Environment.ContentRootPath,
            builder.Configuration.GetSection("Media").Get<LocalMediaStorageOptions>()?.RootPath ?? "uploads/media"));
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
var mediaRoot = Path.GetFullPath(mediaOpts.RootPath);
Directory.CreateDirectory(mediaRoot);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(mediaRoot),
    RequestPath = mediaOpts.PublicPathPrefix
});

app.UseAuthentication();
app.UseAuthorization();

app.MapAuthV1();
app.MapMediaV1();
app.MapLocationsAndInventoryV1();
app.MapCatalogV1();
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
