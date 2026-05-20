namespace Commerce.Api.Tenancy;

public static class StorefrontModes
{
    public const string Marketplace = "marketplace";
    public const string IsolatedShop = "isolated_shop";

    public static bool IsKnown(string? mode) =>
        string.Equals(mode, Marketplace, StringComparison.Ordinal)
        || string.Equals(mode, IsolatedShop, StringComparison.Ordinal);
}
