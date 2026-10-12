using SiteMym.Domain.Common;

namespace SiteMym.Domain.Products;

public sealed class Product : Entity
{
    public const int MinSizeCm = 44;
    public const int MaxSizeCm = 176;
    public const int MaxPhotos = 12;

    private readonly List<Measurement> _measurements = [];
    private readonly List<ProductPhoto> _photos = [];

    private Product() { }

    public string Sku { get; private set; } = null!;
    public string Slug { get; private set; } = null!;

    /// <summary>Коротка назва для картки: «Куртка демісезонна».</summary>
    public string Name { get; private set; } = null!;

    /// <summary>Повна назва для сторінки товару: «Куртка демісезонна з капюшоном».</summary>
    public string Title { get; private set; } = null!;

    public string Brand { get; private set; } = null!;
    public string Description { get; private set; } = string.Empty;

    public Gender Gender { get; private set; }
    public ProductCategory Category { get; private set; }
    public Season Season { get; private set; }
    public ItemCondition Condition { get; private set; }

    /// <summary>Зріст дитини в см — основний фільтр каталогу.</summary>
    public int SizeCm { get; private set; }

    public decimal Price { get; private set; }
    public decimal? OldPrice { get; private set; }

    public ProductDetails Details { get; private set; } = ProductDetails.Empty;

    /// <summary>«Коробка 7», «Полиця Б-3» — бачить тільки продавчиня, щоб швидко знайти річ при пакуванні.</summary>
    public string? StorageLocation { get; private set; }

    public ProductStatus Status { get; private set; }
    public DateTime? SoldAtUtc { get; private set; }

    /// <summary>
    /// Видалена річ, яку колись замовляли: з сайту й кабінету її не видно, фото стерті,
    /// але запис лишається — щоб у старих замовленнях було видно, що саме купили.
    /// </summary>
    public DateTime? DeletedAtUtc { get; private set; }

    public IReadOnlyList<Measurement> Measurements => _measurements;
    public IReadOnlyList<ProductPhoto> Photos => _photos;

    public bool IsAvailable => Status == ProductStatus.Available;

    public static Result<Product> Create(
        string sku,
        string name,
        string title,
        string brand,
        Gender gender,
        ProductCategory category,
        Season season,
        ItemCondition condition,
        int sizeCm,
        decimal price,
        decimal? oldPrice = null,
        string? description = null)
    {
        if (string.IsNullOrWhiteSpace(sku))
            return Result.Failure<Product>(ProductErrors.SkuRequired);
        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(title))
            return Result.Failure<Product>(ProductErrors.NameRequired);
        if (sizeCm is < MinSizeCm or > MaxSizeCm)
            return Result.Failure<Product>(ProductErrors.InvalidSize);

        var priceCheck = ValidatePrice(price, oldPrice);
        if (priceCheck.IsFailure)
            return Result.Failure<Product>(priceCheck.Error);

        return new Product
        {
            Sku = sku.Trim(),
            Slug = Common.Slug.From(sku),
            Name = name.Trim(),
            Title = title.Trim(),
            Brand = brand.Trim(),
            Description = description?.Trim() ?? string.Empty,
            Gender = gender,
            Category = category,
            Season = season,
            Condition = condition,
            SizeCm = sizeCm,
            Price = price,
            OldPrice = oldPrice,
            Status = ProductStatus.Draft
        };
    }

    public Result ChangePrice(decimal price, decimal? oldPrice)
    {
        var check = ValidatePrice(price, oldPrice);
        if (check.IsFailure)
            return check;

        Price = price;
        OldPrice = oldPrice;
        return Result.Success();
    }

    /// <summary>Редагування з адмінки: усе, крім ціни, статусу й фото. Артикул не змінюється — на нього посилаються замовлення.</summary>
    public Result UpdateInfo(
        string name,
        string title,
        string brand,
        Gender gender,
        ProductCategory category,
        Season season,
        ItemCondition condition,
        int sizeCm,
        string? description)
    {
        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(title))
            return Result.Failure(ProductErrors.NameRequired);
        if (sizeCm is < MinSizeCm or > MaxSizeCm)
            return Result.Failure(ProductErrors.InvalidSize);

        Name = name.Trim();
        Title = title.Trim();
        Brand = brand.Trim();
        Gender = gender;
        Category = category;
        Season = season;
        Condition = condition;
        SizeCm = sizeCm;
        Description = description?.Trim() ?? string.Empty;
        return Result.Success();
    }

    public void UpdateDetails(ProductDetails details) => Details = details;

    public void SetStorageLocation(string? location) =>
        StorageLocation = string.IsNullOrWhiteSpace(location) ? null : location.Trim();

    public void SetMeasurements(IEnumerable<Measurement> measurements)
    {
        _measurements.Clear();
        _measurements.AddRange(measurements);
    }

    public Result<ProductPhoto> AddPhoto(string url, string? caption = null, bool isDefect = false)
    {
        if (string.IsNullOrWhiteSpace(url))
            return Result.Failure<ProductPhoto>(ProductErrors.PhotoUrlRequired);
        if (_photos.Count >= MaxPhotos)
            return Result.Failure<ProductPhoto>(ProductErrors.TooManyPhotos);

        var photo = new ProductPhoto(Id, url.Trim(), caption?.Trim(), isDefect, _photos.Count);
        _photos.Add(photo);
        return photo;
    }

    /// <returns>Видалене фото — щоб викликач прибрав і файл.</returns>
    public Result<ProductPhoto> RemovePhoto(Guid photoId)
    {
        var photo = _photos.Find(p => p.Id == photoId);
        if (photo is null)
            return Result.Failure<ProductPhoto>(ProductErrors.PhotoNotFound);

        _photos.Remove(photo);
        Renumber();
        return photo;
    }

    /// <summary>Перше фото — обкладинка в каталозі.</summary>
    public Result MakePhotoCover(Guid photoId)
    {
        var photo = _photos.Find(p => p.Id == photoId);
        if (photo is null)
            return Result.Failure(ProductErrors.PhotoNotFound);

        var ordered = _photos.OrderBy(p => p.SortOrder).ToList();
        ordered.Remove(photo);
        ordered.Insert(0, photo);
        for (var i = 0; i < ordered.Count; i++)
            ordered[i].SortOrder = i;
        return Result.Success();
    }

    private void Renumber()
    {
        var ordered = _photos.OrderBy(p => p.SortOrder).ToList();
        for (var i = 0; i < ordered.Count; i++)
            ordered[i].SortOrder = i;
    }

    /// <summary>Чернетка → у продажу. Поки річ у чернетці, на сайті її не видно.</summary>
    public Result Publish() => MoveTo(ProductStatus.Available, ProductStatus.Draft);

    /// <summary>
    /// Прибрати річ назавжди. Не можна, поки вона в незакритому замовленні:
    /// спершу замовлення треба завершити або скасувати.
    /// </summary>
    /// <returns>Фото, які треба стерти з диска.</returns>
    public Result<IReadOnlyList<ProductPhoto>> Delete()
    {
        if (Status == ProductStatus.Reserved)
            return Result.Failure<IReadOnlyList<ProductPhoto>>(ProductErrors.ReservedCannotDelete);

        IReadOnlyList<ProductPhoto> photos = _photos.ToList();
        _photos.Clear();
        DeletedAtUtc = DateTime.UtcNow;
        return Result.Success(photos);
    }

    /// <summary>Сховати з сайту (наприклад, віддала знайомим або треба перефотографувати).</summary>
    public Result Unpublish() => MoveTo(ProductStatus.Draft, ProductStatus.Available);

    /// <summary>Річ потрапила в замовлення — більше ніхто не може її замовити.</summary>
    public Result Reserve() =>
        IsAvailable ? MoveTo(ProductStatus.Reserved, ProductStatus.Available) : Result.Failure(ProductErrors.NotAvailable(Sku));

    /// <summary>Замовлення скасоване — річ знову у продажу.</summary>
    public Result Release() => MoveTo(ProductStatus.Available, ProductStatus.Reserved);

    public Result MarkSold()
    {
        var result = MoveTo(ProductStatus.Sold, ProductStatus.Reserved, ProductStatus.Available);
        if (result.IsSuccess)
            SoldAtUtc = DateTime.UtcNow;
        return result;
    }

    private Result MoveTo(ProductStatus target, params ProductStatus[] allowedFrom)
    {
        if (!allowedFrom.Contains(Status))
            return Result.Failure(ProductErrors.InvalidStatusTransition(Status, target));

        Status = target;
        return Result.Success();
    }

    private static Result ValidatePrice(decimal price, decimal? oldPrice)
    {
        if (price <= 0)
            return Result.Failure(ProductErrors.InvalidPrice);
        if (oldPrice is not null && oldPrice <= price)
            return Result.Failure(ProductErrors.InvalidOldPrice);
        return Result.Success();
    }
}
