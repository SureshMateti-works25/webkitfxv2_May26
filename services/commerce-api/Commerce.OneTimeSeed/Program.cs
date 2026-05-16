using Commerce.Api.Data;
using Commerce.Api.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

static string? Env(params string[] keys)
{
    foreach (var k in keys)
    {
        var v = Environment.GetEnvironmentVariable(k);
        if (!string.IsNullOrWhiteSpace(v))
            return v.Trim();
    }

    return null;
}

var connectionString =
    Env("ConnectionStrings__Commerce", "COMMERCE_DATABASE_CONNECTION_STRING")
    ?? throw new InvalidOperationException(
        "Set ConnectionStrings__Commerce or COMMERCE_DATABASE_CONNECTION_STRING to the target PostgreSQL Npgsql connection string.");

var mediaRootInput = Env("SEED_MEDIA_ROOT");
string mediaRootAbsolute;
if (!string.IsNullOrWhiteSpace(mediaRootInput))
{
    mediaRootAbsolute = Path.GetFullPath(mediaRootInput!);
}
else
{
    mediaRootAbsolute = Path.GetFullPath(
        Path.Combine(Path.GetTempPath(), "commerce-one-time-seed-media"));
}

Directory.CreateDirectory(mediaRootAbsolute);

var services = new ServiceCollection();
services.AddLogging(b =>
    b.AddSimpleConsole(o =>
    {
        o.SingleLine = true;
        o.TimestampFormat = "HH:mm:ss ";
    }).SetMinimumLevel(LogLevel.Information));
services.AddDbContext<CommerceDbContext>(o => o.UseNpgsql(connectionString));
services.AddSingleton<IPasswordHasher<PortalUser>, PasswordHasher<PortalUser>>();

var configuration = new ConfigurationBuilder()
    .AddEnvironmentVariables()
    .Build();
services.AddSingleton<IConfiguration>(configuration);

await using var provider = services.BuildServiceProvider();
var log = provider.GetRequiredService<ILoggerFactory>().CreateLogger("Commerce.OneTimeSeed");
var db = provider.GetRequiredService<CommerceDbContext>();

log.LogInformation("Target database: host parsed from connection string (migrations next).");
log.LogInformation("Media folder (JPEGs written here for /media keys): {Path}", mediaRootAbsolute);

log.LogInformation("Applying EF Core migrations…");
await db.Database.MigrateAsync();

if (string.Equals(Env("SEED_CLEAR_TENANT"), "true", StringComparison.OrdinalIgnoreCase))
{
    log.LogWarning("SEED_CLEAR_TENANT=true — removing tenant t1 catalog + lookup rows (portal users kept).");
    await CommerceDevDataSeeder.ClearTenantCatalogDataAsync(db);
}

if (!await db.Tenants.AnyAsync())
{
    db.Tenants.Add(new Tenant { Id = "t1", Name = "Acme Sarees", Slug = "acme" });
    await db.SaveChangesAsync();
    log.LogInformation("Inserted default tenant t1.");
}
else
    log.LogInformation("Tenant row(s) already present; skipping default tenant insert.");

// Same order as Commerce.Api Program.cs (Development bootstrap).
await CommerceDevDataSeeder.EnsureConfigurableLookupSeedAsync(db);
await CommerceDevDataSeeder.EnsureProductTypesLookupAndLinkCategoriesParentAsync(db);
await CommerceDevDataSeeder.EnsureAppTypeLookupSeedAsync(db);
await CommerceDevDataSeeder.RemoveGroceryProduceDairyDemoDepartmentValuesAsync(db, CancellationToken.None);
await CommerceDevDataSeeder.EnsureDevSareeProductCategoryLookupsAsync(db);
await CommerceDevDataSeeder.EnsureProductCategoryLookupParentTypesAsync(db);
await CommerceDevDataSeeder.SeedAsync(db);
await CommerceDevDataSeeder.EnsureOperationalSeedAsync(db);
await CommerceDevDataSeeder.EnsureDemoProductCardPricingAsync(db);
await CommerceDevDataSeeder.EnsureDemoProductColorGalleryAsync(db);
await CommerceDevDataSeeder.EnsureKalamkariCategoryAsync(db);
await CommerceDevDataSeeder.EnsureLegacySareeProductTypeAsync(db);
await CommerceDevDataSeeder.EnsureGroceryCatalogDevSeedAsync(db, mediaRootAbsolute, CancellationToken.None);
await CommerceDevDataSeeder.EnsureProductCategoryLookupParentTypesAsync(db);
await CommerceDevDataSeeder.EnsureStorefrontSponsoredDevSeedAsync(db);

var passwordHasher = provider.GetRequiredService<IPasswordHasher<PortalUser>>();
await CommerceDevDataSeeder.EnsureDevSiteAdminAsync(db, passwordHasher, configuration, log, CancellationToken.None);

CommerceDevDataSeeder.EnsureSeedHeroMediaBlobExists(mediaRootAbsolute);

log.LogInformation("Seed complete. Products: {Count}", await db.Products.CountAsync());
log.LogInformation(
    "Next: copy this folder under your App Service wwwroot as uploads/media (see README) or run scripts/push-commerce-seed-media-to-azure.ps1.");
