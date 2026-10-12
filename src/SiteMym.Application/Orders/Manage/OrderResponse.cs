using SiteMym.Application.Abstractions.Persistence;
using SiteMym.Domain.Common;
using SiteMym.Domain.Orders;
using SiteMym.Domain.Products;

namespace SiteMym.Application.Orders.Manage;

public sealed record OrderResponse(
    Guid Id,
    int Number,
    DateTime CreatedAtUtc,
    OrderStatus Status,
    string CustomerName,
    string Phone,
    string City,
    string Branch,
    PaymentMethod Payment,
    string? Comment,
    string? AdminNote,
    string? TrackingNumber,
    decimal Subtotal,
    decimal Discount,
    decimal Total,
    IReadOnlyList<OrderItemResponse> Items)
{
    /// <summary>Лише в деталях замовлення: «Купувала раніше: 2 рази, 1 120 грн».</summary>
    public CustomerHistory? CustomerHistory { get; init; }
}

/// <param name="CoverUrl">Фото речі — лише в деталях замовлення.</param>
/// <param name="StorageLocation">«Коробка 7» — щоб швидко знайти річ при пакуванні. Лише в деталях.</param>
public sealed record OrderItemResponse(
    Guid ProductId,
    string Slug,
    string Sku,
    string Name,
    int SizeCm,
    ItemCondition Condition,
    decimal Price,
    string? CoverUrl = null,
    string? StorageLocation = null);

internal static class OrderMappings
{
    public static OrderResponse ToResponse(this Order o) => new(
        o.Id,
        o.Number,
        o.CreatedAtUtc,
        o.Status,
        o.Customer.FullName,
        o.Customer.Phone,
        o.Delivery.City,
        o.Delivery.Branch,
        o.Payment,
        o.Comment,
        o.AdminNote,
        o.TrackingNumber,
        o.Subtotal,
        o.Discount,
        o.Total,
        o.Items
            .Select(i => new OrderItemResponse(i.ProductId, Slug.From(i.Sku), i.Sku, i.Name, i.SizeCm, i.Condition, i.Price))
            .ToList());

    /// <summary>Повна картка замовлення: фото й місце речей, історія покупця.</summary>
    public static async Task<OrderResponse> ToDetailsAsync(
        this Order o, IProductRepository products, IOrderRepository orders, CancellationToken ct)
    {
        var items = await products.GetByIdsAsync(o.Items.Select(i => i.ProductId).ToList(), ct);
        var byId = items.ToDictionary(p => p.Id);
        var history = await orders.GetCustomerHistoryAsync(o.Customer.Phone, o.Id, ct);

        var response = o.ToResponse();
        return response with
        {
            Items = response.Items
                .Select(i => byId.TryGetValue(i.ProductId, out var p)
                    ? i with { CoverUrl = p.Photos.MinBy(ph => ph.SortOrder)?.Url, StorageLocation = p.StorageLocation }
                    : i)
                .ToList(),
            CustomerHistory = history
        };
    }
}
