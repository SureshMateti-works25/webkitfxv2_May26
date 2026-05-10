using Microsoft.AspNetCore.Builder;
using WebkitFx.Platform.Tenancy;

namespace WebkitFx.Platform;

public static class WebkitFxPlatformApplicationBuilderExtensions
{
    /// <summary>Use after routing setup; before endpoint mapping. Enables ProblemDetails + tenant resolution.</summary>
    public static IApplicationBuilder UseWebkitFxPlatform(this IApplicationBuilder app)
    {
        app.UseExceptionHandler();
        app.UseTenantResolution();
        return app;
    }
}
