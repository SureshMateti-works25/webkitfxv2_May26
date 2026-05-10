using Catalog.Api.Auth;
using Catalog.Api.Catalog;
using Catalog.Api.Data;
using Catalog.Api.Entities;
using Microsoft.AspNetCore.Identity;
using Catalog.Api.Features;
using Catalog.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using WebkitFx.Platform;
using WebkitFx.Platform.Media;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<LocalMediaStorageOptions>(builder.Configuration.GetSection("Media"));

builder.Services.AddExceptionHandler<EfCoreExceptionHandler>();
builder.Services.AddWebkitFxPlatform();

builder.Services.AddDbContext<CatalogDbContext>(options =>
{
    var cs = builder.Configuration.GetConnectionString("Catalog")
        ?? throw new InvalidOperationException("Connection string 'Catalog' is missing. Use appsettings, User Secrets, or env ConnectionStrings__Catalog.");
    options.UseNpgsql(cs);
});

builder.Services.AddCatalogJwtAuthentication(builder.Configuration);

builder.Services.AddSingleton<PortalJwtIssuer>();
builder.Services.AddSingleton<IPasswordHasher<PortalUser>, PasswordHasher<PortalUser>>();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        var origins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>()
            ?? ["http://localhost:5175", "http://127.0.0.1:5175"];
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
        var db = scope.ServiceProvider.GetRequiredService<CatalogDbContext>();
        await db.Database.MigrateAsync();
        if (!await db.Tenants.AnyAsync())
        {
            db.Tenants.Add(new Tenant { Id = "t1", Name = "Acme Sarees", Slug = "acme" });
            await db.SaveChangesAsync();
        }

        await CatalogDevDataSeeder.SeedAsync(db);
        await CatalogDevDataSeeder.EnsureOperationalSeedAsync(db);
    }
}

app.UseWebkitFxPlatform();
app.UseHttpsRedirection();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

var mediaOpts = app.Configuration.GetSection("Media").Get<LocalMediaStorageOptions>() ?? new LocalMediaStorageOptions();
var mediaRoot = Path.GetFullPath(mediaOpts.RootPath);
Directory.CreateDirectory(mediaRoot);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(mediaRoot),
    RequestPath = mediaOpts.PublicPathPrefix
});

app.MapAuthV1();
app.MapMediaV1();
app.MapLocationsAndInventoryV1();
app.MapCatalogV1();

if (app.Environment.IsDevelopment())
    app.MapDevJwt();

app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "catalog-api" }))
    .WithName("Health");

app.MapGet("/api/v1/tenants", async (CatalogDbContext db, CancellationToken ct) =>
{
    var list = await db.Tenants.AsNoTracking().OrderBy(t => t.Slug).ToListAsync(ct);
    return Results.Ok(list);
}).WithName("ListTenants");

app.MapPost("/api/v1/tenants", async (Tenant body, CatalogDbContext db, CancellationToken ct) =>
{
    if (string.IsNullOrWhiteSpace(body.Id) || string.IsNullOrWhiteSpace(body.Name) || string.IsNullOrWhiteSpace(body.Slug))
        return Results.BadRequest(new { error = "id, name, and slug are required" });

    db.Tenants.Add(body);
    try
    {
        await db.SaveChangesAsync(ct);
    }
    catch (DbUpdateException)
    {
        return Results.Conflict(new { error = "duplicate id or slug" });
    }

    return Results.Created($"/api/v1/tenants/{Uri.EscapeDataString(body.Id)}", body);
}).RequireAuthorization().WithName("CreateTenant");

app.Run();
