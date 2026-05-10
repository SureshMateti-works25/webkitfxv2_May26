using Microsoft.AspNetCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using WebkitFx.Platform.Media;
using WebkitFx.Platform.Tenancy;
using WebkitFx.Platform.Web;

namespace WebkitFx.Platform;

public static class WebkitFxPlatformServiceCollectionExtensions
{
    /// <summary>Registers tenancy, global exception handling, and local media storage (override IMediaStorage in modules if needed).</summary>
    public static IServiceCollection AddWebkitFxPlatform(this IServiceCollection services)
    {
        services.AddHttpContextAccessor();
        services.AddScoped<ITenantContext, HttpTenantContext>();
        services.AddExceptionHandler<GlobalExceptionHandler>();
        services.AddProblemDetails();

        services.AddSingleton<IMediaStorage, LocalMediaStorage>();

        return services;
    }

    public static IServiceCollection AddWebkitFxPlatform(
        this IServiceCollection services,
        Action<LocalMediaStorageOptions> configureMedia)
    {
        services.AddWebkitFxPlatform();
        services.Configure(configureMedia);
        return services;
    }
}
