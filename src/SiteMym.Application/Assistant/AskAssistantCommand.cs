using System.Diagnostics.CodeAnalysis;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SiteMym.Application.Abstractions.Ai;
using SiteMym.Application.Abstractions.Messaging;
using SiteMym.Application.Common;
using SiteMym.Domain.Common;

namespace SiteMym.Application.Assistant;

/// <summary>Повідомлення з чату в адмінці. Історію тримає браузер і щоразу надсилає цілком — сервер нічого не зберігає.</summary>
public sealed record AssistantMessage(string Role, string Text);

/// <param name="Context">Що мама зараз відкрила: «замовлення №1047», «річ МШ-0412 Куртка демісезонна». Короткий текст від фронта.</param>
public sealed record AskAssistantCommand(IReadOnlyList<AssistantMessage> Messages, string? Context = null) : ICommand<AssistantReply>;

public sealed record AssistantReply(string Text);

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
        var messages = new List<ChatMessage> { ChatMessage.System(AssistantPrompt.Static(settings.Name, settings.OwnerName)) };
        messages.AddRange(command.Messages
            .TakeLast(MaxHistory)
            .Where(m => !string.IsNullOrWhiteSpace(m.Text))
            .Select(m => m.Role == "assistant" ? ChatMessage.Assistant(Truncate(m.Text, MaxHistoryMessageLength)) : ChatMessage.User(Truncate(m.Text, MaxHistoryMessageLength))));
        messages.Add(ChatMessage.System(AssistantPrompt.Now(clock.LocalNow, Truncate(command.Context, MaxContextLength))));

        try
        {
            for (var round = 0; round < MaxToolRounds; round++)
            {
                // Останній круг — без інструментів, щоб модель точно відповіла текстом.
                var available = round < MaxToolRounds - 1 ? AssistantTools.Definitions : [];
                var completion = await model.CompleteAsync(messages, available, ct);

                if (completion.ToolCalls.Count == 0)
                    return new AssistantReply(completion.Content?.Trim() is { Length: > 0 } text
                        ? text
                        : "Вибачте, не зрозумів питання. Спробуйте сказати інакше.");

                messages.Add(ChatMessage.Assistant(completion.Content, completion.ToolCalls));
                foreach (var call in completion.ToolCalls)
                {
                    logger.LogInformation("Assistant tool {Tool}({Args})", call.Name, call.ArgumentsJson);
                    messages.Add(ChatMessage.ToolResult(call.Id, await tools.ExecuteAsync(call, ct)));
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

    [return: NotNullIfNotNull(nameof(text))]
    private static string? Truncate(string? text, int max) =>
        text is null || text.Length <= max ? text : text[..max];
}
