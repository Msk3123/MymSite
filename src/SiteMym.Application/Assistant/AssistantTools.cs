using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using SiteMym.Application.Abstractions.Ai;
using SiteMym.Application.Abstractions.Messaging;
using SiteMym.Application.Common;
using SiteMym.Application.Dashboard;
using SiteMym.Application.Orders.Manage;
using SiteMym.Application.Products;
using SiteMym.Application.Products.Manage;
using SiteMym.Domain.Orders;
using SiteMym.Domain.Products;

namespace SiteMym.Application.Assistant;

/// <summary>
/// Що помічник може дізнатися про магазин. Усе — лише читання: змінювати щось він не вміє,
/// тож випадково «скасувати замовлення» через неточне формулювання неможливо.
/// Телефонів покупців моделі не віддаємо — у відповідях вони не потрібні.
/// </summary>
internal sealed class AssistantTools(
    IQueryHandler<GetShopSummaryQuery, ShopSummary> summary,
    IQueryHandler<GetOrdersQuery, PagedList<OrderResponse>> listOrders,
    IQueryHandler<GetOrderQuery, OrderResponse> getOrder,
    IQueryHandler<GetAdminProductsQuery, PagedList<AdminProductListItem>> findProducts,
    ShopClock clock)
{
    private const int MaxLimit = 20;

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        // Кирилиця як є, а не Р… — менше токенів і модель краще читає.
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.KebabCaseLower) }
    };

    // Описи короткі навмисно: вони їдуть з кожним запитом до моделі.
    public static IReadOnlyList<ChatTool> Definitions { get; } =
    [
        new("get_help",
            "Розділ інструкції по кабінету: як зробити щось і як називаються кнопки.",
            HelpSchema()),

        new("get_shop_summary",
            "Зведення: замовлення й гроші сьогодні/за місяць, скільки нових/підтверджених/відправлених, речі на сайті, у чернетках, продані, довго не продаються.",
            """{"type":"object","properties":{},"additionalProperties":false}"""),

        new("list_orders",
            "Замовлення з сайту, новіші першими. status: new — нові, confirmed — треба відправити, shipped — в дорозі, completed — забрали, cancelled.",
            """{"type":"object","properties":{"status":{"type":"string","enum":["new","confirmed","shipped","completed","cancelled"]},"limit":{"type":"integer","minimum":1,"maximum":20}},"additionalProperties":false}"""),

        new("get_order",
            "Замовлення за номером: речі, сума, місто, відділення, коментар, ТТН.",
            """{"type":"object","properties":{"number":{"type":"integer"}},"required":["number"],"additionalProperties":false}"""),

        new("find_products",
            "Пошук речей (назва, бренд, артикул). status: draft — чернетка, available — у продажу, reserved — заброньовано, sold — продано. Показує ціну, де лежить, днів на сайті.",
            """{"type":"object","properties":{"search":{"type":"string"},"status":{"type":"string","enum":["draft","available","reserved","sold"]},"size_cm":{"type":"integer"},"limit":{"type":"integer","minimum":1,"maximum":20}},"additionalProperties":false}""")
    ];

    /// <returns>JSON для моделі. Помилки теж повертаємо текстом — модель перекаже їх людською мовою.</returns>
    public async Task<string> ExecuteAsync(ChatToolCall call, CancellationToken ct)
    {
        JsonElement args;
        try
        {
            args = JsonDocument.Parse(string.IsNullOrWhiteSpace(call.ArgumentsJson) ? "{}" : call.ArgumentsJson).RootElement;
        }
        catch (JsonException)
        {
            return Error("Некоректні аргументи");
        }

        return call.Name switch
        {
            "get_help" => Help(args),
            "get_shop_summary" => await SummaryAsync(ct),
            "list_orders" => await ListOrdersAsync(args, ct),
            "get_order" => await GetOrderAsync(args, ct),
            "find_products" => await FindProductsAsync(args, ct),
            _ => Error($"Невідомий інструмент {call.Name}")
        };
    }

    private async Task<string> SummaryAsync(CancellationToken ct)
    {
        var result = await summary.Handle(new GetShopSummaryQuery(), ct);
        if (result.IsFailure)
            return Error(result.Error.Message);

        // Лише цифри й назви — id, посилання на фото й час моделі не потрібні, а токени коштують.
        var s = result.Value;
        return Serialize(new
        {
            today = new { orders = s.OrdersToday, revenue = s.RevenueToday },
            month = new { orders = s.OrdersThisMonth, revenue = s.RevenueThisMonth, itemsSold = s.ItemsSoldThisMonth },
            ordersByStatus = new { @new = s.NewOrders, confirmed = s.ConfirmedOrders, shipped = s.ShippedOrders },
            items = new { onSale = s.ItemsOnSale, valueOnSale = s.ValueOnSale, reserved = s.ItemsReserved, drafts = s.Drafts, sold = s.ItemsSold },
            weeklySales = s.WeeklySales.Select(w => new { week = w.WeekStart.ToString("dd.MM"), w.Total }),
            staleItems = s.StaleItems.Select(i => new { i.Name, i.Brand, sizeCm = i.SizeCm, i.Price, days = i.DaysOnSite })
        });
    }

    private async Task<string> ListOrdersAsync(JsonElement args, CancellationToken ct)
    {
        var status = Enum<OrderStatus>(args, "status");
        var limit = Limit(args);
        var result = await listOrders.Handle(new GetOrdersQuery(status, 1, limit), ct);
        if (result.IsFailure)
            return Error(result.Error.Message);

        return Serialize(new
        {
            total = result.Value.TotalCount,
            orders = result.Value.Items.Select(o => new
            {
                o.Number,
                date = clock.ToLocal(o.CreatedAtUtc).ToString("dd.MM.yyyy HH:mm"),
                o.Status,
                customer = o.CustomerName,
                o.City,
                o.Total,
                items = o.Items.Count
            })
        });
    }

    private async Task<string> GetOrderAsync(JsonElement args, CancellationToken ct)
    {
        if (!args.TryGetProperty("number", out var n) || !n.TryGetInt32(out var number))
            return Error("Потрібен номер замовлення");

        var result = await getOrder.Handle(new GetOrderQuery(number), ct);
        if (result.IsFailure)
            return Error(result.Error.Message);

        var o = result.Value;
        return Serialize(new
        {
            o.Number,
            date = clock.ToLocal(o.CreatedAtUtc).ToString("dd.MM.yyyy HH:mm"),
            o.Status,
            customer = o.CustomerName,
            o.City,
            o.Branch,
            o.Payment,
            o.Comment,
            o.TrackingNumber,
            o.Subtotal,
            o.Discount,
            o.Total,
            items = o.Items.Select(i => new { i.Sku, i.Name, sizeCm = i.SizeCm, i.Price })
        });
    }

    private async Task<string> FindProductsAsync(JsonElement args, CancellationToken ct)
    {
        var status = Enum<ProductStatus>(args, "status");
        var filter = new ProductFilter
        {
            Search = args.TryGetProperty("search", out var s) && s.ValueKind == JsonValueKind.String ? s.GetString() : null,
            SizeCm = args.TryGetProperty("size_cm", out var size) && size.TryGetInt32(out var cm) ? cm : null,
            Status = status,
            IncludeDrafts = true,
            PageSize = Limit(args)
        };

        var result = await findProducts.Handle(new GetAdminProductsQuery(filter), ct);
        if (result.IsFailure)
            return Error(result.Error.Message);

        return Serialize(new
        {
            total = result.Value.TotalCount,
            products = result.Value.Items.Select(p => new
            {
                p.Sku,
                p.Name,
                p.Brand,
                sizeCm = p.SizeCm,
                p.Price,
                p.Status,
                hasPhoto = p.CoverUrl is not null,
                whereStored = p.StorageLocation,
                daysOnSite = (int)(clock.UtcNow - p.CreatedAtUtc).TotalDays
            })
        });
    }

    private static string HelpSchema()
    {
        var topics = string.Join(",", AssistantGuide.Topics.Keys.Select(k => $"\"{k}\""));
        return "{\"type\":\"object\",\"properties\":{\"topic\":{\"type\":\"string\",\"enum\":[" + topics +
               "]}},\"required\":[\"topic\"],\"additionalProperties\":false}";
    }

    private static string Help(JsonElement args) =>
        args.TryGetProperty("topic", out var t) && t.GetString() is { } topic && AssistantGuide.Topics.TryGetValue(topic, out var text)
            ? text
            : Error($"Є розділи: {string.Join(", ", AssistantGuide.Topics.Keys)}");

    private static int Limit(JsonElement args) =>
        args.TryGetProperty("limit", out var l) && l.TryGetInt32(out var limit) ? Math.Clamp(limit, 1, MaxLimit) : 10;

    private static TEnum? Enum<TEnum>(JsonElement args, string name) where TEnum : struct, Enum
    {
        if (!args.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.String)
            return null;

        var text = value.GetString();
        return System.Enum.GetValues<TEnum>()
            .Cast<TEnum?>()
            .FirstOrDefault(e => string.Equals(JsonNamingPolicy.KebabCaseLower.ConvertName(e.ToString()!), text, StringComparison.OrdinalIgnoreCase));
    }

    private static string Serialize(object value) => JsonSerializer.Serialize(value, Json);

    private static string Error(string message) => Serialize(new { error = message });
}
