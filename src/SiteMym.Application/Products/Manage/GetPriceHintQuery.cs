using SiteMym.Application.Abstractions.Messaging;
using SiteMym.Application.Abstractions.Persistence;
using SiteMym.Domain.Common;
using SiteMym.Domain.Products;

namespace SiteMym.Application.Products.Manage;

/// <summary>«Схожі шапки у вас коштували 150–200 грн» — підказка під полем ціни.</summary>
public sealed record GetPriceHintQuery(ProductCategory Category) : IQuery<PriceHint?>;

/// <param name="SoldCount">Скільки таких уже продано — якщо є, діапазон рахуємо по проданих (це реальна ціна попиту).</param>
public sealed record PriceHint(decimal Min, decimal Max, int SoldCount, int Count);

internal sealed class GetPriceHintQueryHandler(IProductRepository products) : IQueryHandler<GetPriceHintQuery, PriceHint?>
{
    private const int MinSample = 2;

    public async Task<Result<PriceHint?>> Handle(GetPriceHintQuery query, CancellationToken ct)
    {
        var prices = await products.GetPricesAsync(query.Category, ct);
        var sold = prices.Where(p => p.Status == ProductStatus.Sold).Select(p => p.Price).ToList();
        var sample = sold.Count >= MinSample ? sold : prices.Select(p => p.Price).ToList();
        if (sample.Count < MinSample)
            return Result.Success<PriceHint?>(null);

        // Без крайніх значень: одна дорога Columbia не повинна задирати всю вилку.
        sample.Sort();
        var trim = sample.Count >= 6 ? sample.Count / 6 : 0;
        var middle = sample.Skip(trim).Take(sample.Count - 2 * trim).ToList();
        return Result.Success<PriceHint?>(new PriceHint(middle[0], middle[^1], sold.Count, sample.Count));
    }
}
