using Microsoft.EntityFrameworkCore;
using SiteMym.Domain.Products;

namespace SiteMym.Infrastructure.Persistence.Seed;

/// <summary>
/// Тестовий асортимент для локальної розробки — ті самі речі, що були в моку фронта.
/// Запускається лише в Development і лише на порожню базу.
/// </summary>
internal static class DevelopmentSeeder
{
    public static async Task SeedAsync(AppDbContext db, CancellationToken ct = default)
    {
        if (await db.Products.AnyAsync(ct))
            return;

        var items = Items();
        var now = DateTime.UtcNow;

        // Список іде від найновіших — розставляємо дати через 2 дні: «Спершу нові» як у моку, і є що показати в «Довго не продаються».
        for (var i = 0; i < items.Length; i++)
        {
            var (product, sold) = items[i];
            product.Publish();
            // Для демо «Де лежить»: розкладаємо по коробках.
            product.SetStorageLocation($"Коробка {i % 7 + 1}");
            if (sold)
                product.MarkSold();

            db.Products.Add(product);
            db.Entry(product).Property(p => p.CreatedAtUtc).CurrentValue = now.AddDays(-2 * i);
        }

        await db.SaveChangesAsync(ct);
    }

    private static (Product Product, bool Sold)[] Items() =>
    [
        Item("МШ-0412", "Куртка демісезонна", "Куртка демісезонна з капюшоном", "Reserved",
            Gender.Boy, ProductCategory.Outerwear, Season.AutumnWinter, ItemCondition.VeryGood, 98, 650, 1199,
            "Носили один сезон. Без плям, блискавка ходить легко, підкладка ціла. Невелика потертість на лівому манжеті — фото 4.",
            new ProductDetails(
                SeasonNote: "Осінь, весна · від +5 до +15 °C",
                Composition: "Верх 100% поліестер, підкладка 100% бавовна",
                Insulation: "Тонкий, 80 г",
                FitNote: "Сідає трохи більше, див. заміри",
                DefectNote: "Потертість ~1 см на лівому манжеті"),
            measurements:
            [
                new("Довжина по спинці", "Довжина", 46),
                new("Ширина під пахвами", "Під пахвами", 38),
                new("Рукав від горловини", "Рукав", 44),
                new("Ширина плечей", "Плечі", 30)
            ]),
        Item("МШ-0388", "Світшот з начосом", "Світшот з начосом", "H&M",
            Gender.Boy, ProductCategory.Tops, Season.AutumnWinter, ItemCondition.New, 98, 220, null,
            "Новий, з біркою. Теплий начос всередині, манжети не розтягнуті.",
            new ProductDetails(Composition: "80% бавовна, 20% поліестер")),
        Item("МШ-0391", "Штани вельветові", "Штани вельветові на резинці", "Next",
            Gender.Boy, ProductCategory.Pants, Season.AutumnWinter, ItemCondition.VeryGood, 98, 190, null,
            "Вельвет не витертий на колінах, резинка тримає добре. Регулюється в поясі.",
            new ProductDetails(Composition: "98% бавовна, 2% еластан")),
        Item("МШ-0377", "Комбінезон зимовий", "Комбінезон зимовий", "Next",
            Gender.Boy, ProductCategory.Outerwear, Season.AutumnWinter, ItemCondition.LikeNew, 98, 900, null,
            "Носили одну зиму, без жодних слідів.",
            new ProductDetails(Insulation: "Синтепух, 250 г"), sold: true),
        Item("МШ-0402", "Жилет стьобаний", "Жилет стьобаний", "Reserved",
            Gender.Boy, ProductCategory.Outerwear, Season.AutumnWinter, ItemCondition.LikeNew, 98, 340, 520,
            "Легкий жилет на кнопках, добре під куртку або на светр.",
            new ProductDetails(Insulation: "Тонкий, 60 г")),
        Item("МШ-0365", "Черевики утеплені", "Черевики утеплені на липучках", "Zara Kids",
            Gender.Boy, ProductCategory.Shoes, Season.AutumnWinter, ItemCondition.Good, 98, 420, null,
            "Підошва ціла, носки трохи потерті — видно на фото. Устілка 16,5 см.",
            new ProductDetails(SizeNote: "р. 26", DefectNote: "Потерті носки")),
        Item("МШ-0359", "Шапка з помпоном", "Шапка в’язана з помпоном", "H&M",
            Gender.Unisex, ProductCategory.Hats, Season.AutumnWinter, ItemCondition.New, 92, 180, null,
            "Нова, з біркою. Підкладка з флісу, не колеться.",
            new ProductDetails(SizeNote: "48–50 см", Composition: "100% акрил, підкладка фліс")),
        Item("МШ-0350", "Лонгсліви, 2 шт", "Лонгсліви бавовняні, 2 шт", "H&M",
            Gender.Boy, ProductCategory.Tops, Season.AllSeason, ItemCondition.VeryGood, 98, 150, null,
            "Два лонгсліви однієї моделі. Без плям і катишків.",
            new ProductDetails(Composition: "100% бавовна")),
        Item("МШ-0344", "Комбінезон зимовий", "Комбінезон зимовий з капюшоном", "Next",
            Gender.Unisex, ProductCategory.Outerwear, Season.AutumnWinter, ItemCondition.LikeNew, 86, 900, null,
            "Як новий — навіть бірка на запасному ґудзику ціла. Знімні пінетки.",
            new ProductDetails(Insulation: "Синтепух, 300 г")),
        Item("МШ-0338", "Жилет стьобаний", "Жилет стьобаний", "Reserved",
            Gender.Boy, ProductCategory.Outerwear, Season.AutumnWinter, ItemCondition.VeryGood, 104, 340, 520,
            "Без пошкоджень, кнопки працюють."),
        Item("МШ-0331", "Сукня трикотажна", "Сукня трикотажна з довгим рукавом", "Zara Kids",
            Gender.Girl, ProductCategory.Dresses, Season.AllSeason, ItemCondition.LikeNew, 104, 260, null,
            "Вдягали двічі на свята. Тканина щільна, не просвічує.",
            new ProductDetails(Composition: "95% бавовна, 5% еластан")),
        Item("МШ-0327", "Куртка-парка", "Куртка-парка утеплена", "Reserved",
            Gender.Girl, ProductCategory.Outerwear, Season.AutumnWinter, ItemCondition.VeryGood, 110, 780, 1400,
            "Тепла парка з відстібним хутром на капюшоні. Блискавка ціла.",
            new ProductDetails(Insulation: "Синтепон, 200 г")),
        Item("МШ-0320", "Світшот", "Світшот з принтом", "Cool Club",
            Gender.Girl, ProductCategory.Tops, Season.AllSeason, ItemCondition.VeryGood, 104, 160, null,
            "Принт не потріскався, після прання форму тримає.",
            new ProductDetails(Composition: "100% бавовна")),
        Item("МШ-0316", "Легінси, 2 шт", "Легінси бавовняні, 2 шт", "H&M",
            Gender.Girl, ProductCategory.Pants, Season.AllSeason, ItemCondition.Good, 104, 120, null,
            "Звичайні домашні легінси, на одних трохи витерті коліна.",
            new ProductDetails(DefectNote: "Трохи витерті коліна")),
        Item("МШ-0310", "Сукня літня", "Сукня літня з льону", "Next",
            Gender.Girl, ProductCategory.Dresses, Season.SpringSummer, ItemCondition.New, 116, 300, null,
            "Нова, з біркою — не вгадали з розміром.",
            new ProductDetails(Composition: "55% льон, 45% бавовна")),
        Item("МШ-0305", "Боді з довгим рукавом, 3 шт", "Боді з довгим рукавом, 3 шт", "Carter’s",
            Gender.Unisex, ProductCategory.Sleepwear, Season.AllSeason, ItemCondition.VeryGood, 68, 210, null,
            "Три боді, кнопки всі на місці. Прані дитячим засобом.",
            new ProductDetails(Composition: "100% бавовна")),
        Item("МШ-0301", "Піжама", "Піжама бавовняна", "H&M",
            Gender.Unisex, ProductCategory.Sleepwear, Season.AllSeason, ItemCondition.LikeNew, 92, 170, null,
            "Кофта і штани, мʼяка, після кількох прань.",
            new ProductDetails(Composition: "100% бавовна")),
        Item("МШ-0296", "Кросівки", "Кросівки текстильні", "Geox",
            Gender.Boy, ProductCategory.Shoes, Season.SpringSummer, ItemCondition.VeryGood, 110, 450, 1800,
            "Підошва не стерта, липучки тримають. Устілка 18,5 см.",
            new ProductDetails(SizeNote: "р. 29")),
        Item("МШ-0290", "Шорти, 2 шт", "Шорти джинсові, 2 шт", "Zara Kids",
            Gender.Boy, ProductCategory.Pants, Season.SpringSummer, ItemCondition.VeryGood, 110, 180, null,
            "Дві пари, регулювання в поясі."),
        Item("МШ-0284", "Футболки, 3 шт", "Футболки бавовняні, 3 шт", "Primark",
            Gender.Boy, ProductCategory.Tops, Season.SpringSummer, ItemCondition.Good, 116, 140, null,
            "Звичайні футболки на кожен день, без плям."),
        Item("МШ-0279", "Комбінезон демісезонний", "Комбінезон демісезонний", "Reima",
            Gender.Unisex, ProductCategory.Outerwear, Season.AutumnWinter, ItemCondition.VeryGood, 80, 950, 3200,
            "Мембрана, не промокає. Світловідбивачі цілі.",
            new ProductDetails(Insulation: "Тонкий, 60 г")),
        Item("МШ-0270", "Шапка-шолом", "Шапка-шолом вовняна", "Lenne",
            Gender.Unisex, ProductCategory.Hats, Season.AutumnWinter, ItemCondition.LikeNew, 80, 260, null,
            "Мериносова вовна, не колеться. Закриває шийку.",
            new ProductDetails(SizeNote: "46–48 см", Composition: "100% вовна мериноса")),
        Item("МШ-0262", "Кофта флісова", "Кофта флісова на блискавці", "Decathlon",
            Gender.Unisex, ProductCategory.Tops, Season.AutumnWinter, ItemCondition.Good, 122, 180, null,
            "Трохи катишків під пахвами, блискавка працює.",
            new ProductDetails(DefectNote: "Катишки під пахвами")),
        Item("МШ-0255", "Пуховик", "Пуховик з капюшоном", "Columbia",
            Gender.Boy, ProductCategory.Outerwear, Season.AutumnWinter, ItemCondition.VeryGood, 128, 1200, 3900,
            "Тепла зимова куртка, без плям і затяжок.",
            new ProductDetails(Insulation: "Пух 80/20")),
        Item("МШ-0248", "Сукня святкова", "Сукня святкова з фатином", "Mayoral",
            Gender.Girl, ProductCategory.Dresses, Season.AllSeason, ItemCondition.LikeNew, 128, 480, 1600,
            "Одягали один раз на виступ. Фатин пишний."),
        Item("МШ-0240", "Боді короткий рукав, 4 шт", "Боді з коротким рукавом, 4 шт", "Smil",
            Gender.Unisex, ProductCategory.Sleepwear, Season.SpringSummer, ItemCondition.New, 62, 240, null,
            "Нові, у пакуванні.",
            new ProductDetails(Composition: "100% бавовна")),
        Item("МШ-Л-07", "Перша зима, 80 см", "Комплект «Перша зима», 80 см", "Різні бренди",
            Gender.Unisex, ProductCategory.Lots, Season.AutumnWinter, ItemCondition.VeryGood, 80, 1150, 1480,
            "Комбінезон, 2 шапки, термобілизна, 2 боді — усе одного розміру, усе перевірено.",
            new ProductDetails(LotContents: "Комбінезон, 2 шапки, термобілизна, 2 боді — 6 речей")),
        Item("МШ-Л-05", "У садочок, 104 см", "Комплект «У садочок», 104 см", "Різні бренди",
            Gender.Girl, ProductCategory.Lots, Season.AllSeason, ItemCondition.VeryGood, 104, 890, 1120,
            "2 сукні, світшот, легінси, кофта — на перший місяць у садочку.",
            new ProductDetails(LotContents: "2 сукні, світшот, легінси, кофта — 5 речей"))
    ];

    private static (Product, bool) Item(
        string sku, string name, string title, string brand,
        Gender gender, ProductCategory category, Season season, ItemCondition condition,
        int sizeCm, decimal price, decimal? oldPrice, string description,
        ProductDetails? details = null, Measurement[]? measurements = null, bool sold = false)
    {
        var product = Product
            .Create(sku, name, title, brand, gender, category, season, condition, sizeCm, price, oldPrice, description)
            .Value;

        if (details is not null)
            product.UpdateDetails(details);
        if (measurements is not null)
            product.SetMeasurements(measurements);

        return (product, sold);
    }
}
