using SiteMym.Application.Abstractions.Messaging;
using SiteMym.Application.Abstractions.Persistence;
using SiteMym.Domain.Common;
using SiteMym.Domain.Products;

namespace SiteMym.Application.Products.Manage;

/// <summary>Річ для форми редагування — у будь-якому статусі, включно з чернеткою.</summary>
public sealed record GetAdminProductQuery(Guid Id) : IQuery<AdminProductResponse>;

internal sealed class GetAdminProductQueryHandler(IProductRepository products)
    : IQueryHandler<GetAdminProductQuery, AdminProductResponse>
{
    public async Task<Result<AdminProductResponse>> Handle(GetAdminProductQuery query, CancellationToken ct)
    {
        var product = await products.GetByIdAsync(query.Id, ct);
        return product is null
            ? Result.Failure<AdminProductResponse>(ProductErrors.NotFound)
            : product.ToAdminResponse();
    }
}
