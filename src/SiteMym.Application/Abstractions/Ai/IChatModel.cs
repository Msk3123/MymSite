namespace SiteMym.Application.Abstractions.Ai;

/// <summary>
/// Мовна модель з підтримкою «інструментів» (function calling).
/// Реалізація — в Infrastructure (зараз OpenAI), Application про HTTP і ключі нічого не знає.
/// </summary>
public interface IChatModel
{
    /// <summary>false — ключ API не задано, помічник вимкнений.</summary>
    bool IsConfigured { get; }

    /// <exception cref="ChatModelException">Модель недоступна, закінчився баланс тощо.</exception>
    Task<ChatCompletion> CompleteAsync(
        IReadOnlyList<ChatMessage> messages,
        IReadOnlyList<ChatTool> tools,
        CancellationToken ct = default) => CompleteAsync(messages, tools, null, ct);

    /// <param name="jsonSchema">Якщо задано — модель зобов'язана відповісти JSON саме такої форми (structured outputs).</param>
    Task<ChatCompletion> CompleteAsync(
        IReadOnlyList<ChatMessage> messages,
        IReadOnlyList<ChatTool> tools,
        ChatJsonSchema? jsonSchema,
        CancellationToken ct = default);
}

public enum ChatRole
{
    System,
    User,
    Assistant,
    Tool
}

public sealed record ChatMessage(
    ChatRole Role,
    string? Content,
    IReadOnlyList<ChatToolCall>? ToolCalls = null,
    string? ToolCallId = null,
    IReadOnlyList<ChatImage>? Images = null)
{
    public static ChatMessage System(string content) => new(ChatRole.System, content);
    public static ChatMessage User(string content, IReadOnlyList<ChatImage>? images = null) =>
        new(ChatRole.User, content, Images: images);
    public static ChatMessage Assistant(string? content, IReadOnlyList<ChatToolCall>? toolCalls = null) =>
        new(ChatRole.Assistant, content, toolCalls);
    public static ChatMessage ToolResult(string toolCallId, string content) =>
        new(ChatRole.Tool, content, ToolCallId: toolCallId);
}

/// <summary>Фото для моделі, що «бачить» (gpt-4o-mini вміє).</summary>
/// <param name="HighDetail">true — модель розглядає фото крупно (бірка з дрібним текстом), але це в ~10 разів дорожче.</param>
public sealed record ChatImage(string MediaType, byte[] Data, bool HighDetail = false);

/// <summary>Опис очікуваного JSON: назва і JSON Schema (strict).</summary>
public sealed record ChatJsonSchema(string Name, string Schema);

/// <summary>Модель просить викликати функцію: get_shop_summary, list_orders…</summary>
public sealed record ChatToolCall(string Id, string Name, string ArgumentsJson);

/// <summary>Опис функції для моделі: назва, що робить, JSON Schema аргументів.</summary>
public sealed record ChatTool(string Name, string Description, string ParametersJsonSchema);

public sealed record ChatCompletion(string? Content, IReadOnlyList<ChatToolCall> ToolCalls);

public enum ChatModelFailure
{
    /// <summary>Невірний ключ API.</summary>
    Unauthorized,

    /// <summary>Закінчились гроші на рахунку або ліміт запитів.</summary>
    QuotaExceeded,

    /// <summary>Мережа, таймаут, 5xx.</summary>
    Unavailable
}

public sealed class ChatModelException(ChatModelFailure failure, string message, Exception? inner = null)
    : Exception(message, inner)
{
    public ChatModelFailure Failure { get; } = failure;
}
