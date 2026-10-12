using SiteMym.Application.Abstractions.Messaging;
using SiteMym.Application.Abstractions.Persistence;
using SiteMym.Domain.Common;
using SiteMym.Domain.Orders;

namespace SiteMym.Application.Orders.Manage;

public enum OrderAction
{
    /// <summary>Зв'язалась із покупцем, усе підтверджено.</summary>
    Confirm,

    /// <summary>Відправила Новою Поштою — потрібен номер ТТН.</summary>
    Ship,

    /// <summary>Посилку забрали — речі остаточно продані.</summary>
    Complete,

    /// <summary>Покупець передумав — речі повертаються в продаж.</summary>
    Cancel
}

public sealed record ChangeOrderStatusCommand(int Number, OrderAction Action, string? TrackingNumber = null)
    : ICommand<OrderResponse>;

internal sealed class ChangeOrderStatusCommandHandler(
    IOrderRepository orders,
    IProductRepository products,
    IUnitOfWork unitOfWork) : ICommandHandler<ChangeOrderStatusCommand, OrderResponse>
{
    private static readonly Error Conflict = new(
        "Order.Conflict", "Замовлення щойно змінилося. Оновіть сторінку й спробуйте ще раз");

    public async Task<Result<OrderResponse>> Handle(ChangeOrderStatusCommand command, CancellationToken ct)
    {
        var order = await orders.GetByNumberAsync(command.Number, ct);
        if (order is null)
            return Result.Failure<OrderResponse>(OrderErrors.NotFound);

        var result = command.Action switch
        {
            OrderAction.Confirm => order.Confirm(),
            OrderAction.Ship => order.Ship(command.TrackingNumber ?? string.Empty),
            OrderAction.Complete => order.Complete(await LoadProductsAsync(order, ct)),
            OrderAction.Cancel => order.Cancel(await LoadProductsAsync(order, ct)),
            _ => throw new ArgumentOutOfRangeException(nameof(command), command.Action, null)
        };
        if (result.IsFailure)
            return Result.Failure<OrderResponse>(result.Error);

        try
        {
            await unitOfWork.SaveChangesAsync(ct);
        }
        catch (ConcurrencyConflictException)
        {
            return Result.Failure<OrderResponse>(Conflict);
        }

        return await order.ToDetailsAsync(products, orders, ct);
    }

    private async Task<IReadOnlyCollection<Domain.Products.Product>> LoadProductsAsync(Order order, CancellationToken ct) =>
        await products.GetByIdsAsync(order.Items.Select(i => i.ProductId).ToList(), ct);
}
