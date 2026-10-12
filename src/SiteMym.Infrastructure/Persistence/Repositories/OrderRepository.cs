using Microsoft.EntityFrameworkCore;
using SiteMym.Application.Abstractions.Persistence;
using SiteMym.Application.Common;
using SiteMym.Application.Orders;
using SiteMym.Domain.Orders;

namespace SiteMym.Infrastructure.Persistence.Repositories;

internal sealed class OrderRepository(AppDbContext db) : IOrderRepository
{
    public Task<Order?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        db.Orders.FirstOrDefaultAsync(o => o.Id == id, ct);

    public Task<Order?> GetByNumberAsync(int number, CancellationToken ct = default) =>
        db.Orders.FirstOrDefaultAsync(o => o.Number == number, ct);

    public async Task<PagedList<Order>> ListAsync(OrderStatus? status, string? search, int page, int pageSize, CancellationToken ct = default)
    {
        var query = db.Orders.AsNoTracking();
        if (status is { } s)
            query = query.Where(o => o.Status == s);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var text = search.Trim();
            var digits = new string(text.Where(char.IsAsciiDigit).ToArray());
            var pattern = $"%{text.Replace(@"\", @"\\").Replace("%", @"\%").Replace("_", @"\_")}%";
            var number = int.TryParse(digits, out var n) && digits.Length <= 6 ? n : (int?)null;
            // Телефон зберігається як +380…, тож шукаємо за цифрами: «067 214» знайде +38067214….
            var phonePattern = digits.Length >= 3 ? $"%{digits}%" : null;

            query = query.Where(o =>
                EF.Functions.ILike(o.Customer.FullName, pattern)
                || (number != null && o.Number == number)
                || (phonePattern != null && EF.Functions.Like(o.Customer.Phone, phonePattern))
                || (phonePattern != null && o.TrackingNumber != null && EF.Functions.Like(o.TrackingNumber, phonePattern)));
        }

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(o => o.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedList<Order>(items, page, pageSize, total);
    }

    public Task<bool> ExistsWithProductAsync(Guid productId, CancellationToken ct = default) =>
        db.Orders.AnyAsync(o => o.Items.Any(i => i.ProductId == productId), ct);

    public async Task<OrderStats> GetStatsAsync(DateTime todayStartUtc, DateTime monthStartUtc, CancellationToken ct = default)
    {
        var byStatus = await db.Orders.AsNoTracking()
            .GroupBy(o => o.Status)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

        // Один запит на місяць, «сьогодні» рахуємо з тих самих рядків.
        var month = await db.Orders.AsNoTracking()
            .Where(o => o.CreatedAtUtc >= monthStartUtc && o.Status != OrderStatus.Cancelled)
            .Select(o => new { o.CreatedAtUtc, o.Total })
            .ToListAsync(ct);
        var today = month.Where(o => o.CreatedAtUtc >= todayStartUtc).ToList();

        return new OrderStats(today.Count, today.Sum(o => o.Total), month.Count, month.Sum(o => o.Total), byStatus);
    }

    public async Task<IReadOnlyList<OrderTotal>> GetTotalsSinceAsync(DateTime sinceUtc, CancellationToken ct = default) =>
        await db.Orders.AsNoTracking()
            .Where(o => o.CreatedAtUtc >= sinceUtc && o.Status != OrderStatus.Cancelled)
            .Select(o => new OrderTotal(o.CreatedAtUtc, o.Total))
            .ToListAsync(ct);

    public async Task<CustomerHistory> GetCustomerHistoryAsync(string phone, Guid exceptOrderId, CancellationToken ct = default)
    {
        var totals = await db.Orders.AsNoTracking()
            .Where(o => o.Customer.Phone == phone && o.Id != exceptOrderId && o.Status != OrderStatus.Cancelled)
            .Select(o => o.Total)
            .ToListAsync(ct);
        return new CustomerHistory(totals.Count, totals.Sum());
    }

    public void Add(Order order) => db.Orders.Add(order);
}
