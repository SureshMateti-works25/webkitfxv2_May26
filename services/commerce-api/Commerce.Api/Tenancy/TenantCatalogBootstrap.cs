using System.Text.Json;
using Commerce.Api.Data;
using Commerce.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Commerce.Api.Tenancy;

public static class TenantCatalogBootstrap
{
    public static async Task EnsureCatalogTenantsAsync(CommerceDbContext db, CancellationToken ct = default)
    {
        var catalog = TenantCatalogDocument.LoadEmbedded();
        foreach (var entry in catalog.Tenants)
        {
            if (string.IsNullOrWhiteSpace(entry.Id))
                continue;

            var existing = await db.Tenants.FirstOrDefaultAsync(t => t.Id == entry.Id, ct);
            var hostJson = entry.HostAliases is { Count: > 0 }
                ? JsonSerializer.Serialize(entry.HostAliases)
                : null;

            if (existing is null)
            {
                db.Tenants.Add(new Tenant
                {
                    Id = entry.Id.Trim(),
                    Name = entry.Name.Trim(),
                    Slug = entry.Slug.Trim().ToLowerInvariant(),
                    StorefrontMode = NormalizeMode(entry.StorefrontMode),
                    Vertical = string.IsNullOrWhiteSpace(entry.Vertical) ? null : entry.Vertical.Trim(),
                    IsActive = entry.IsActive,
                    CreatedAt = DateTimeOffset.UtcNow,
                    HostAliasesJson = hostJson
                });
                continue;
            }

            existing.Name = entry.Name.Trim();
            existing.Slug = entry.Slug.Trim().ToLowerInvariant();
            existing.StorefrontMode = NormalizeMode(entry.StorefrontMode);
            existing.Vertical = string.IsNullOrWhiteSpace(entry.Vertical) ? null : entry.Vertical.Trim();
            existing.IsActive = entry.IsActive;
            if (hostJson is not null)
                existing.HostAliasesJson = hostJson;
        }

        await db.SaveChangesAsync(ct);
    }

    private static string NormalizeMode(string? mode) =>
        StorefrontModes.IsKnown(mode) ? mode!.Trim().ToLowerInvariant() : StorefrontModes.IsolatedShop;
}
