using SiteMym.Application.Abstractions.Messaging;
using SiteMym.Application.Abstractions.Persistence;
using SiteMym.Domain.Common;

namespace SiteMym.Application.Products.CountProducts;

/// <summary>Лічильники у фільтрах: «Показати 12 речей», «Як нове · 4», «Поруч є…».</summary>
public sealed record CountProductsQuery(ProductFilter Filter) : IQuery<int>;

internal sealed class CountProductsQueryHandler(IProductRepository products) : IQueryHandler<CountProductsQuery, int>
{
    public async Task<Result<int>> Handle(CountProductsQuery query, CancellationToken ct) =>
        await products.CountAsync(query.Filter, ct);
}
