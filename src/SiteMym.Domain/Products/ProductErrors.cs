using SiteMym.Domain.Common;

namespace SiteMym.Domain.Products;

public static class ProductErrors
{
    public static readonly Error NotFound = new("Product.NotFound", "Річ не знайдено");
    public static readonly Error SkuRequired = new("Product.SkuRequired", "Артикул обов'язковий");
    public static readonly Error SkuTaken = new("Product.SkuTaken", "Річ з таким артикулом уже є");
    public static readonly Error NameRequired = new("Product.NameRequired", "Назва обов'язкова");
    public static readonly Error InvalidPrice = new("Product.InvalidPrice", "Ціна має бути більшою за нуль");
    public static readonly Error InvalidOldPrice = new("Product.InvalidOldPrice", "Стара ціна має бути більшою за нову");
    public static readonly Error InvalidSize = new("Product.InvalidSize", "Зріст має бути від 44 до 176 см");
    public static readonly Error PhotoUrlRequired = new("Product.PhotoUrlRequired", "Посилання на фото обов'язкове");
    public static readonly Error PhotoNotFound = new("Product.PhotoNotFound", "Фото не знайдено");
    public static readonly Error TooManyPhotos = new("Product.TooManyPhotos", $"Не більше {Product.MaxPhotos} фото на одну річ");
    public static readonly Error PhotoInvalid = new("Product.PhotoInvalid", "Це не схоже на фото. Підходять JPG, PNG або WebP до 10 МБ");
    public static readonly Error ReservedCannotDelete = new(
        "Product.ReservedCannotDelete",
        "Ця річ зараз у замовленні. Спершу завершіть або скасуйте замовлення — тоді її можна буде видалити");

    public static Error NotAvailable(string sku) =>
        new("Product.NotAvailable", $"Річ {sku} вже зарезервована або продана");

    public static Error InvalidStatusTransition(ProductStatus from, ProductStatus to) =>
        new("Product.InvalidStatus", from == to
            ? $"Річ уже має статус «{Label(to)}»"
            : $"Не можна змінити статус «{Label(from)}» на «{Label(to)}»");

    private static string Label(ProductStatus status) => status switch
    {
        ProductStatus.Draft => "Чернетка",
        ProductStatus.Available => "У продажу",
        ProductStatus.Reserved => "Заброньовано",
        ProductStatus.Sold => "Продано",
        _ => status.ToString()
    };
}
