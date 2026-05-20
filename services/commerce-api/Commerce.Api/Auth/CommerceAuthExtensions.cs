using System.Text;
using Commerce.Api.Audit;
using Commerce.Api.Tenancy;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.IdentityModel.Tokens;

namespace Commerce.Api.Auth;

public static class CommerceAuthExtensions
{
    public static IServiceCollection AddCommerceJwtAuthentication(this IServiceCollection services, IConfiguration configuration)
    {
        var jwtSection = configuration.GetSection(JwtOptions.SectionName);
        services.Configure<JwtOptions>(jwtSection);

        var signingKey = jwtSection["SigningKey"];
        if (string.IsNullOrWhiteSpace(signingKey))
        {
            throw new InvalidOperationException(
                $"Configure {JwtOptions.SectionName}:SigningKey (UTF-8 secret for HS256). Use User Secrets or environment Jwt__SigningKey.");
        }

        var keyBytes = Encoding.UTF8.GetBytes(signingKey);
        if (keyBytes.Length < 32)
        {
            throw new InvalidOperationException(
                $"{JwtOptions.SectionName}:SigningKey must decode to at least 32 bytes for HS256.");
        }

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(keyBytes),
                    ValidateIssuer = true,
                    ValidIssuer = jwtSection["Issuer"] ?? "webkitfx-commerce",
                    ValidateAudience = true,
                    ValidAudience = jwtSection["Audience"] ?? "webkitfx-clients",
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.FromMinutes(2)
                };

                options.Events = new JwtBearerEvents
                {
                    OnAuthenticationFailed = async context =>
                    {
                        var audit = context.HttpContext.RequestServices.GetService<AuditLogWriter>();
                        if (audit is null)
                            return;

                        var reason = context.Exception?.GetType().Name ?? "authentication_failed";
                        var message = context.Exception?.Message;
                        if (message is { Length: > 200 })
                            message = message[..200];

                        await audit.RecordAsync(
                            AuditActions.AuthJwtFailed,
                            "failure",
                            tenantId: null,
                            actorUserId: null,
                            resourceType: "jwt",
                            resourceId: context.Request.Path.Value,
                            detail: new { reason, message },
                            context.HttpContext,
                            context.HttpContext.RequestAborted);
                    },
                    OnChallenge = async context =>
                    {
                        if (context.Handled || context.AuthenticateFailure != null)
                            return;

                        if (!string.IsNullOrEmpty(context.Request.Headers.Authorization.ToString()))
                            return;

                        var audit = context.HttpContext.RequestServices.GetService<AuditLogWriter>();
                        if (audit is null)
                            return;

                        await audit.RecordAsync(
                            AuditActions.AuthJwtChallenge,
                            "failure",
                            tenantId: null,
                            actorUserId: null,
                            resourceType: "jwt",
                            resourceId: context.Request.Path.Value,
                            detail: new { reason = "missing_bearer" },
                            context.HttpContext,
                            context.HttpContext.RequestAborted);
                    }
                };
            });

        services.AddSingleton<TenantRbacService>();
        services.AddScoped<TenantRbacEvaluator>();
        services.AddCommercePermissionAuthorization();

        services.AddAuthorization(o =>
        {
            o.AddPolicy("Vendor", p => p.RequireRole("vendor"));
            o.AddPolicy("Admin", p => p.RequireRole("admin"));
            o.AddPolicy("Shopper", p => p.RequireRole("shopper"));

            var rbac = new TenantRbacService();
            o.AddCommercePermissionPolicies(rbac);
        });
        return services;
    }
}
