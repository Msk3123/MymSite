using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Extensions.Options;
using SiteMym.Api.Auth;
using SiteMym.Application.Common;

namespace SiteMym.Api.Endpoints.Admin;

public sealed record LoginRequest(string Login, string Password);

public sealed record AdminMe(string Login, string OwnerName, string GreetingName);

public sealed class AuthEndpoints : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var admin = app.MapGroup("/admin").WithTags("Admin: auth");

        admin.MapPost("/login", async (
            LoginRequest request,
            HttpContext context,
            IOptions<AdminOptions> options,
            IOptions<ShopSettings> shop,
            ILogger<AuthEndpoints> logger) =>
        {
            if (!AdminAuth.Verify(options.Value, request.Login ?? string.Empty, request.Password ?? string.Empty))
            {
                logger.LogWarning("Failed admin login from {Ip}", context.Connection.RemoteIpAddress);
                return Results.Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Невірний логін або пароль");
            }

            await AdminAuth.SignInAsync(context, options.Value.Login);
            return Results.Ok(new AdminMe(options.Value.Login, shop.Value.OwnerName, shop.Value.OwnerNameVocative));
        })
        .RequireRateLimiting(AdminAuth.LoginRateLimit)
        .WithSummary("Вхід в адмінку (кука на 30 днів)");

        admin.MapPost("/logout", async (HttpContext context) =>
        {
            await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Results.NoContent();
        });

        admin.MapGet("/me", (HttpContext context, IOptions<ShopSettings> shop) =>
            Results.Ok(new AdminMe(context.User.Identity!.Name!, shop.Value.OwnerName, shop.Value.OwnerNameVocative)))
        .RequireAuthorization(AdminAuth.Policy)
        .WithSummary("Хто залогінений — фронт перевіряє це при відкритті адмінки");
    }
}
