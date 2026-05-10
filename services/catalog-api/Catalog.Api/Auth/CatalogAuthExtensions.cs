using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

namespace Catalog.Api.Auth;

public static class CatalogAuthExtensions
{
    public static IServiceCollection AddCatalogJwtAuthentication(this IServiceCollection services, IConfiguration configuration)
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
                    ValidIssuer = jwtSection["Issuer"] ?? "webkitfx-catalog",
                    ValidateAudience = true,
                    ValidAudience = jwtSection["Audience"] ?? "webkitfx-clients",
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.FromMinutes(2)
                };
            });

        services.AddAuthorization();
        return services;
    }
}
