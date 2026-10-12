using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using SiteMym.Application.Abstractions.Ai;
using SiteMym.Application.Abstractions.Persistence;
using SiteMym.Application.Abstractions.Storage;
using SiteMym.Infrastructure.Ai;
using SiteMym.Infrastructure.Persistence;
using SiteMym.Infrastructure.Persistence.Repositories;
using SiteMym.Infrastructure.Persistence.Seed;
using SiteMym.Infrastructure.Storage;

namespace SiteMym.Infrastructure;

public static class DependencyInjection
{
    public const string ConnectionStringName = "Database";

    /// <param name="contentRootPath">Корінь API-проєкту — від нього рахується відносний шлях до папки з фото.</param>
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services, IConfiguration configuration, string contentRootPath)
    {
        var connectionString = configuration.GetConnectionString(ConnectionStringName)
            ?? throw new InvalidOperationException(
                $"Connection string '{ConnectionStringName}' is missing. Set ConnectionStrings:{ConnectionStringName} (user-secrets or env).");

        services.AddDbContext<AppDbContext>(options => options
            .UseNpgsql(connectionString, npgsql => npgsql.MigrationsHistoryTable("__ef_migrations_history"))
            .UseSnakeCaseNamingConvention());

        services.AddScoped<IUnitOfWork>(sp => sp.GetRequiredService<AppDbContext>());
        services.AddScoped<IProductRepository, ProductRepository>();
        services.AddScoped<IOrderRepository, OrderRepository>();
        services.AddScoped<IAssistantNoteRepository, AssistantNoteRepository>();

        services.AddHealthChecks().AddDbContextCheck<AppDbContext>("database");

        services.Configure<LocalStorageOptions>(configuration.GetSection(LocalStorageOptions.SectionName));
        services.PostConfigure<LocalStorageOptions>(o => o.RootPath = Path.GetFullPath(o.LocalPath, contentRootPath));
        services.AddSingleton<IFileStorage, LocalFileStorage>();

        services.Configure<OpenAiOptions>(configuration.GetSection(OpenAiOptions.SectionName));
        services.AddHttpClient<IChatModel, OpenAiChatModel>((sp, http) =>
        {
            var openAi = sp.GetRequiredService<IOptions<OpenAiOptions>>().Value;
            http.BaseAddress = new Uri(openAi.BaseUrl.TrimEnd('/') + "/");
            http.Timeout = TimeSpan.FromSeconds(openAi.TimeoutSeconds);
        });

        return services;
    }

    /// <summary>Накатує міграції. Для одного сервера найпростіше робити це при старті.</summary>
    public static async Task MigrateDatabaseAsync(this IServiceProvider services)
    {
        await using var scope = services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.MigrateAsync();
    }

    /// <summary>Накатує міграції й заповнює порожню базу тестовими речами. Лише для Development.</summary>
    public static async Task PrepareDevelopmentDatabaseAsync(this IServiceProvider services)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync();
        await DevelopmentSeeder.SeedAsync(db);
    }
}
