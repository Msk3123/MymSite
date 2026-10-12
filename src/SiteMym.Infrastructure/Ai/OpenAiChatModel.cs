using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SiteMym.Application.Abstractions.Ai;

namespace SiteMym.Infrastructure.Ai;

/// <summary>Секція «OpenAI». Ключ — лише в user-secrets / змінних оточення, ніколи не в git.</summary>
public sealed class OpenAiOptions
{
    public const string SectionName = "OpenAI";

    public string? ApiKey { get; set; }

    /// <summary>Дешева й достатня для такого помічника модель. Можна замінити без змін у коді.</summary>
    public string Model { get; set; } = "gpt-4o-mini";

    /// <summary>Будь-який OpenAI-сумісний API (наприклад, локальна заглушка для тестів).</summary>
    public string BaseUrl { get; set; } = "https://api.openai.com/v1/";

    /// <summary>Стеля відповіді — щоб одна відповідь не коштувала більше, ніж треба.</summary>
    public int MaxOutputTokens { get; set; } = 600;

    /// <summary>null — не передавати (деякі нові моделі приймають лише значення за замовчуванням).</summary>
    public double? Temperature { get; set; } = 0.3;

    public int TimeoutSeconds { get; set; } = 60;
}

/// <summary>Chat Completions API з function calling. Без SDK — один POST, щоб не залежати від його версій.</summary>
internal sealed class OpenAiChatModel(
    HttpClient http,
    IOptions<OpenAiOptions> options,
    ILogger<OpenAiChatModel> logger) : IChatModel
{
    private readonly OpenAiOptions _options = options.Value;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_options.ApiKey);

    public async Task<ChatCompletion> CompleteAsync(
        IReadOnlyList<ChatMessage> messages,
        IReadOnlyList<ChatTool> tools,
        ChatJsonSchema? jsonSchema,
        CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "chat/completions")
        {
            Content = new StringContent(BuildBody(messages, tools, jsonSchema).ToJsonString(), Encoding.UTF8, "application/json")
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey);

        HttpResponseMessage response;
        try
        {
            response = await http.SendAsync(request, ct);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
        {
            throw new ChatModelException(ChatModelFailure.Unavailable, "OpenAI request failed", ex);
        }

        using (response)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            if (!response.IsSuccessStatusCode)
                throw Failure(response.StatusCode, body);

            return Parse(body);
        }
    }

    private JsonObject BuildBody(IReadOnlyList<ChatMessage> messages, IReadOnlyList<ChatTool> tools, ChatJsonSchema? jsonSchema)
    {
        var body = new JsonObject
        {
            ["model"] = _options.Model,
            ["max_completion_tokens"] = _options.MaxOutputTokens,
            ["messages"] = new JsonArray(messages.Select(ToJson).ToArray<JsonNode?>())
        };

        if (_options.Temperature is { } temperature)
            body["temperature"] = temperature;

        if (jsonSchema is not null)
        {
            body["response_format"] = new JsonObject
            {
                ["type"] = "json_schema",
                ["json_schema"] = new JsonObject
                {
                    ["name"] = jsonSchema.Name,
                    ["strict"] = true,
                    ["schema"] = JsonNode.Parse(jsonSchema.Schema)
                }
            };
        }

        if (tools.Count > 0)
        {
            body["tools"] = new JsonArray(tools.Select(t => (JsonNode)new JsonObject
            {
                ["type"] = "function",
                ["function"] = new JsonObject
                {
                    ["name"] = t.Name,
                    ["description"] = t.Description,
                    ["parameters"] = JsonNode.Parse(t.ParametersJsonSchema)
                }
            }).ToArray<JsonNode?>());
        }

        return body;
    }

    private static JsonObject ToJson(ChatMessage m)
    {
        var json = new JsonObject
        {
            ["role"] = m.Role switch
            {
                ChatRole.System => "system",
                ChatRole.User => "user",
                ChatRole.Assistant => "assistant",
                ChatRole.Tool => "tool",
                _ => throw new ArgumentOutOfRangeException(nameof(m))
            },
            ["content"] = m.Images is { Count: > 0 } images ? WithImages(m.Content, images) : (JsonNode?)m.Content
        };

        if (m.ToolCallId is not null)
            json["tool_call_id"] = m.ToolCallId;

        if (m.ToolCalls is { Count: > 0 } calls)
        {
            json["tool_calls"] = new JsonArray(calls.Select(c => (JsonNode)new JsonObject
            {
                ["id"] = c.Id,
                ["type"] = "function",
                ["function"] = new JsonObject { ["name"] = c.Name, ["arguments"] = c.ArgumentsJson }
            }).ToArray<JsonNode?>());
        }

        return json;
    }

    /// <summary>Текст + фото одним повідомленням. low — дешево (~3 тис. токенів), high — щоб прочитати бірку.</summary>
    private static JsonArray WithImages(string? text, IReadOnlyList<ChatImage> images)
    {
        var parts = new JsonArray();
        if (!string.IsNullOrEmpty(text))
            parts.Add(new JsonObject { ["type"] = "text", ["text"] = text });
        foreach (var image in images)
        {
            parts.Add(new JsonObject
            {
                ["type"] = "image_url",
                ["image_url"] = new JsonObject
                {
                    ["url"] = $"data:{image.MediaType};base64,{Convert.ToBase64String(image.Data)}",
                    ["detail"] = image.HighDetail ? "high" : "low"
                }
            });
        }
        return parts;
    }

    private ChatCompletion Parse(string body)
    {
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;

        if (root.TryGetProperty("usage", out var usage))
        {
            var cached = usage.TryGetProperty("prompt_tokens_details", out var details)
                && details.TryGetProperty("cached_tokens", out var c) ? c.GetInt32() : 0;
            logger.LogInformation("OpenAI usage: prompt {Prompt} (cached {Cached}), completion {Completion} tokens",
                usage.GetProperty("prompt_tokens").GetInt32(), cached, usage.GetProperty("completion_tokens").GetInt32());
        }

        var message = root.GetProperty("choices")[0].GetProperty("message");
        var content = message.TryGetProperty("content", out var text) && text.ValueKind == JsonValueKind.String ? text.GetString() : null;

        var calls = new List<ChatToolCall>();
        if (message.TryGetProperty("tool_calls", out var toolCalls) && toolCalls.ValueKind == JsonValueKind.Array)
        {
            foreach (var call in toolCalls.EnumerateArray())
            {
                var function = call.GetProperty("function");
                calls.Add(new ChatToolCall(
                    call.GetProperty("id").GetString()!,
                    function.GetProperty("name").GetString()!,
                    function.GetProperty("arguments").GetString() ?? "{}"));
            }
        }

        return new ChatCompletion(content, calls);
    }

    private ChatModelException Failure(HttpStatusCode status, string body)
    {
        // Тіло помилки OpenAI не містить ключа, але й цілком його в лог не треба.
        logger.LogWarning("OpenAI returned {Status}: {Body}", (int)status, body.Length > 500 ? body[..500] : body);

        var failure = status switch
        {
            HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden => ChatModelFailure.Unauthorized,
            HttpStatusCode.TooManyRequests when body.Contains("insufficient_quota", StringComparison.Ordinal) => ChatModelFailure.QuotaExceeded,
            _ => ChatModelFailure.Unavailable
        };
        return new ChatModelException(failure, $"OpenAI returned {(int)status}");
    }
}
