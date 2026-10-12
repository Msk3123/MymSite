using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace SiteMym.Api.HealthChecks;

public static class HealthResponse
{
    /// <summary>{ "status": "Healthy", "checks": { "database": "Healthy" } }</summary>
    public static Task WriteAsync(HttpContext context, HealthReport report) =>
        context.Response.WriteAsJsonAsync(new
        {
            status = report.Status.ToString(),
            checks = report.Entries.ToDictionary(e => e.Key, e => e.Value.Status.ToString())
        });
}
