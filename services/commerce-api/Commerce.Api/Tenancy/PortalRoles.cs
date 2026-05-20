namespace Commerce.Api.Tenancy;

public static class PortalRoles
{
    public const string Shopper = "shopper";
    public const string Vendor = "vendor";
    public const string Admin = "admin";

    public static bool IsKnown(string? role) =>
        role is Shopper or Vendor or Admin;

    public static bool CanSelfRegister(string? role) =>
        role is Shopper or Vendor;
}
