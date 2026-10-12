using SiteMym.Application.Abstractions.Messaging;
using SiteMym.Application.Abstractions.Persistence;
using SiteMym.Domain.Common;
using SiteMym.Domain.Orders;

namespace SiteMym.Application.Orders.Manage;

/// <summary>«Нотатка для себе» в замовленні — покупець її не бачить.</summary>
public sealed record SetOrderNoteCommand(int Number, string? Note) : ICommand<OrderResponse>;

internal sealed class SetOrderNoteCommandHandler(
    IOrderRepository orders,
    IProductRepository products,
    IUnitOfWork unitOfWork) : ICommandHandler<SetOrderNoteCommand, OrderResponse>
{
    private const int MaxLength = 1000;

    private static readonly Error TooLong = new("Order.NoteTooLong", $"Нотатка задовга — до {MaxLength} символів");

    public async Task<Result<OrderResponse>> Handle(SetOrderNoteCommand command, CancellationToken ct)
    {
        if (command.Note?.Length > MaxLength)
            return Result.Failure<OrderResponse>(TooLong);

        var order = await orders.GetByNumberAsync(command.Number, ct);
        if (order is null)
            return Result.Failure<OrderResponse>(OrderErrors.NotFound);

        order.SetAdminNote(command.Note);
        await unitOfWork.SaveChangesAsync(ct);
        return await order.ToDetailsAsync(products, orders, ct);
    }
}
