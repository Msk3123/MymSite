using Microsoft.EntityFrameworkCore;
using SiteMym.Application.Abstractions.Persistence;
using SiteMym.Application.Common;
using SiteMym.Application.Products;
using SiteMym.Domain.Products;

namespace SiteMym.Infrastructure.Persistence.Repositories;

internal sealed class ProductRepository(AppDbContext db) : IProductRepository
{
    public Task<Product?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        db.Products.FirstOrDefaultAsync(p => p.Id == id, ct);

    public Task<Product?> GetBySkuAsync(string sku, CancellationToken ct = default) =>
        db.Products.FirstOrDefaultAsync(p => p.Sku == sku, ct);

    public Task<Product?> GetBySlugAsync(string slug, CancellationToken ct = default) =>
        db.Products.AsNoTracking().FirstOrDefaultAsync(p => p.Slug == slug, ct);

    public async Task<IReadOnlyList<Product>> GetBySlugsAsync(IReadOnlyCollection<string> slugs, CancellationToken ct = default) =>
        await db.Products.AsNoTracking().Where(p => slugs.Contains(p.Slug)).ToListAsync(ct);

    public async Task<IReadOnlyList<Product>> GetByIdsAsync(IReadOnlyCollection<Guid> ids, CancellationToken ct = default) =>
        await db.Products.Where(p => ids.Contains(p.Id)).ToListAsync(ct);

    public async Task<PagedList<Product>> ListAsync(ProductFilter filter, CancellationToken ct = default)
    {
        var query = Filter(filter);
        var total = await query.CountAsync(ct);

        // Продане й заброньоване — завжди в кінці: купити їх зараз не можна.
        var ordered = query.OrderBy(p => p.Status != ProductStatus.Available);
        ordered = filter.Sort switch
        {
            ProductSort.PriceAsc => ordered.ThenBy(p => p.Price),
            ProductSort.PriceDesc => ordered.ThenByDescending(p => p.Price),
            _ => ordered.ThenByDescending(p => p.CreatedAtUtc)
        };

        var page = Math.Max(1, filter.Page);
        var pageSize = Math.Clamp(filter.PageSize, 1, ProductFilter.MaxPageSize);
        var items = await ordered
            .ThenBy(p => p.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedList<Product>(items, page, pageSize, total);
    }

    public Task<int> CountAsync(ProductFilter filter, CancellationToken ct = default) =>
        Filter(filter).CountAsync(ct);

    public Task<bool> ExistsBySkuAsync(string sku, CancellationToken ct = default) =>
        db.Products.IgnoreQueryFilters().AnyAsync(p => p.Sku == sku, ct);

    public async Task<IReadOnlyList<string>> GetSkusAsync(string prefix, CancellationToken ct = default) =>
        // Включно з видаленими: артикул ніколи не повторюється, навіть якщо річ давно стерта.
        await db.Products.AsNoTracking().IgnoreQueryFilters().Where(p => p.Sku.StartsWith(prefix)).Select(p => p.Sku).ToListAsync(ct);

    public async Task<IReadOnlyDictionary<ProductStatus, int>> CountByStatusAsync(CancellationToken ct = default) =>
        await db.Products.AsNoTracking()
            .GroupBy(p => p.Status)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

    public Task<int> CountSoldSinceAsync(DateTime sinceUtc, CancellationToken ct = default) =>
        db.Products.CountAsync(p => p.Status == ProductStatus.Sold && p.SoldAtUtc >= sinceUtc, ct);

    public async Task<IReadOnlyList<ProductPrice>> GetPricesAsync(ProductCategory category, CancellationToken ct = default) =>
        await db.Products.AsNoTracking()
            .Where(p => p.Category == category && p.Status != ProductStatus.Draft)
            .Select(p => new ProductPrice(p.Price, p.Status))
            .ToListAsync(ct);

    public async Task<IReadOnlyList<Product>> GetStaleAsync(DateTime listedBeforeUtc, int take, CancellationToken ct = default) =>
        await db.Products.AsNoTracking()
            .Where(p => p.Status == ProductStatus.Available && p.CreatedAtUtc < listedBeforeUtc)
            .OrderBy(p => p.CreatedAtUtc)
            .Take(take)
            .ToListAsync(ct);

    public Task<decimal> GetAvailableValueAsync(CancellationToken ct = default) =>
        db.Products.Where(p => p.Status == ProductStatus.Available).SumAsync(p => p.Price, ct);

    public void Add(Product product) => db.Products.Add(product);

    public void Remove(Product product) => db.Products.Remove(product);

    private IQueryable<Product> Filter(ProductFilter filter)
    {
        var query = db.Products.AsNoTracking();

        if (filter.Status is { } status)
            query = query.Where(p => p.Status == status);
        else
        {
            if (!filter.IncludeDrafts)
                query = query.Where(p => p.Status != ProductStatus.Draft);
            if (!filter.IncludeSold)
                query = query.Where(p => p.Status == ProductStatus.Available || p.Status == ProductStatus.Draft);
        }
        if (filter.Gender is { } gender)
            query = query.Where(p => p.Gender == gender);
        if (filter.SizeCm is { } size)
            query = query.Where(p => p.SizeCm == size);
        if (filter.Season is { } season)
            query = query.Where(p => p.Season == season || p.Season == Season.AllSeason);
        if (filter.Conditions.Count > 0)
            query = query.Where(p => filter.Conditions.Contains(p.Condition));
        if (filter.Category is { } category)
            query = query.Where(p => p.Category == category);
        if (filter.MinPrice is { } min)
            query = query.Where(p => p.Price >= min);
        if (filter.MaxPrice is { } max)
            query = query.Where(p => p.Price <= max);

        // «куртка reserved» — кожне слово має знайтися в назві, бренді або артикулі.
        // Українські слова шукаємо за основою: «штанів», «куртку», «шапки» знайдуть «Штани», «Куртка», «Шапка».
        var words = (filter.Search ?? string.Empty)
            .Split([' ', ',', '.', '!', '?', '«', '»', '"'], StringSplitOptions.RemoveEmptyEntries)
            .Select(Stem)
            .Where(w => w.Length > 0);
        foreach (var word in words)
        {
            var pattern = $"%{EscapeLike(word)}%";
            query = query.Where(p => EF.Functions.ILike(p.Title, pattern) || EF.Functions.ILike(p.Brand, pattern) || EF.Functions.ILike(p.Sku, pattern));
        }

        return query;
    }

    /// <summary>
    /// Найпростіше «відсікання закінчення»: для кириличного слова з 5+ літер — мінус 2 літери, з 4 — мінус 1.
    /// Короткі службові слова («з», «на», «до») не шукаємо зовсім. Латиницю й цифри (бренди, артикули) не чіпаємо.
    /// </summary>
    private static string Stem(string word)
    {
        var w = word.Trim();
        var cyrillic = w.All(c => c is >= 'А' and <= 'я' or 'і' or 'ї' or 'є' or 'ґ' or 'І' or 'Ї' or 'Є' or 'Ґ' or '’' or '\'');
        if (!cyrillic)
            return w;
        return w.Length switch
        {
            <= 2 => string.Empty,
            4 => w[..3],
            >= 5 => w[..^2],
            _ => w
        };
    }

    private static string EscapeLike(string value) =>
        value.Replace(@"\", @"\\").Replace("%", @"\%").Replace("_", @"\_");
}
