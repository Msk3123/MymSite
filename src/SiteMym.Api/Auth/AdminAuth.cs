using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;

namespace SiteMym.Api.Auth;

/// <summary>
/// Секція «Admin». Адмін один — мама, тому без таблиці користувачів:
/// логін і хеш пароля лежать у конфігурації (user-secrets / змінні оточення на сервері).
/// Хеш генерується командою: dotnet run --project src/SiteMym.Api -- hash-password "пароль"
/// </summary>
public sealed class AdminOptions
{
    public const string SectionName = "Admin";

    public string Login { get; set; } = "mama";
    public string? PasswordHash { get; set; }
}

public static class AdminAuth
{
    public const string Policy = "admin";
    public const string LoginRateLimit = "admin-login";
    public const string AssistantRateLimit = "admin-assistant";

    private const string Role = "admin";

    // PasswordHasher з ASP.NET Identity: PBKDF2 + сіль, формат сумісний між версіями.
    private static readonly PasswordHasher<string> Hasher = new();

    public static string HashPassword(string password) => Hasher.HashPassword(Role, password);

    public static bool Verify(AdminOptions options, string login, string password)
    {
        if (string.IsNullOrEmpty(options.PasswordHash))
            return false;

        var loginMatches = CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(login.Trim().ToLowerInvariant()),
            Encoding.UTF8.GetBytes(options.Login.ToLowerInvariant()));

        // Пароль перевіряємо завжди, навіть якщо логін не той, — щоб час відповіді не підказував, що саме не так.
        var passwordMatches = Hasher.VerifyHashedPassword(Role, options.PasswordHash, password) != PasswordVerificationResult.Failed;
        return loginMatches && passwordMatches;
    }

    public static Task SignInAsync(HttpContext context, string login) =>
        context.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(ClaimTypes.Name, login), new Claim(ClaimTypes.Role, Role)],
                CookieAuthenticationDefaults.AuthenticationScheme)),
            new AuthenticationProperties { IsPersistent = true });

    public static IServiceCollection AddAdminAuth(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<AdminOptions>(configuration.GetSection(AdminOptions.SectionName));

        services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
            .AddCookie(options =>
            {
                options.Cookie.Name = "msh_admin";
                options.Cookie.HttpOnly = true;
                // Strict: кука не їде з чужих сайтів — це й захист від CSRF для форм і завантаження фото.
                options.Cookie.SameSite = SameSiteMode.Strict;
                options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
                // Мама не має вводити пароль: пів року, і термін подовжується щоразу, коли вона заходить.
                // Тобто поки вона хоч раз на пів року відкриває кабінет — пароль більше не спитають.
                options.ExpireTimeSpan = TimeSpan.FromDays(180);
                options.SlidingExpiration = true;
                // Це API — замість редіректу на сторінку входу віддаємо 401/403, а фронт сам покаже форму.
                options.Events.OnRedirectToLogin = ctx =>
                {
                    ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    return Task.CompletedTask;
                };
                options.Events.OnRedirectToAccessDenied = ctx =>
                {
                    ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
                    return Task.CompletedTask;
                };
            });

        services.AddAuthorizationBuilder()
            .AddPolicy(Policy, policy => policy.RequireRole(Role));

        return services;
    }
}
