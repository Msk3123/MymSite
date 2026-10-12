using SiteMym.Domain.Common;
using SiteMym.Domain.Products;

namespace SiteMym.Domain.Orders;

/// <summary>
/// Позиція замовлення. Назва й ціна копіюються на момент покупки —
/// якщо річ потім змінять, у замовленні лишиться те, що купили.
/// </summary>
public sealed class OrderItem : Entity
{
    private OrderItem() { }

    internal OrderItem(Guid orderId, Product product)
    {
        OrderId = orderId;
        ProductId = product.Id;
        Sku = product.Sku;
        Name = $"{product.Name}, {product.Brand}";
        SizeCm = product.SizeCm;
        Condition = product.Condition;
        Price = product.Price;
    }

    public Guid OrderId { get; private set; }
    public Guid ProductId { get; private set; }
    public string Sku { get; private set; } = null!;
    public string Name { get; private set; } = null!;
    public int SizeCm { get; private set; }
    public ItemCondition Condition { get; private set; }
    public decimal Price { get; private set; }
}
