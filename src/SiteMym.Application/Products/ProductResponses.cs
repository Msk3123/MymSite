using SiteMym.Domain.Products;

namespace SiteMym.Application.Products;

/// <summary>Річ для картки в каталозі, на головній і в кошику.</summary>
public record ProductListItem
{
    public required Guid Id { get; init; }
    public required string Slug { get; init; }
    public required string Sku { get; init; }
    public required string Name { get; init; }
    public required string Title { get; init; }
    public required string Brand { get; init; }
    public required Gender Gender { get; init; }
    public required ProductCategory Category { get; init; }
    public required Season Season { get; init; }
    public required ItemCondition Condition { get; init; }
    public required int SizeCm { get; init; }

    /// <summary>Як розмір написано на бірці, якщо це не зріст: «р. 26».</summary>
    public string? SizeNote { get; init; }

    public required decimal Price { get; init; }
    public decimal? OldPrice { get; init; }
    public required ProductStatus Status { get; init; }

    /// <summary>Для комплектів: «Комбінезон, 2 шапки… — 6 речей».</summary>
    public string? LotContents { get; init; }

    public string? CoverUrl { get; init; }

    public required DateTime CreatedAtUtc { get; init; }
}

/// <summary>Усе для сторінки товару.</summary>
public record ProductResponse : ProductListItem
{
    public required string Description { get; init; }
    public string? SeasonNote { get; init; }
    public string? Composition { get; init; }
    public string? Insulation { get; init; }
    public string? FitNote { get; init; }
    public string? DefectNote { get; init; }
    public required IReadOnlyList<MeasurementResponse> Measurements { get; init; }
    public required IReadOnlyList<PhotoResponse> Photos { get; init; }
}

/// <summary>Рядок у «Мої речі»: плюс те, що бачить тільки продавчиня.</summary>
public sealed record AdminProductListItem : ProductListItem
{
    public string? StorageLocation { get; init; }
    public bool HasDefect { get; init; }
}

/// <summary>Форма речі в адмінці.</summary>
public sealed record AdminProductResponse : ProductResponse
{
    public string? StorageLocation { get; init; }
}

public sealed record MeasurementResponse(string Label, string ShortLabel, int ValueCm);

public sealed record PhotoResponse(Guid Id, string Url, string? Caption, bool IsDefect);

internal static class ProductMappings
{
    public static AdminProductListItem ToAdminListItem(this Product p) => new()
    {
        Id = p.Id,
        Slug = p.Slug,
        Sku = p.Sku,
        Name = p.Name,
        Title = p.Title,
        Brand = p.Brand,
        Gender = p.Gender,
        Category = p.Category,
        Season = p.Season,
        Condition = p.Condition,
        SizeCm = p.SizeCm,
        SizeNote = p.Details.SizeNote,
        Price = p.Price,
        OldPrice = p.OldPrice,
        Status = p.Status,
        LotContents = p.Details.LotContents,
        CoverUrl = p.Photos.MinBy(ph => ph.SortOrder)?.Url,
        CreatedAtUtc = p.CreatedAtUtc,
        StorageLocation = p.StorageLocation,
        HasDefect = p.Details.DefectNote is not null
    };

    public static AdminProductResponse ToAdminResponse(this Product p) => new()
    {
        Id = p.Id,
        Slug = p.Slug,
        Sku = p.Sku,
        Name = p.Name,
        Title = p.Title,
        Brand = p.Brand,
        Gender = p.Gender,
        Category = p.Category,
        Season = p.Season,
        Condition = p.Condition,
        SizeCm = p.SizeCm,
        SizeNote = p.Details.SizeNote,
        Price = p.Price,
        OldPrice = p.OldPrice,
        Status = p.Status,
        LotContents = p.Details.LotContents,
        CoverUrl = p.Photos.MinBy(ph => ph.SortOrder)?.Url,
        CreatedAtUtc = p.CreatedAtUtc,
        Description = p.Description,
        SeasonNote = p.Details.SeasonNote,
        Composition = p.Details.Composition,
        Insulation = p.Details.Insulation,
        FitNote = p.Details.FitNote,
        DefectNote = p.Details.DefectNote,
        Measurements = p.Measurements
            .Select(m => new MeasurementResponse(m.Label, m.ShortLabel, m.ValueCm))
            .ToList(),
        Photos = p.Photos
            .OrderBy(ph => ph.SortOrder)
            .Select(ph => new PhotoResponse(ph.Id, ph.Url, ph.Caption, ph.IsDefect))
            .ToList(),
        StorageLocation = p.StorageLocation
    };

    public static ProductListItem ToListItem(this Product p) => new()
    {
        Id = p.Id,
        Slug = p.Slug,
        Sku = p.Sku,
        Name = p.Name,
        Title = p.Title,
        Brand = p.Brand,
        Gender = p.Gender,
        Category = p.Category,
        Season = p.Season,
        Condition = p.Condition,
        SizeCm = p.SizeCm,
        SizeNote = p.Details.SizeNote,
        Price = p.Price,
        OldPrice = p.OldPrice,
        Status = p.Status,
        LotContents = p.Details.LotContents,
        CoverUrl = p.Photos.MinBy(ph => ph.SortOrder)?.Url,
        CreatedAtUtc = p.CreatedAtUtc
    };

    public static ProductResponse ToResponse(this Product p) => new()
    {
        Id = p.Id,
        Slug = p.Slug,
        Sku = p.Sku,
        Name = p.Name,
        Title = p.Title,
        Brand = p.Brand,
        Gender = p.Gender,
        Category = p.Category,
        Season = p.Season,
        Condition = p.Condition,
        SizeCm = p.SizeCm,
        SizeNote = p.Details.SizeNote,
        Price = p.Price,
        OldPrice = p.OldPrice,
        Status = p.Status,
        LotContents = p.Details.LotContents,
        CoverUrl = p.Photos.MinBy(ph => ph.SortOrder)?.Url,
        CreatedAtUtc = p.CreatedAtUtc,
        Description = p.Description,
        SeasonNote = p.Details.SeasonNote,
        Composition = p.Details.Composition,
        Insulation = p.Details.Insulation,
        FitNote = p.Details.FitNote,
        DefectNote = p.Details.DefectNote,
        Measurements = p.Measurements
            .Select(m => new MeasurementResponse(m.Label, m.ShortLabel, m.ValueCm))
            .ToList(),
        Photos = p.Photos
            .OrderBy(ph => ph.SortOrder)
            .Select(ph => new PhotoResponse(ph.Id, ph.Url, ph.Caption, ph.IsDefect))
            .ToList()
    };
}
