using SiteMym.Api.Common;
using SiteMym.Application.Products;
using SiteMym.Domain.Products;

namespace SiteMym.Api.Endpoints.Products;

/// <summary>
/// Query-параметри каталогу:
/// <c>?gender=boy&amp;size=98&amp;season=autumn-winter&amp;conditions=new,like-new&amp;category=outerwear
/// &amp;minPrice=100&amp;maxPrice=500&amp;search=куртка&amp;sort=price-asc&amp;includeSold=false&amp;page=1&amp;pageSize=24</c>
/// </summary>
public sealed record CatalogQuery(
    string? Gender,
    int? Size,
    string? Season,
    string? Conditions,
    string? Category,
    decimal? MinPrice,
    decimal? MaxPrice,
    string? Search,
    string? Sort,
    bool? IncludeSold,
    int? Page,
    int? PageSize)
{
    public bool TryToFilter(out ProductFilter filter, out Dictionary<string, string[]> errors)
    {
        var problems = new Dictionary<string, string[]>();

        var conditions = new List<ItemCondition>();
        foreach (var raw in (Conditions ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries))
        {
            if (KebabEnum.TryParse<ItemCondition>(raw, out var condition))
                conditions.Add(condition);
            else
                problems["conditions"] = [$"Можливі значення: {KebabEnum.Allowed<ItemCondition>()}"];
        }

        filter = new ProductFilter
        {
            Gender = Parse<Gender>(Gender, "gender", problems),
            SizeCm = Size,
            Season = Parse<Season>(Season, "season", problems),
            Conditions = conditions.Distinct().ToList(),
            Category = Parse<ProductCategory>(Category, "category", problems),
            MinPrice = MinPrice,
            MaxPrice = MaxPrice,
            Search = string.IsNullOrWhiteSpace(Search) ? null : Search.Trim(),
            IncludeSold = IncludeSold ?? true,
            Sort = Parse<ProductSort>(Sort, "sort", problems) ?? ProductSort.Newest,
            Page = Page ?? 1,
            PageSize = PageSize ?? 24
        };

        errors = problems;
        return problems.Count == 0;
    }

    private static TEnum? Parse<TEnum>(string? value, string name, Dictionary<string, string[]> problems)
        where TEnum : struct, Enum
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;
        if (KebabEnum.TryParse<TEnum>(value, out var result))
            return result;

        problems[name] = [$"Можливі значення: {KebabEnum.Allowed<TEnum>()}"];
        return null;
    }
}
