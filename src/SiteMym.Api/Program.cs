using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
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

app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    await app.Services.PrepareDevelopmentDatabaseAsync();
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

app.Run();
