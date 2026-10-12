using SiteMym.Application.Abstractions.Messaging;
using SiteMym.Application.Abstractions.Persistence;
using SiteMym.Application.Common;
using SiteMym.Domain.Common;

namespace SiteMym.Application.Products.GetProducts;

public sealed record GetProductsQuery(ProductFilter Filter) : IQuery<PagedList<ProductListItem>>;

internal sealed class GetProductsQueryHandler(IProductRepository products)
    : IQueryHandler<GetProductsQuery, PagedList<ProductListItem>>
{
    public async Task<Result<PagedList<ProductListItem>>> Handle(GetProductsQuery query, CancellationToken ct)
    {
        var page = await products.ListAsync(query.Filter, ct);
        return page.Map(p => p.ToListItem());
    }
}
