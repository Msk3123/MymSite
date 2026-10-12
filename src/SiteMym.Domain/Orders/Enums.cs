namespace SiteMym.Domain.Orders;

public enum OrderStatus
{
    /// <summary>Щойно оформлене на сайті, речі зарезервовані.</summary>
    New,

    /// <summary>Продавчиня підтвердила наявність і зв'язалася з покупцем.</summary>
    Confirmed,

    /// <summary>Відправлено Новою Поштою, є ТТН.</summary>
    Shipped,

    Completed,
    Cancelled
}

public enum PaymentMethod
{
    /// <summary>Переказ на карту після підтвердження.</summary>
    Card,

    /// <summary>Накладений платіж на Новій Пошті.</summary>
    CashOnDelivery
}
