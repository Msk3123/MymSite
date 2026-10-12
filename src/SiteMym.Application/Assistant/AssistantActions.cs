using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using SiteMym.Application.Abstractions.Ai;
using SiteMym.Application.Abstractions.Messaging;
using SiteMym.Application.Abstractions.Persistence;
using SiteMym.Application.Orders.Manage;
using SiteMym.Application.Products;
using SiteMym.Application.Products.Manage;
using SiteMym.Domain.Common;
using SiteMym.Domain.Orders;
using SiteMym.Domain.Products;

namespace SiteMym.Application.Assistant;

public enum AssistantActionKind
{
    UpdateProduct,
    PublishProduct,
    HideProduct,
    MarkProductSold,
    DeleteProduct,
    ConfirmOrder,
    ShipOrder,
    CompleteOrder,
    CancelOrder
}

/// <summary>
/// Дія, яку помічник ПІДГОТУВАВ у «Режимі дій». Сама по собі нічого не змінює:
/// мама бачить картку з <see cref="Summary"/> і натискає «Так» → <see cref="ExecuteAssistantActionCommand"/>.
/// </summary>
public sealed record AssistantAction(
    AssistantActionKind Kind,
    string Summary,
    string? Sku = null,
    int? OrderNumber = null,
    decimal? Price = null,
    decimal? OldPrice = null,
    bool RemoveOldPrice = false,
    string? Name = null,
    string? Description = null,
    string? StorageLocation = null,
    string? TrackingNumber = null);

public sealed record AssistantActionResult(string Message);

/// <summary>
/// Інструменти «Режиму дій». Кожен лише перевіряє, що дія можлива, і описує її людською мовою —
/// виконання завжди окремо, після підтвердження мамою.
/// </summary>
internal sealed partial class AssistantActionTools(IProductRepository products, IOrderRepository orders)
{
    public static IReadOnlyList<ChatTool> Definitions { get; } =
    [
        new("update_product",
            "Підготувати зміну речі: ціна (будь-яка, вища чи нижча), назва, опис, де лежить. Вкажи лише те, що треба змінити. " +
            "old_price — закреслена ціна, ЛИШЕ якщо прямо просять показати знижку; 0 — прибрати закреслену.",
            """{"type":"object","properties":{"sku":{"type":"string"},"price":{"type":"number"},"old_price":{"type":"number"},"name":{"type":"string"},"description":{"type":"string"},"storage_location":{"type":"string"}},"required":["sku"],"additionalProperties":false}"""),

        new("change_product_status",
            "Підготувати: publish — показати на сайті; hide — сховати з сайту; mark_sold — продано поза сайтом.",
            """{"type":"object","properties":{"sku":{"type":"string"},"action":{"type":"string","enum":["publish","hide","mark_sold"]}},"required":["sku","action"],"additionalProperties":false}"""),

        new("delete_product",
            "Підготувати видалення речі назавжди (з фото). Лише на пряме прохання. sku — з find_products.",
            """{"type":"object","properties":{"sku":{"type":"string"}},"required":["sku"],"additionalProperties":false}"""),

        new("order_action",
            "Підготувати дію із замовленням: confirm — підтвердити; ship — відправлено (потрібен tracking_number, ТТН); complete — посилку забрали; cancel — скасувати.",
            """{"type":"object","properties":{"number":{"type":"integer"},"action":{"type":"string","enum":["confirm","ship","complete","cancel"]},"tracking_number":{"type":"string"}},"required":["number","action"],"additionalProperties":false}""")
    ];

    public static bool Handles(string toolName) => Definitions.Any(d => d.Name == toolName);

    /// <returns>Підготовлена дія (або null, якщо неможлива) і текст для моделі.</returns>
    public async Task<(AssistantAction? Action, string ForModel)> PrepareAsync(ChatToolCall call, CancellationToken ct)
    {
        JsonElement args;
        try
        {
            args = JsonDocument.Parse(string.IsNullOrWhiteSpace(call.ArgumentsJson) ? "{}" : call.ArgumentsJson).RootElement;
        }
        catch (JsonException)
        {
            return (null, "Помилка: некоректні аргументи");
        }

        return call.Name switch
        {
            "update_product" => await UpdateAsync(args, ct),
            "change_product_status" => await StatusAsync(args, ct),
            "delete_product" => await DeleteAsync(args, ct),
            "order_action" => await OrderAsync(args, ct),
            _ => (null, $"Невідомий інструмент {call.Name}")
        };
    }

    private async Task<(AssistantAction?, string)> UpdateAsync(JsonElement args, CancellationToken ct)
    {
        var product = await FindAsync(args, ct);
        if (product is null)
            return (null, NotFound(args));

        // Модель інколи повторює поточні значення — такі «зміни» відкидаємо, щоб картка показувала лише справжні.
        var price = Number(args, "price") is { } pr && pr != product.Price ? pr : (decimal?)null;
        var oldPrice = Number(args, "old_price") is { } op && op != product.OldPrice && !(op == 0 && product.OldPrice is null) ? op : (decimal?)null;
        var name = Text(args, "name") is { } nm && nm != product.Name ? nm : null;
        var description = Text(args, "description") is { } ds && ds != product.Description ? ds : null;
        var location = Text(args, "storage_location") is { } lc && lc != product.StorageLocation ? lc : null;
        if (price is <= 0)
            return (null, "Помилка: ціна має бути більшою за нуль");

        var newPrice = price ?? product.Price;
        // Ціну можна ставити будь-яку — і вищу, і нижчу. Закреслена ціна має сенс лише вища за нову:
        // інакше її просто прибираємо, а не сваримось.
        if (oldPrice is > 0 && oldPrice <= newPrice)
            oldPrice = null;
        var removeOld = oldPrice == 0
            || (price is not null && oldPrice is null && product.OldPrice is { } current && current <= newPrice);
        if (removeOld && product.OldPrice is null)
            removeOld = false;
        if (price is null && oldPrice is null && !removeOld && name is null && description is null && location is null)
            return (null, "Нічого міняти: усе вже так, як просять");

        var parts = new List<string>();
        if (price is not null)
            parts.Add($"ціна {Money(product.Price)} → {Money(newPrice)}");
        if (removeOld)
            parts.Add(oldPrice == 0 ? "прибрати закреслену ціну" : "закреслену ціну прибрати (вона менша за нову)");
        else if (oldPrice is not null)
            parts.Add($"закреслена ціна {Money(oldPrice.Value)}");
        if (name is not null)
            parts.Add($"назва «{name}»");
        if (description is not null)
            parts.Add("новий опис");
        if (location is not null)
            parts.Add($"де лежить: {location}");

        var action = new AssistantAction(
            AssistantActionKind.UpdateProduct,
            $"Змінити {Label(product)}: {string.Join(", ", parts)}",
            Sku: product.Sku, Price: price, OldPrice: oldPrice is > 0 ? oldPrice : null, RemoveOldPrice: removeOld,
            Name: name, Description: description, StorageLocation: location);
        return (action, Prepared(action));
    }

    private async Task<(AssistantAction?, string)> StatusAsync(JsonElement args, CancellationToken ct)
    {
        var product = await FindAsync(args, ct);
        if (product is null)
            return (null, NotFound(args));

        var (kind, allowed, verb) = Text(args, "action") switch
        {
            "publish" => (AssistantActionKind.PublishProduct, product.Status == ProductStatus.Draft, "Опублікувати на сайті"),
            "hide" => (AssistantActionKind.HideProduct, product.Status == ProductStatus.Available, "Сховати з сайту"),
            "mark_sold" => (AssistantActionKind.MarkProductSold,
                product.Status is ProductStatus.Available or ProductStatus.Reserved, "Позначити проданою"),
            _ => (default(AssistantActionKind), false, "")
        };

        if (string.IsNullOrEmpty(verb))
            return (null, "Помилка: невідома дія");
        if (!allowed)
            return (null, $"Неможливо: річ {product.Sku} зараз має статус «{StatusLabel(product.Status)}»");

        var action = new AssistantAction(kind, $"{verb} {Label(product)}", Sku: product.Sku);
        return (action, Prepared(action));
    }

    private async Task<(AssistantAction?, string)> DeleteAsync(JsonElement args, CancellationToken ct)
    {
        var product = await FindAsync(args, ct);
        if (product is null)
            return (null, NotFound(args));
        if (product.Status == ProductStatus.Reserved)
            return (null, $"Неможливо: {product.Sku} у незакритому замовленні — спершу його треба завершити або скасувати");

        var action = new AssistantAction(AssistantActionKind.DeleteProduct, $"Видалити назавжди {Label(product)} разом з фото", Sku: product.Sku);
        return (action, Prepared(action));
    }

    private async Task<(AssistantAction?, string)> OrderAsync(JsonElement args, CancellationToken ct)
    {
        if (!args.TryGetProperty("number", out var n) || !n.TryGetInt32(out var number))
            return (null, "Помилка: потрібен номер замовлення");
        var order = await orders.GetByNumberAsync(number, ct);
        if (order is null)
            return (null, $"Замовлення №{number} не знайдено");

        var tracking = Text(args, "tracking_number");
        var who = $"№{order.Number} ({order.Customer.FullName}, {order.Delivery.City}, {Money(order.Total)})";
        (AssistantActionKind Kind, OrderStatus[] From, string Text)? plan = Text(args, "action") switch
        {
            "confirm" => (AssistantActionKind.ConfirmOrder, [OrderStatus.New], $"Підтвердити замовлення {who}"),
            "ship" => (AssistantActionKind.ShipOrder, [OrderStatus.Confirmed], $"Позначити відправленим замовлення {who}, ТТН {tracking}"),
            "complete" => (AssistantActionKind.CompleteOrder, [OrderStatus.Shipped], $"Посилку забрали — завершити замовлення {who}"),
            "cancel" => (AssistantActionKind.CancelOrder, [OrderStatus.New, OrderStatus.Confirmed],
                $"Скасувати замовлення {who} — речі повернуться на сайт"),
            _ => null
        };

        if (plan is null)
            return (null, "Помилка: невідома дія");
        if (plan.Value.Kind == AssistantActionKind.ShipOrder && string.IsNullOrWhiteSpace(tracking))
            return (null, "Помилка: для відправки потрібен номер ТТН — спитай його");
        if (!plan.Value.From.Contains(order.Status))
            return (null, $"Неможливо: замовлення №{number} зараз «{OrderStatusLabel(order.Status)}»");

        var action = new AssistantAction(plan.Value.Kind, plan.Value.Text, OrderNumber: order.Number, TrackingNumber: tracking);
        return (action, Prepared(action));
    }

    /// <summary>Артикул як завгодно: «МШ-0412», «мш 412», «0412», «MSH-0412».</summary>
    private async Task<Product?> FindAsync(JsonElement args, CancellationToken ct)
    {
        var raw = Text(args, "sku");
        if (raw is null)
            return null;

        var exact = await products.GetBySkuAsync(raw, ct);
        if (exact is not null)
            return exact;

        var digits = Digits().Match(raw);
        return digits.Success && int.TryParse(digits.Value, out var n)
            ? await products.GetBySkuAsync($"МШ-{n:D4}", ct)
            : null;
    }

    private static string Prepared(AssistantAction a) =>
        $"Підготовлено (ще НЕ виконано): {a.Summary}. Виконається, коли Лариса натисне «Так» на картці.";

    private static string NotFound(JsonElement args) =>
        $"Річ з артикулом «{Text(args, "sku")}» не знайдено — спершу знайди її через find_products";

    private static string Label(Product p) => $"«{p.Name}» ({p.Sku})";

    private static string Money(decimal v) => $"{v.ToString("0.##", CultureInfo.InvariantCulture)} грн";

    private static string? Text(JsonElement args, string name) =>
        args.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(v.GetString())
            ? v.GetString()!.Trim()
            : null;

    private static decimal? Number(JsonElement args, string name) =>
        args.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetDecimal() : null;

    internal static string StatusLabel(ProductStatus s) => s switch
    {
        ProductStatus.Draft => "чернетка",
        ProductStatus.Available => "у продажу",
        ProductStatus.Reserved => "заброньовано",
        ProductStatus.Sold => "продано",
        _ => s.ToString()
    };

    private static string OrderStatusLabel(OrderStatus s) => s switch
    {
        OrderStatus.New => "нове",
        OrderStatus.Confirmed => "підтверджене",
        OrderStatus.Shipped => "відправлене",
        OrderStatus.Completed => "виконане",
        OrderStatus.Cancelled => "скасоване",
        _ => s.ToString()
    };

    [GeneratedRegex(@"\d+")]
    private static partial Regex Digits();
}

/// <summary>Мама натиснула «Так» на картці дії — виконуємо через ті самі use cases, що й кнопки кабінету.</summary>
public sealed record ExecuteAssistantActionCommand(AssistantAction Action) : ICommand<AssistantActionResult>;

internal sealed class ExecuteAssistantActionCommandHandler(
    IProductRepository products,
    IUnitOfWork unitOfWork,
    ICommandHandler<ChangeProductStatusCommand, AdminProductResponse> productStatus,
    ICommandHandler<DeleteProductCommand, bool> deleteProduct,
    ICommandHandler<ChangeOrderStatusCommand, OrderResponse> orderStatus,
    ILogger<ExecuteAssistantActionCommandHandler> logger) : ICommandHandler<ExecuteAssistantActionCommand, AssistantActionResult>
{
    public async Task<Result<AssistantActionResult>> Handle(ExecuteAssistantActionCommand command, CancellationToken ct)
    {
        var a = command.Action;
        Result result = a.Kind switch
        {
            AssistantActionKind.UpdateProduct => await UpdateAsync(a, ct),
            AssistantActionKind.PublishProduct => await StatusAsync(a, ProductAction.Publish, ct),
            AssistantActionKind.HideProduct => await StatusAsync(a, ProductAction.Unpublish, ct),
            AssistantActionKind.MarkProductSold => await StatusAsync(a, ProductAction.MarkSold, ct),
            AssistantActionKind.DeleteProduct => await DeleteAsync(a, ct),
            AssistantActionKind.ConfirmOrder => await OrderAsync(a, OrderAction.Confirm, ct),
            AssistantActionKind.ShipOrder => await OrderAsync(a, OrderAction.Ship, ct),
            AssistantActionKind.CompleteOrder => await OrderAsync(a, OrderAction.Complete, ct),
            AssistantActionKind.CancelOrder => await OrderAsync(a, OrderAction.Cancel, ct),
            _ => Result.Failure(new Error("Assistant.UnknownAction", "Невідома дія"))
        };

        if (result.IsFailure)
            return Result.Failure<AssistantActionResult>(result.Error);

        // Журнал: що саме зробив помічник з дозволу мами.
        logger.LogInformation("Assistant action executed: {Kind} {Sku}{Order} — {Summary}", a.Kind, a.Sku, a.OrderNumber, a.Summary);
        return new AssistantActionResult($"Готово: {a.Summary}");
    }

    private async Task<Result> UpdateAsync(AssistantAction a, CancellationToken ct)
    {
        var p = await products.GetBySkuAsync(a.Sku ?? string.Empty, ct);
        if (p is null)
            return Result.Failure(ProductErrors.NotFound);

        if (a.Name is not null || a.Description is not null)
        {
            // Повна назва була такою ж, як коротка, — міняємо обидві.
            var title = a.Name is not null && p.Title == p.Name ? a.Name : p.Title;
            var info = p.UpdateInfo(a.Name ?? p.Name, title, p.Brand, p.Gender, p.Category, p.Season, p.Condition, p.SizeCm,
                a.Description ?? p.Description);
            if (info.IsFailure)
                return info;
        }

        if (a.Price is not null || a.OldPrice is not null || a.RemoveOldPrice)
        {
            var newPrice = a.Price ?? p.Price;
            var oldPrice = a.RemoveOldPrice ? null : a.OldPrice ?? p.OldPrice;
            // Ціну підняли вище старої закресленої — закреслена вже не має сенсу.
            if (oldPrice <= newPrice)
                oldPrice = null;
            var price = p.ChangePrice(newPrice, oldPrice);
            if (price.IsFailure)
                return price;
        }

        if (a.StorageLocation is not null)
            p.SetStorageLocation(a.StorageLocation);

        return await unitOfWork.SaveOrConflictAsync(p, ct);
    }

    private async Task<Result> StatusAsync(AssistantAction a, ProductAction action, CancellationToken ct)
    {
        var p = await products.GetBySkuAsync(a.Sku ?? string.Empty, ct);
        return p is null ? Result.Failure(ProductErrors.NotFound) : await productStatus.Handle(new ChangeProductStatusCommand(p.Id, action), ct);
    }

    private async Task<Result> DeleteAsync(AssistantAction a, CancellationToken ct)
    {
        var p = await products.GetBySkuAsync(a.Sku ?? string.Empty, ct);
        return p is null ? Result.Failure(ProductErrors.NotFound) : await deleteProduct.Handle(new DeleteProductCommand(p.Id), ct);
    }

    private async Task<Result> OrderAsync(AssistantAction a, OrderAction action, CancellationToken ct) =>
        a.OrderNumber is { } number
            ? await orderStatus.Handle(new ChangeOrderStatusCommand(number, action, a.TrackingNumber), ct)
            : Result.Failure(OrderErrors.NotFound);
}
