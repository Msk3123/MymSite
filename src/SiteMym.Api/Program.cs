using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;
using SiteMym.Api.Auth;
using SiteMym.Api.Common;
using SiteMym.Api.Endpoints;
using SiteMym.Api.HealthChecks;
using SiteMym.Api.Middleware;
using SiteMym.Application;
using SiteMym.Application.Common;
using SiteMym.Infrastructure;
using SiteMym.Infrastructure.Storage;

// Хеш пароля для адмінки: dotnet run --project src/SiteMym.Api -- hash-password "пароль"
if (args is ["hash-password", var plainPassword])
{
    Console.WriteLine(AdminAuth.HashPassword(plainPassword));
    return;
}

const string ClientCorsPolicy = "client";

var builder = WebApplication.CreateBuilder(args);

if (!builder.Environment.IsDevelopment())
{
    // Запуск «на бою» на власному комп'ютері: ключ OpenAI лежить у user-secrets (Development їх підключає сам).
    // Змінні оточення додаємо ще раз, щоб вони мали перевагу над секретами.
    builder.Configuration.AddUserSecrets<Program>(optional: true);
    builder.Configuration.AddEnvironmentVariables();
}

// Сайт стоїть за проксі (Cloudflare Tunnel / Caddy): справжні IP покупців і https беремо із заголовків.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto);

builder.Services.Configure<ShopSettings>(builder.Configuration.GetSection(ShopSettings.SectionName));

builder.Services
    .AddApplication()
    .AddInfrastructure(builder.Configuration, builder.Environment.ContentRootPath);

// Enum-и в JSON — як на фронті: "autumn-winter", "like-new", "cash-on-delivery".
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter(KebabEnum.Policy, allowIntegerValues: false)));

builder.Services.AddAdminAuth(builder.Configuration);

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = (context, ct) => new ValueTask(context.HttpContext.Response.WriteAsJsonAsync(
        new ProblemDetails { Status = StatusCodes.Status429TooManyRequests, Title = "Забагато спроб. Зачекайте хвилинку" }, ct));

    // Підбір пароля: 5 спроб на хвилину з однієї адреси.
    options.AddPolicy(AdminAuth.LoginRateLimit, http => RateLimitPartition.GetFixedWindowLimiter(
        http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromMinutes(1) }));

    // Кожне питання помічнику коштує грошей — не більше 15 на хвилину.
    options.AddPolicy(AdminAuth.AssistantRateLimit, http => RateLimitPartition.GetFixedWindowLimiter(
        http.User.Identity?.Name ?? "anonymous",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 15, Window = TimeSpan.FromMinutes(1) }));
});

builder.Services.AddEndpoints(typeof(Program).Assembly);
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();

builder.Services.AddCors(options => options.AddPolicy(ClientCorsPolicy, policy => policy
    .WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? [])
    .AllowAnyHeader()
    .AllowAnyMethod()));

var app = builder.Build();

app.UseForwardedHeaders();
app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    await app.Services.PrepareDevelopmentDatabaseAsync();
}
else
{
    // На бою — лише міграції, без тестових речей.
    await app.Services.MigrateDatabaseAsync();
}

if (string.IsNullOrEmpty(app.Services.GetRequiredService<IOptions<AdminOptions>>().Value.PasswordHash))
    app.Logger.LogWarning("Admin:PasswordHash is not set — nobody can log in to /admin. See README.");

// Фото речей. Імена файлів унікальні й не змінюються, тож браузер може кешувати їх назавжди.
var storage = app.Services.GetRequiredService<IOptions<LocalStorageOptions>>().Value;
Directory.CreateDirectory(storage.RootPath);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(storage.RootPath),
    RequestPath = storage.PublicPath,
    OnPrepareResponse = ctx => ctx.Context.Response.Headers.CacheControl = "public, max-age=31536000, immutable"
});

app.UseCors(ClientCorsPolicy);
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapHealthChecks("/api/health", new() { ResponseWriter = HealthResponse.WriteAsync });
app.MapEndpoints();

// Один процес на все: якщо задано Client:DistPath (зібраний React), API роздає й сайт.
// У розробці фронт крутиться на Vite (localhost:5173), і цей блок не потрібен.
if (app.Configuration["Client:DistPath"] is { Length: > 0 } distSetting)
{
    var dist = Path.GetFullPath(distSetting, app.Environment.ContentRootPath);
    if (File.Exists(Path.Combine(dist, "index.html")))
    {
        var files = new PhysicalFileProvider(dist);
        app.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = files,
            // Файли з хешем в імені (assets/index-abc123.js) не змінюються — кешуємо назавжди.
            OnPrepareResponse = ctx =>
            {
                if (ctx.Context.Request.Path.StartsWithSegments("/assets"))
                    ctx.Context.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
            }
        });
        // Невідомий /api/… — це 404, а не сторінка сайту.
        app.Map("/api/{**rest}", () => Results.NotFound());
        // Будь-яка інша адреса (/catalog, /admin/orders/1001) — це маршрут React.
        app.MapFallbackToFile("index.html", new StaticFileOptions
        {
            FileProvider = files,
            OnPrepareResponse = ctx => ctx.Context.Response.Headers.CacheControl = "no-cache"
        });
    }
    else
    {
        app.Logger.LogWarning("Client:DistPath {Path} has no index.html — run `npm run build` in client/", dist);
    }
}

app.Run();
