namespace Commerce.Api.Audit;

/// <summary>Stable action identifiers for <see cref="Entities.AuditLog"/>.</summary>
public static class AuditActions
{
    public const string AuthRegister = "auth.register";
    public const string AuthLogin = "auth.login";
    public const string AuthPasswordChange = "auth.password_change";
    public const string AuthPasswordForgot = "auth.password_forgot";
    public const string AuthJwtFailed = "auth.jwt_failed";
    public const string AuthJwtChallenge = "auth.jwt_challenge";
    public const string AuthDevJwt = "auth.dev_jwt";
    public const string TenantMissing = "tenant.missing";
    public const string TenantCreate = "tenant.create";
    public const string MediaUpload = "media.upload";
    public const string MediaDelete = "media.delete";
    public const string CatalogProductMutate = "catalog.product_mutate";
    public const string DataConstraintFailure = "data.constraint_failure";
    public const string BootstrapMigrate = "bootstrap.migrate";
    public const string LookupMutate = "lookup.mutate";
    public const string StorefrontSponsorMutate = "storefront.sponsor_mutate";
    public const string PortalUserMutate = "portal_user.mutate";
}
