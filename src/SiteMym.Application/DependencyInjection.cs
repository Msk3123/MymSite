using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using SiteMym.Application.Abstractions.Messaging;
using SiteMym.Application.Assistant;
using SiteMym.Application.Common;
using SiteMym.Application.Products.Manage;

namespace SiteMym.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        // Кожен IQueryHandler / ICommandHandler з цієї збірки реєструється автоматично.
        var handlerInterfaces = new[] { typeof(IQueryHandler<,>), typeof(ICommandHandler<,>) };

        var registrations =
            from type in typeof(DependencyInjection).Assembly.DefinedTypes
            where type is { IsAbstract: false, IsInterface: false }
            from contract in type.ImplementedInterfaces
            where contract.IsGenericType && handlerInterfaces.Contains(contract.GetGenericTypeDefinition())
            select (contract, type);

        foreach (var (contract, type) in registrations)
            services.AddScoped(contract, type);

        services.TryAddSingleton(TimeProvider.System);
        services.AddSingleton<ShopClock>();
        services.AddScoped<AssistantTools>();
        services.AddScoped<AssistantActionTools>();
        services.AddScoped<AssistantMemory>();
        services.AddScoped<ProductRemover>();

        return services;
    }
}
