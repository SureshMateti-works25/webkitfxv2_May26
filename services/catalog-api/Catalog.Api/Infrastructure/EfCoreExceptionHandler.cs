using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Catalog.Api.Infrastructure;

/// <summary>Maps EF Core persistence exceptions before the platform fallback handler.</summary>
public sealed class EfCoreExceptionHandler(ILogger<EfCoreExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        if (exception is not DbUpdateException dbEx)
            return false;

        logger.LogWarning(dbEx, "Database update failed");

        var (status, title, detail) = dbEx switch
        {
            DbUpdateConcurrencyException => (
                StatusCodes.Status409Conflict,
                "Concurrency conflict",
                "The record was modified by another request. Reload and retry."),
            _ => (
                StatusCodes.Status409Conflict,
                "Database conflict",
                "A constraint or integrity rule failed.")
        };

        var problem = new ProblemDetails
        {
            Status = status,
            Title = title,
            Detail = detail,
            Instance = httpContext.Request.Path
        };

        httpContext.Response.StatusCode = status;
        await httpContext.Response.WriteAsJsonAsync(problem, cancellationToken);
        return true;
    }
}
