using System.Security.Claims;
using Commerce.Api.Tenancy;
using Microsoft.AspNetCore.Authorization;

namespace Commerce.Api.Auth;

public sealed class PermissionRequirement(string permission) : IAuthorizationRequirement
{
    public string Permission { get; } = permission;
}

public sealed class PermissionAuthorizationHandler(
    IServiceScopeFactory scopeFactory,
    IHttpContextAccessor httpContextAccessor) : AuthorizationHandler<PermissionRequirement>
{
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PermissionRequirement requirement)
    {
        var permissionRole =
            context.User.FindFirstValue(CommerceClaimTypes.PermissionRole)
            ?? context.User.FindFirstValue(ClaimTypes.Role);
        if (string.IsNullOrWhiteSpace(permissionRole))
            return;

        var http = httpContextAccessor.HttpContext;
        var storefrontMode =
            context.User.FindFirstValue("storefront_mode")
            ?? http?.Items[TenantRequestContextMiddleware.StorefrontModeItemKey] as string
            ?? StorefrontModes.IsolatedShop;

        var tenantId = context.User.FindFirstValue(CommerceClaimTypes.TenantId);

        await using var scope = scopeFactory.CreateAsyncScope();
        var rbac = scope.ServiceProvider.GetRequiredService<TenantRbacEvaluator>();

        if (string.IsNullOrWhiteSpace(tenantId))
        {
            if (rbac.HasManifestPermission(permissionRole, storefrontMode, requirement.Permission))
                context.Succeed(requirement);
            return;
        }

        if (await rbac.HasPermissionAsync(tenantId, permissionRole, storefrontMode, requirement.Permission))
            context.Succeed(requirement);
    }
}

public static class PermissionPolicyNames
{
    public const string Prefix = "Permission:";
    public static string For(string permission) => Prefix + permission;
}

public static class PermissionAuthorizationExtensions
{
    public static IServiceCollection AddCommercePermissionAuthorization(this IServiceCollection services)
    {
        services.AddSingleton<IAuthorizationHandler, PermissionAuthorizationHandler>();
        return services;
    }

    public static AuthorizationOptions AddCommercePermissionPolicies(
        this AuthorizationOptions options,
        TenantRbacService rbac)
    {
        foreach (var permission in rbac.AllPermissionIds())
        {
            var policyName = PermissionPolicyNames.For(permission);
            options.AddPolicy(policyName, p =>
                p.RequireAuthenticatedUser()
                    .AddRequirements(new PermissionRequirement(permission)));
        }

        return options;
    }
}
