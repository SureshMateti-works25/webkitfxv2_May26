namespace WebkitFx.Platform.Tenancy;

public static class TenantConstants
{
    /// <summary>Preferred tenant id on every request (BFF and mobile).</summary>
    public const string HeaderName = "X-Tenant-Id";

    /// <summary>HttpContext.Items key for resolved tenant.</summary>
    public const string HttpContextItemKey = "webkitfx.tenant_id";
}
