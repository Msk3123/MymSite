using SiteMym.Domain.Orders;

namespace SiteMym.Application.Orders;

/// <summary>Цифри для зведення. Скасовані замовлення в суми не входять.</summary>
public sealed record OrderStats(
    int TodayCount,
    decimal TodayTotal,
    int MonthCount,
    decimal MonthTotal,
    IReadOnlyDictionary<OrderStatus, int> ByStatus);
