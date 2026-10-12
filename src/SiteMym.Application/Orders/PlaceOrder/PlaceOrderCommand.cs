using SiteMym.Application.Abstractions.Messaging;
using SiteMym.Application.Abstractions.Persistence;
using SiteMym.Domain.Common;
using SiteMym.Domain.Orders;
using SiteMym.Domain.Products;

namespace SiteMym.Application.Orders.PlaceOrder;

public sealed record PlaceOrderCommand(
    string FullName,
    string Phone,
    string City,
    string Branch,
    PaymentMethod Payment,
    string? Comment,
    IReadOnlyCollection<Guid> ProductIds) : ICommand<PlaceOrderResponse>;

public sealed record PlaceOrderResponse(int Number, decimal Subtotal, decimal Discount, decimal Total);

internal sealed class PlaceOrderCommandHandler(
    IProductRepository products,
    IOrderRepository orders,
    IUnitOfWork unitOfWork) : ICommandHandler<PlaceOrderCommand, PlaceOrderResponse>
{
    public async Task<Result<PlaceOrderResponse>> Handle(PlaceOrderCommand command, CancellationToken ct)
    {
        var customer = Customer.Create(command.FullName, command.Phone);
        if (customer.IsFailure)
            return Result.Failure<PlaceOrderResponse>(customer.Error);

        var delivery = DeliveryAddress.Create(command.City, command.Branch);
        if (delivery.IsFailure)
            return Result.Failure<PlaceOrderResponse>(delivery.Error);

        if (command.ProductIds.Count == 0)
            return Result.Failure<PlaceOrderResponse>(OrderErrors.Empty);
        if (command.ProductIds.Distinct().Count() != command.ProductIds.Count)
            return Result.Failure<PlaceOrderResponse>(OrderErrors.DuplicateItems);

        var items = await products.GetByIdsAsync(command.ProductIds, ct);
        if (items.Count != command.ProductIds.Count)
            return Result.Failure<PlaceOrderResponse>(ProductErrors.NotFound);

        var order = Order.Place(customer.Value, delivery.Value, command.Payment, items, command.Comment);
        if (order.IsFailure)
            return Result.Failure<PlaceOrderResponse>(order.Error);

        orders.Add(order.Value);

        try
        {
            await unitOfWork.SaveChangesAsync(ct);
        }
        catch (ConcurrencyConflictException)
        {
            // Хтось інший встиг зарезервувати одну з цих речей між читанням і збереженням.
            return Result.Failure<PlaceOrderResponse>(OrderErrors.ItemsJustTaken);
        }

        var placed = order.Value;
        return new PlaceOrderResponse(placed.Number, placed.Subtotal, placed.Discount, placed.Total);
    }
}
