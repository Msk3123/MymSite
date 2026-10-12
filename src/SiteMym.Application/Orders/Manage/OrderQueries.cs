using SiteMym.Application.Abstractions.Messaging;
using SiteMym.Application.Abstractions.Persistence;
using SiteMym.Application.Common;
using SiteMym.Domain.Common;
using SiteMym.Domain.Orders;

namespace SiteMym.Application.Orders.Manage;

/// <summary>Список замовлень: найновіші зверху; фільтр за статусом і пошук за ім'ям, телефоном, № або ТТН.</summary>
public sealed record GetOrdersQuery(OrderStatus? Status, int Page = 1, int PageSize = 20, string? Search = null)
    : IQuery<PagedList<OrderResponse>>;

public sealed record GetOrderQuery(int Number) : IQuery<OrderResponse>;

internal sealed class GetOrdersQueryHandler(IOrderRepository orders) : IQueryHandler<GetOrdersQuery, PagedList<OrderResponse>>
{
    public async Task<Result<PagedList<OrderResponse>>> Handle(GetOrdersQuery query, CancellationToken ct)
    {
        var page = await orders.ListAsync(query.Status, query.Search, query.Page, query.PageSize, ct);
        return page.Map(o => o.ToResponse());
    }
}

internal sealed class GetOrderQueryHandler(IOrderRepository orders, IProductRepository products)
    : IQueryHandler<GetOrderQuery, OrderResponse>
{
    public async Task<Result<OrderResponse>> Handle(GetOrderQuery query, CancellationToken ct)
    {
        var order = await orders.GetByNumberAsync(query.Number, ct);
        return order is null
            ? Result.Failure<OrderResponse>(OrderErrors.NotFound)
            : await order.ToDetailsAsync(products, orders, ct);
    }
}
