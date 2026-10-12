using SiteMym.Domain.Common;

namespace SiteMym.Domain.Orders;

public static class OrderErrors
{
    public static readonly Error NotFound = new("Order.NotFound", "Замовлення не знайдено");
    public static readonly Error Empty = new("Order.Empty", "У замовленні немає жодної речі");
    public static readonly Error DuplicateItems = new("Order.DuplicateItems", "Одна річ двічі в замовленні");
    public static readonly Error FullNameRequired = new("Order.FullNameRequired", "Вкажіть ім'я та прізвище");
    public static readonly Error InvalidPhone = new("Order.InvalidPhone", "Номер у форматі +380 XX XXX XX XX");
    public static readonly Error CityRequired = new("Order.CityRequired", "Вкажіть місто");
    public static readonly Error BranchRequired = new("Order.BranchRequired", "Вкажіть відділення або поштомат");
    public static readonly Error TrackingNumberRequired = new("Order.TrackingNumberRequired", "Вкажіть номер ТТН");
    public static readonly Error ItemsJustTaken = new("Order.ItemsJustTaken", "Одну з речей щойно замовив хтось інший");
    public static readonly Error ProductsMismatch = new("Order.ProductsMismatch", "Передано не ті речі, що в замовленні");

    public static Error InvalidStatusTransition(OrderStatus from, OrderStatus to) =>
        new("Order.InvalidStatus", from == to
            ? $"Замовлення вже «{Label(to)}»"
            : $"Не можна змінити статус замовлення «{Label(from)}» на «{Label(to)}»");

    private static string Label(OrderStatus status) => status switch
    {
        OrderStatus.New => "Нове",
        OrderStatus.Confirmed => "Підтверджене",
        OrderStatus.Shipped => "Відправлене",
        OrderStatus.Completed => "Виконане",
        OrderStatus.Cancelled => "Скасоване",
        _ => status.ToString()
    };
}
