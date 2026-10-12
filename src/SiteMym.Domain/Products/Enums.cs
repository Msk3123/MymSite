namespace SiteMym.Domain.Products;

public enum Gender
{
    Boy,
    Girl,
    Unisex
}

public enum Season
{
    AutumnWinter,
    SpringSummer,
    AllSeason
}

public enum ProductCategory
{
    Outerwear,
    Tops,
    Pants,
    Dresses,
    Shoes,
    Hats,
    Sleepwear,
    Lots
}

/// <summary>Стан речі. Порядок важливий — від гіршого до кращого (шкала «N з 4» на сайті).</summary>
public enum ItemCondition
{
    Good = 1,
    VeryGood = 2,
    LikeNew = 3,
    New = 4
}

/// <summary>Кожна річ існує в одному екземплярі, тому замість залишків — статус.</summary>
public enum ProductStatus
{
    Draft,
    Available,
    Reserved,
    Sold
}
