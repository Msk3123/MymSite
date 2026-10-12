namespace SiteMym.Application.Common;

/// <summary>Секція «Shop» в appsettings.json.</summary>
public sealed class ShopSettings
{
    public const string SectionName = "Shop";

    public string Name { get; set; } = "Мамина шафа";

    /// <summary>Ім’я власниці (називний відмінок) — для помічника.</summary>
    public string OwnerName { get; set; } = "Лариса";

    /// <summary>Кличний відмінок для привітання в кабінеті: «Добрий день, Ларисо!».</summary>
    public string OwnerNameVocative { get; set; } = "Ларисо";

    /// <summary>Часовий пояс для «сьогодні» й «цього місяця».</summary>
    public string TimeZone { get; set; } = "Europe/Kyiv";
}
