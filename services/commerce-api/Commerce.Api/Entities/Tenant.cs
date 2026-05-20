namespace Commerce.Api.Entities;

public sealed class Tenant
{
    public required string Id { get; set; }
    public required string Name { get; set; }
    public required string Slug { get; set; }

    /// <summary><c>marketplace</c> or <c>isolated_shop</c>.</summary>
    public string StorefrontMode { get; set; } = Tenancy.StorefrontModes.IsolatedShop;

    /// <summary>Optional vertical hint: <c>cafe</c>, <c>sarees</c>, <c>grocery</c>, etc.</summary>
    public string? Vertical { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>JSON array of hostnames (without port) for <c>/api/v1/tenants/by-host</c>.</summary>
    public string? HostAliasesJson { get; set; }
}
