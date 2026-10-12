using SiteMym.Application.Abstractions.Messaging;
using SiteMym.Application.Abstractions.Persistence;
using SiteMym.Domain.Common;
using SiteMym.Domain.Products;

namespace SiteMym.Application.Products.LookupProducts;

/// <summary>
/// Кошик живе в браузері як список slug-ів. Тут він отримує свіжі ціни й статуси —
/// щоб покупець побачив, що якусь річ уже забрали, ще до оформлення.
/// </summary>
public sealed record LookupProductsQuery(IReadOnlyCollection<string> Slugs) : IQuery<IReadOnlyList<ProductListItem>>;

internal sealed class LookupProductsQueryHandler(IProductRepository products)
    : IQueryHandler<LookupProductsQuery, IReadOnlyList<ProductListItem>>
{
    private const int MaxSlugs = 50;

    public async Task<Result<IReadOnlyList<ProductListItem>>> Handle(LookupProductsQuery query, CancellationToken ct)
    {
        var slugs = query.Slugs
            .Select(s => s.Trim().ToLowerInvariant())
            .Where(s => s.Length > 0)
            .Distinct()
            .Take(MaxSlugs)
            .ToList();

        if (slugs.Count == 0)
            return Array.Empty<ProductListItem>();

        var found = await products.GetBySlugsAsync(slugs, ct);
        return found
            .Where(p => p.Status != ProductStatus.Draft)
            .Select(p => p.ToListItem())
            .ToList();
    }
}
