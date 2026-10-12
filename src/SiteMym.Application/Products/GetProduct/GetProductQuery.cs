using SiteMym.Application.Abstractions.Messaging;
using SiteMym.Application.Abstractions.Persistence;
using SiteMym.Domain.Common;
using SiteMym.Domain.Products;

namespace SiteMym.Application.Products.GetProduct;

public sealed record GetProductQuery(string Slug) : IQuery<ProductResponse>;

internal sealed class GetProductQueryHandler(IProductRepository products) : IQueryHandler<GetProductQuery, ProductResponse>
{
    public async Task<Result<ProductResponse>> Handle(GetProductQuery query, CancellationToken ct)
    {
        var product = await products.GetBySlugAsync(query.Slug.Trim().ToLowerInvariant(), ct);

        // Чернетку покупцям не показуємо — для них її ще не існує.
        return product is null || product.Status == ProductStatus.Draft
            ? Result.Failure<ProductResponse>(ProductErrors.NotFound)
            : product.ToResponse();
    }
}
