using Commerce.Api.Audit;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Commerce.Api.Infrastructure;

/// <summary>Maps EF Core persistence exceptions before the platform fallback handler.</summary>
public sealed class EfCoreExceptionHandler(
    ILogger<EfCoreExceptionHandler> logger,
    IServiceScopeFactory scopeFactory) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        if (exception is not DbUpdateException dbEx)
            return false;

        logger.LogWarning(dbEx, "Database update failed");

        try
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var audit = scope.ServiceProvider.GetRequiredService<AuditLogWriter>();
            await audit.RecordAsync(
                AuditActions.DataConstraintFailure,
                "failure",
                tenantId: null,
                actorUserId: AuditLogWriter.ActorFromPrincipal(httpContext.User),
                resourceType: "database",
                resourceId: httpContext.Request.Path.Value,
                detail: new { exceptionType = dbEx.GetType().Name },
                httpContext,
                cancellationToken);
        }
        catch (Exception auditEx)
        {
            logger.LogWarning(auditEx, "Failed to write audit row for DbUpdateException");
        }

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
