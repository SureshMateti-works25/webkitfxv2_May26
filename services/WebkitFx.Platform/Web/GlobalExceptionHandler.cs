using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace WebkitFx.Platform.Web;

/// <summary>Maps unhandled exceptions to RFC 7807-style JSON for consistent clients (web + JSON engine hosts).</summary>
/// <remarks>Register additional <see cref="IExceptionHandler"/> implementations in host apps for EF/database-specific mapping.</remarks>
public sealed class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        logger.LogError(exception, "Unhandled exception");

        var (status, title, detail) = exception switch
        {
            ArgumentException ax => (
                StatusCodes.Status400BadRequest,
                "Invalid argument",
                ax.Message),
            InvalidOperationException ix => (
                StatusCodes.Status400BadRequest,
                "Invalid operation",
                ix.Message),
            KeyNotFoundException kx => (
                StatusCodes.Status404NotFound,
                "Not found",
                kx.Message),
            UnauthorizedAccessException => (
                StatusCodes.Status403Forbidden,
                "Forbidden",
                "You are not allowed to perform this action."),
            _ => (
                StatusCodes.Status500InternalServerError,
                "Server error",
                "An unexpected error occurred.")
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
