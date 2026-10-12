using SiteMym.Application.Common;
using SiteMym.Application.Orders;
using SiteMym.Domain.Orders;

namespace SiteMym.Application.Abstractions.Persistence;

public sealed record OrderTotal(DateTime CreatedAtUtc, decimal Total);

public sealed record CustomerHistory(int Orders, decimal Total);

public interface IOrderRepository
{
    Task<Order?> GetByIdAsync(Guid id, CancellationToken ct = default);

    Task<Order?> GetByNumberAsync(int number, CancellationToken ct = default);

    /// <summary>Список для адмінки: найновіші зверху; фільтр за статусом і пошук (ім'я, телефон, №, ТТН).</summary>
    Task<PagedList<Order>> ListAsync(OrderStatus? status, string? search, int page, int pageSize, CancellationToken ct = default);

    /// <summary>Суми нескасованих замовлень із якоїсь дати — для графіка «Продажі по тижнях».</summary>
    Task<IReadOnlyList<OrderTotal>> GetTotalsSinceAsync(DateTime sinceUtc, CancellationToken ct = default);

    /// <summary>Що ця людина (за телефоном) купувала раніше, крім цього замовлення.</summary>
    Task<CustomerHistory> GetCustomerHistoryAsync(string phone, Guid exceptOrderId, CancellationToken ct = default);

    /// <summary>Чи потрапляла річ хоч в одне замовлення (тоді її не можна видаляти).</summary>
    Task<bool> ExistsWithProductAsync(Guid productId, CancellationToken ct = default);

    Task<OrderStats> GetStatsAsync(DateTime todayStartUtc, DateTime monthStartUtc, CancellationToken ct = default);

    void Add(Order order);
}
