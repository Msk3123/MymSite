using System.Diagnostics.CodeAnalysis;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SiteMym.Application.Abstractions.Ai;
using SiteMym.Application.Abstractions.Messaging;
using SiteMym.Application.Abstractions.Persistence;
using SiteMym.Application.Common;
using SiteMym.Application.Products;
using SiteMym.Domain.Common;

namespace SiteMym.Application.Assistant;

/// <summary>Повідомлення з чату в адмінці. Історію тримає браузер і щоразу надсилає цілком — сервер нічого не зберігає.</summary>
public sealed record AssistantMessage(string Role, string Text);

/// <param name="Context">Що мама зараз відкрила: «замовлення №1047», «річ МШ-0412 Куртка демісезонна». Короткий текст від фронта.</param>
/// <param name="AllowActions">«Режим дій»: помічник може готувати зміни (виконуються лише після «Так» мами).</param>
public sealed record AskAssistantCommand(IReadOnlyList<AssistantMessage> Messages, string? Context = null, bool AllowActions = false)
    : ICommand<AssistantReply>;

/// <param name="Actions">Підготовлені дії — фронт показує їх картками з кнопкою «Так».</param>
/// <param name="Products">Речі, про які йдеться у відповіді, — фронт показує їх міні-картками з фото.</param>
/// <param name="Remembered">Що помічник щойно записав у пам'ять — фронт покаже «Запам'ятала: …».</param>
public sealed record AssistantReply(
    string Text,
    IReadOnlyList<AssistantAction> Actions,
    IReadOnlyList<AdminProductListItem> Products,
    IReadOnlyList<string> Remembered);

public static class AssistantErrors
{
    public static readonly Error NotConfigured = new(
        "Assistant.NotConfigured", "Помічник ще не підключений: на сервері не задано ключ OpenAI");
    public static readonly Error EmptyQuestion = new("Assistant.EmptyQuestion", "Напишіть питання");
    public static readonly Error QuestionTooLong = new(
        "Assistant.QuestionTooLong", $"Питання задовге — до {AskAssistantCommandHandler.MaxQuestionLength} символів");
    public static readonly Error NoCredit = new(
        "Assistant.NoCredit", "Помічник тимчасово не працює: закінчився баланс OpenAI. Скажіть синові");
    public static readonly Error BadKey = new(
        "Assistant.BadKey", "Помічник не може підключитися: ключ OpenAI не підходить. Скажіть синові");
    public static readonly Error Unavailable = new(
        "Assistant.Unavailable", "Помічник зараз не відповідає. Спробуйте за хвилинку");
}

internal sealed class AskAssistantCommandHandler(
    IChatModel model,
    AssistantTools tools,
    AssistantActionTools actionTools,
    AssistantMemory memory,
    IProductRepository products,
    ShopClock clock,
    IOptions<ShopSettings> shop,
    ILogger<AskAssistantCommandHandler> logger) : ICommandHandler<AskAssistantCommand, AssistantReply>
{
    public const int MaxQuestionLength = 1000;

    // Обмеження, щоб одна розмова не з'їла бюджет: скільки повідомлень історії й кругів «модель → інструмент».
    private const int MaxHistory = 12;
    private const int MaxHistoryMessageLength = 2000;
    private const int MaxToolRounds = 4;
    private const int MaxContextLength = 200;
    private const int MaxActions = 10;
    private const int MaxProductCards = 6;

    public async Task<Result<AssistantReply>> Handle(AskAssistantCommand command, CancellationToken ct)
    {
        if (!model.IsConfigured)
            return Result.Failure<AssistantReply>(AssistantErrors.NotConfigured);

        var question = command.Messages.LastOrDefault();
        if (question is null || question.Role != "user" || string.IsNullOrWhiteSpace(question.Text))
            return Result.Failure<AssistantReply>(AssistantErrors.EmptyQuestion);
        if (question.Text.Length > MaxQuestionLength)
            return Result.Failure<AssistantReply>(AssistantErrors.QuestionTooLong);

        var settings = shop.Value;
        // Незмінна частина — першою (OpenAI кешує однаковий початок), час і «що на екрані» — в кінці.
        var messages = new List<ChatMessage>
        {
            ChatMessage.System(AssistantPrompt.Static(settings.Name, settings.OwnerName, command.AllowActions)),
            // Пам'ять міняється рідко — одразу після незмінної частини, щоб кеш OpenAI захоплював і її.
            ChatMessage.System(AssistantMemory.Format(await memory.LoadAsync(ct)))
        };
        messages.AddRange(command.Messages
            .TakeLast(MaxHistory)
            .Where(m => !string.IsNullOrWhiteSpace(m.Text))
            .Select(m => m.Role == "assistant" ? ChatMessage.Assistant(Truncate(m.Text, MaxHistoryMessageLength)) : ChatMessage.User(Truncate(m.Text, MaxHistoryMessageLength))));
        messages.Add(ChatMessage.System(AssistantPrompt.Now(clock.LocalNow, Truncate(command.Context, MaxContextLength))));

        // Інструменти змін моделі навіть не показуємо, поки «Режим дій» вимкнений.
        // Пам'ять доступна в обох режимах: вона нічого не змінює в магазині.
        IReadOnlyList<ChatTool> toolset = command.AllowActions
            ? [.. AssistantTools.Definitions, .. AssistantMemory.Definitions, .. AssistantActionTools.Definitions]
            : [.. AssistantTools.Definitions, .. AssistantMemory.Definitions];
        var prepared = new List<AssistantAction>();
        var nudged = false;
        var toolCalls = 0;

        try
        {
            for (var round = 0; round < MaxToolRounds; round++)
            {
                // Останній круг — без інструментів, щоб модель точно відповіла текстом.
                var available = round < MaxToolRounds - 1 ? toolset : [];
                var completion = await model.CompleteAsync(messages, available, ct);

                if (completion.ToolCalls.Count == 0)
                {
                    var text = completion.Content?.Trim() ?? string.Empty;

                    // Модель пише «підготувала, натисніть «Так»», а інструмент дії не викликала —
                    // мама натисла б «Так» у нікуди. Один раз змушуємо її таки підготувати дію.
                    // Те саме з уточненнями «який саме?» без жодного пошуку — мамі зручніше обрати зі списку.
                    var nudge = !command.AllowActions || prepared.Count > 0 || nudged ? null
                        : ClaimsPrepared(text)
                            ? "Ти написала, що підготувала дію, але не викликала жодного інструмента дій. Виклич їх зараз " +
                              "(update_product, change_product_status, delete_product, order_action) для кожної речі чи замовлення, " +
                              "або чесно скажи, що не вийшло."
                        : toolCalls == 0 && text.Contains('?')
                            ? "Не перепитуй навмання: спершу виклич find_products за словами з її прохання. Знайшлась одна річ — " +
                              "готуй дію; кілька — покажи їх списком (назва, розмір, ціна, артикул) і спитай, яку саме."
                            : null;
                    if (nudge is not null)
                    {
                        nudged = true;
                        round--;
                        messages.Add(ChatMessage.Assistant(text));
                        messages.Add(ChatMessage.System(nudge));
                        continue;
                    }

                    var reply = text.Length > 0
                        ? text
                        : prepared.Count > 0 ? "Підготувала — перевірте й натисніть «Так»." : "Вибачте, не зрозумів питання. Спробуйте сказати інакше.";
                    return new AssistantReply(reply, prepared, await MentionedProductsAsync(reply, prepared, ct), memory.Remembered);
                }

                messages.Add(ChatMessage.Assistant(completion.Content, completion.ToolCalls));
                toolCalls += completion.ToolCalls.Count;
                foreach (var call in completion.ToolCalls)
                {
                    logger.LogInformation("Assistant tool {Tool}({Args})", call.Name, call.ArgumentsJson);
                    if (command.AllowActions && AssistantActionTools.Handles(call.Name))
                    {
                        var (action, forModel) = await actionTools.PrepareAsync(call, ct);
                        if (action is not null && prepared.Count < MaxActions)
                            prepared.Add(action);
                        messages.Add(ChatMessage.ToolResult(call.Id, forModel));
                    }
                    else if (AssistantMemory.Handles(call.Name))
                    {
                        messages.Add(ChatMessage.ToolResult(call.Id, await memory.ExecuteAsync(call, ct)));
                    }
                    else
                    {
                        messages.Add(ChatMessage.ToolResult(call.Id, await tools.ExecuteAsync(call, ct)));
                    }
                }
            }
        }
        catch (ChatModelException ex)
        {
            logger.LogWarning(ex, "Chat model failed: {Failure}", ex.Failure);
            return Result.Failure<AssistantReply>(ex.Failure switch
            {
                ChatModelFailure.QuotaExceeded => AssistantErrors.NoCredit,
                ChatModelFailure.Unauthorized => AssistantErrors.BadKey,
                _ => AssistantErrors.Unavailable
            });
        }

        return Result.Failure<AssistantReply>(AssistantErrors.Unavailable);
    }

    /// <summary>
    /// Які речі показати картками: ті, що модель знайшла й назвала у відповіді (за назвою чи артикулом),
    /// плюс ті, для яких готує дію. Щоб не засипати чат — не більше шести.
    /// </summary>
    private async Task<IReadOnlyList<AdminProductListItem>> MentionedProductsAsync(
        string text, IReadOnlyList<AssistantAction> prepared, CancellationToken ct)
    {
        var shown = new List<AdminProductListItem>();
        void Add(AdminProductListItem p)
        {
            if (shown.Count < MaxProductCards && shown.All(x => x.Id != p.Id))
                shown.Add(p);
        }

        foreach (var sku in prepared.Select(a => a.Sku).OfType<string>())
        {
            if (tools.Found.FirstOrDefault(p => p.Sku == sku) is { } found)
                Add(found);
            else if (await products.GetBySkuAsync(sku, ct) is { } product)
                Add(product.ToAdminListItem());
        }

        foreach (var p in tools.Found)
        {
            if (text.Contains(p.Sku, StringComparison.OrdinalIgnoreCase) || text.Contains(p.Name, StringComparison.OrdinalIgnoreCase))
                Add(p);
        }

        return shown;
    }

    private static bool ClaimsPrepared(string text) =>
        text.Contains("підготувал", StringComparison.OrdinalIgnoreCase)
        || text.Contains("натисніть «Так»", StringComparison.OrdinalIgnoreCase)
        || text.Contains("натисніть \"Так\"", StringComparison.OrdinalIgnoreCase);

    [return: NotNullIfNotNull(nameof(text))]
    private static string? Truncate(string? text, int max) =>
        text is null || text.Length <= max ? text : text[..max];
}
