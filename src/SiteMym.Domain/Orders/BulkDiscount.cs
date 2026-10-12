namespace SiteMym.Domain.Orders;

/// <summary>«Від 3 речей — знижка 10% на все замовлення».</summary>
public static class BulkDiscount
{
    public const int MinItems = 3;
    public const decimal Percent = 10m;

    public static decimal Calculate(int itemsCount, decimal subtotal) =>
        itemsCount >= MinItems ? Math.Round(subtotal * Percent / 100m, 0, MidpointRounding.AwayFromZero) : 0m;
}
