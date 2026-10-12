using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace SiteMym.Api.Middleware;

public sealed class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        // Кривий JSON або невідоме значення enum у тілі запиту — це помилка клієнта, а не сервера.
        var problem = exception is BadHttpRequestException badRequest
            ? new ProblemDetails { Status = badRequest.StatusCode, Title = "Некоректний запит" }
            : new ProblemDetails { Status = StatusCodes.Status500InternalServerError, Title = "Server error" };

        if (problem.Status == StatusCodes.Status500InternalServerError)
            logger.LogError(exception, "Unhandled exception");
        else
            logger.LogInformation("Bad request: {Message}", exception.Message);

        context.Response.StatusCode = problem.Status!.Value;
        await context.Response.WriteAsJsonAsync(problem, ct);
        return true;
    }
}
