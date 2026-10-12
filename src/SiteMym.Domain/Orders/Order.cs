using SiteMym.Domain.Common;
using SiteMym.Domain.Products;

namespace SiteMym.Domain.Orders;

public sealed class Order : Entity
{
    private readonly List<OrderItem> _items = [];

    private Order() { }

    /// <summary>Короткий номер для людей («Замовлення №1024»). Генерує база даних.</summary>
    public int Number { get; private set; }

    public Customer Customer { get; private set; } = null!;
    public DeliveryAddress Delivery { get; private set; } = null!;
    public PaymentMethod Payment { get; private set; }
    public string? Comment { get; private set; }

    /// <summary>Нотатка продавчині для себе («покласти в подарунок шкарпетки»). Покупець її не бачить.</summary>
    public string? AdminNote { get; private set; }

    public OrderStatus Status { get; private set; }

    /// <summary>Номер ТТН Нової Пошти — з'являється після відправки.</summary>
    public string? TrackingNumber { get; private set; }

    public decimal Subtotal { get; private set; }
    public decimal Discount { get; private set; }
    public decimal Total { get; private set; }

    public IReadOnlyList<OrderItem> Items => _items;

    /// <summary>Оформлення з сайту: перевіряє, що всі речі вільні, і резервує їх.</summary>
    public static Result<Order> Place(
        Customer customer,
        DeliveryAddress delivery,
        PaymentMethod payment,
        IReadOnlyCollection<Product> products,
        string? comment = null)
    {
        if (products.Count == 0)
            return Result.Failure<Order>(OrderErrors.Empty);
        if (products.DistinctBy(p => p.Id).Count() != products.Count)
            return Result.Failure<Order>(OrderErrors.DuplicateItems);

        var unavailable = products.FirstOrDefault(p => !p.IsAvailable);
        if (unavailable is not null)
            return Result.Failure<Order>(ProductErrors.NotAvailable(unavailable.Sku));

        var order = new Order
        {
            Customer = customer,
            Delivery = delivery,
            Payment = payment,
            Comment = string.IsNullOrWhiteSpace(comment) ? null : comment.Trim(),
            Status = OrderStatus.New
        };

        foreach (var product in products)
        {
            product.Reserve();
            order._items.Add(new OrderItem(order.Id, product));
        }

        order.Subtotal = order._items.Sum(i => i.Price);
        order.Discount = BulkDiscount.Calculate(order._items.Count, order.Subtotal);
        order.Total = order.Subtotal - order.Discount;
        return order;
    }

    public void SetAdminNote(string? note) =>
        AdminNote = string.IsNullOrWhiteSpace(note) ? null : note.Trim();

    public Result Confirm() => MoveTo(OrderStatus.Confirmed, OrderStatus.New);

    public Result Ship(string trackingNumber)
    {
        if (string.IsNullOrWhiteSpace(trackingNumber))
            return Result.Failure(OrderErrors.TrackingNumberRequired);

        var result = MoveTo(OrderStatus.Shipped, OrderStatus.Confirmed);
        if (result.IsSuccess)
            TrackingNumber = trackingNumber.Trim();
        return result;
    }

    /// <summary>Посилку забрали — речі остаточно продані.</summary>
    public Result Complete(IReadOnlyCollection<Product> products)
    {
        var check = EnsureSameProducts(products);
        if (check.IsFailure)
            return check;

        var result = MoveTo(OrderStatus.Completed, OrderStatus.Shipped);
        if (result.IsFailure)
            return result;

        foreach (var product in products)
            product.MarkSold();
        return Result.Success();
    }

    /// <summary>Скасування до відправки — речі повертаються в продаж.</summary>
    public Result Cancel(IReadOnlyCollection<Product> products)
    {
        var check = EnsureSameProducts(products);
        if (check.IsFailure)
            return check;

        var result = MoveTo(OrderStatus.Cancelled, OrderStatus.New, OrderStatus.Confirmed);
        if (result.IsFailure)
            return result;

        foreach (var product in products)
            product.Release();
        return Result.Success();
    }

    private Result EnsureSameProducts(IReadOnlyCollection<Product> products)
    {
        var expected = _items.Select(i => i.ProductId).ToHashSet();
        return expected.SetEquals(products.Select(p => p.Id))
            ? Result.Success()
            : Result.Failure(OrderErrors.ProductsMismatch);
    }

    private Result MoveTo(OrderStatus target, params OrderStatus[] allowedFrom)
    {
        if (!allowedFrom.Contains(Status))
            return Result.Failure(OrderErrors.InvalidStatusTransition(Status, target));

        Status = target;
        return Result.Success();
    }
}
