using SiteMym.Domain.Products;

namespace SiteMym.Application.Products;

public enum ProductSort
{
    Newest,
    PriceAsc,
    PriceDesc
}

/// <summary>Ті самі фільтри, що й у каталозі на фронті (?gender=boy&amp;size=98&amp;cond=new,like-new…).</summary>
public sealed record ProductFilter
{
    public const int MaxPageSize = 48;

    public Gender? Gender { get; init; }
    public int? SizeCm { get; init; }

    /// <summary>Речі «Всесезон» підходять під будь-який сезон.</summary>
    public Season? Season { get; init; }

    public IReadOnlyCollection<ItemCondition> Conditions { get; init; } = [];
    public ProductCategory? Category { get; init; }
    public decimal? MinPrice { get; init; }
    public decimal? MaxPrice { get; init; }

    /// <summary>Пошук за назвою, брендом та артикулом.</summary>
    public string? Search { get; init; }

    /// <summary>Лише для адмінки: показати й чернетки.</summary>
    public bool IncludeDrafts { get; init; }

    /// <summary>Лише для адмінки: конкретний статус (перекриває IncludeSold/IncludeDrafts).</summary>
    public ProductStatus? Status { get; init; }

    /// <summary>false — лише те, що можна замовити зараз (без проданого й заброньованого).</summary>
    public bool IncludeSold { get; init; } = true;

    public ProductSort Sort { get; init; } = ProductSort.Newest;
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 24;
}
