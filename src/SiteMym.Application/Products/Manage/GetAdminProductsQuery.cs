using SiteMym.Application.Abstractions.Messaging;
using SiteMym.Application.Abstractions.Persistence;
using SiteMym.Application.Common;
using SiteMym.Domain.Common;

namespace SiteMym.Application.Products.Manage;

/// <summary>«Мої речі»: усі статуси, включно з чернетками, плюс «Де лежить».</summary>
public sealed record GetAdminProductsQuery(ProductFilter Filter) : IQuery<PagedList<AdminProductListItem>>;

internal sealed class GetAdminProductsQueryHandler(IProductRepository products)
    : IQueryHandler<GetAdminProductsQuery, PagedList<AdminProductListItem>>
{
    public async Task<Result<PagedList<AdminProductListItem>>> Handle(GetAdminProductsQuery query, CancellationToken ct)
    {
        var page = await products.ListAsync(query.Filter with { IncludeDrafts = true }, ct);
        return page.Map(p => p.ToAdminListItem());
    }
}
