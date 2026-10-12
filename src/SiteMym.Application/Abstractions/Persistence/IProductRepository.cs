using SiteMym.Application.Common;
using SiteMym.Application.Products;
using SiteMym.Domain.Products;

namespace SiteMym.Application.Abstractions.Persistence;

public sealed record ProductPrice(decimal Price, ProductStatus Status);

public interface IProductRepository
{
    Task<Product?> GetByIdAsync(Guid id, CancellationToken ct = default);

    /// <summary>За артикулом («МШ-0412») — помічник у режимі дій говорить артикулами.</summary>
    Task<Product?> GetBySkuAsync(string sku, CancellationToken ct = default);

    /// <summary>Для сторінки товару: /product/msh-0412.</summary>
    Task<Product?> GetBySlugAsync(string slug, CancellationToken ct = default);

    /// <summary>Для кошика: він зберігається в браузері як список slug-ів.</summary>
    Task<IReadOnlyList<Product>> GetBySlugsAsync(IReadOnlyCollection<string> slugs, CancellationToken ct = default);

    /// <summary>Для оформлення замовлення — усі речі з кошика одним запитом.</summary>
    Task<IReadOnlyList<Product>> GetByIdsAsync(IReadOnlyCollection<Guid> ids, CancellationToken ct = default);

    /// <summary>Каталог: фільтри, сортування, сторінки. Чернетки не потрапляють.</summary>
    Task<PagedList<Product>> ListAsync(ProductFilter filter, CancellationToken ct = default);

    /// <summary>Скільки речей під ці фільтри (сортування й сторінки ігноруються).</summary>
    Task<int> CountAsync(ProductFilter filter, CancellationToken ct = default);

    Task<bool> ExistsBySkuAsync(string sku, CancellationToken ct = default);

    /// <summary>Усі артикули з префіксом — щоб видати наступний номер («МШ-0413»).</summary>
    Task<IReadOnlyList<string>> GetSkusAsync(string prefix, CancellationToken ct = default);

    /// <summary>Скільки речей у кожному статусі (для зведення в адмінці).</summary>
    Task<IReadOnlyDictionary<ProductStatus, int>> CountByStatusAsync(CancellationToken ct = default);

    Task<int> CountSoldSinceAsync(DateTime sinceUtc, CancellationToken ct = default);

    /// <summary>Ціни й статуси всіх речей категорії (без чернеток) — для підказки ціни.</summary>
    Task<IReadOnlyList<ProductPrice>> GetPricesAsync(ProductCategory category, CancellationToken ct = default);

    /// <summary>«Довго не продаються»: у продажу з якоїсь дати й раніше, найстаріші першими.</summary>
    Task<IReadOnlyList<Product>> GetStaleAsync(DateTime listedBeforeUtc, int take, CancellationToken ct = default);

    /// <summary>Сума цін усього, що зараз у продажу.</summary>
    Task<decimal> GetAvailableValueAsync(CancellationToken ct = default);

    void Add(Product product);
    void Remove(Product product);
}
