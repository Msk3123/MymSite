using SiteMym.Application.Abstractions.Messaging;
using SiteMym.Application.Abstractions.Persistence;
using SiteMym.Application.Common;
using SiteMym.Domain.Common;
using SiteMym.Domain.Orders;
using SiteMym.Domain.Products;

namespace SiteMym.Application.Dashboard;

/// <summary>Сторінка «Сьогодні», лічильники у вкладках і відповідь помічника на «як там справи?».</summary>
public sealed record GetShopSummaryQuery : IQuery<ShopSummary>;

public sealed record ShopSummary(
    DateTime LocalTime,
    int OrdersToday,
    decimal RevenueToday,
    int OrdersThisMonth,
    decimal RevenueThisMonth,
    int NewOrders,
    int ConfirmedOrders,
    int ShippedOrders,
    int CompletedOrders,
    int CancelledOrders,
    int ItemsOnSale,
    int ItemsReserved,
    int ItemsSold,
    int Drafts,
    int ItemsSoldThisMonth,
    decimal ValueOnSale,
    IReadOnlyList<WeekSales> WeeklySales,
    IReadOnlyList<StaleItem> StaleItems);

/// <param name="WeekStart">Понеділок тижня (за Києвом).</param>
public sealed record WeekSales(DateOnly WeekStart, int Orders, decimal Total);

/// <summary>Річ, що давно на сайті: можна знизити ціну або зібрати в лот.</summary>
public sealed record StaleItem(Guid Id, string Name, string Brand, int SizeCm, string? SizeNote, decimal Price, int DaysOnSite, string? CoverUrl);

internal sealed class GetShopSummaryQueryHandler(
    IOrderRepository orders,
    IProductRepository products,
    ShopClock clock) : IQueryHandler<GetShopSummaryQuery, ShopSummary>
{
    private const int Weeks = 6;
    private const int StaleAfterDays = 30;
    private const int StaleTake = 5;

    public async Task<Result<ShopSummary>> Handle(GetShopSummaryQuery query, CancellationToken ct)
    {
        // DbContext не вміє паралельні запити — ідемо по черзі, вони всі маленькі.
        var stats = await orders.GetStatsAsync(clock.TodayStartUtc, clock.MonthStartUtc, ct);
        var byStatus = await products.CountByStatusAsync(ct);
        var soldThisMonth = await products.CountSoldSinceAsync(clock.MonthStartUtc, ct);
        var valueOnSale = await products.GetAvailableValueAsync(ct);

        var today = DateOnly.FromDateTime(clock.LocalNow);
        var thisMonday = today.AddDays(-(((int)today.DayOfWeek + 6) % 7));
        var firstMonday = thisMonday.AddDays(-7 * (Weeks - 1));
        var totals = await orders.GetTotalsSinceAsync(clock.ToUtc(firstMonday.ToDateTime(TimeOnly.MinValue)), ct);
        var weekly = Enumerable.Range(0, Weeks)
            .Select(i => firstMonday.AddDays(7 * i))
            .Select(monday =>
            {
                var inWeek = totals.Where(t =>
                {
                    var day = DateOnly.FromDateTime(clock.ToLocal(t.CreatedAtUtc));
                    return day >= monday && day < monday.AddDays(7);
                }).ToList();
                return new WeekSales(monday, inWeek.Count, inWeek.Sum(t => t.Total));
            })
            .ToList();

        var stale = await products.GetStaleAsync(clock.UtcNow.AddDays(-StaleAfterDays), StaleTake, ct);

        return new ShopSummary(
            clock.LocalNow,
            stats.TodayCount,
            stats.TodayTotal,
            stats.MonthCount,
            stats.MonthTotal,
            stats.ByStatus.GetValueOrDefault(OrderStatus.New),
            stats.ByStatus.GetValueOrDefault(OrderStatus.Confirmed),
            stats.ByStatus.GetValueOrDefault(OrderStatus.Shipped),
            stats.ByStatus.GetValueOrDefault(OrderStatus.Completed),
            stats.ByStatus.GetValueOrDefault(OrderStatus.Cancelled),
            byStatus.GetValueOrDefault(ProductStatus.Available),
            byStatus.GetValueOrDefault(ProductStatus.Reserved),
            byStatus.GetValueOrDefault(ProductStatus.Sold),
            byStatus.GetValueOrDefault(ProductStatus.Draft),
            soldThisMonth,
            valueOnSale,
            weekly,
            stale.Select(p => new StaleItem(
                p.Id, p.Name, p.Brand, p.SizeCm, p.Details.SizeNote, p.Price,
                (int)(clock.UtcNow - p.CreatedAtUtc).TotalDays,
                p.Photos.MinBy(ph => ph.SortOrder)?.Url)).ToList());
    }
}
