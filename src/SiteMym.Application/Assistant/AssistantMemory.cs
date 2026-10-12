using System.Text;
using System.Text.Json;
using SiteMym.Application.Abstractions.Ai;
using SiteMym.Application.Abstractions.Messaging;
using SiteMym.Application.Abstractions.Persistence;
using SiteMym.Domain.Assistant;
using SiteMym.Domain.Common;

namespace SiteMym.Application.Assistant;

public sealed record AssistantNoteResponse(Guid Id, string Text, DateTime UpdatedAtUtc);

/// <summary>
/// Пам'ять помічника між розмовами. Модель бачить нотатки під номерами 1, 2, 3… (а не id — менше токенів)
/// і може записати нову (remember) чи стерти стару (forget). Записує одразу, без «Так»: нотатки нічого
/// не змінюють у магазині, а мама бачить їх усі на сторінці помічника й може виправити.
/// </summary>
internal sealed class AssistantMemory(IAssistantNoteRepository notes, IUnitOfWork unitOfWork)
{
    private List<AssistantNote> _loaded = [];

    /// <summary>Що помічник записав за цю відповідь — фронт покаже «Запам'ятала: …».</summary>
    public List<string> Remembered { get; } = [];

    public static IReadOnlyList<ChatTool> Definitions { get; } =
    [
        new("remember",
            "Запам'ятати надовго факт про неї чи її магазин. text — від її імені, як записала б сама: «Reima ставлю від 300 грн». replaces — № нотатки, яку ця замінює (якщо щось змінилось).",
            """{"type":"object","properties":{"text":{"type":"string"},"replaces":{"type":"integer"}},"required":["text"],"additionalProperties":false}"""),
        new("forget",
            "Стерти нотатку з пам'яті за №.",
            """{"type":"object","properties":{"number":{"type":"integer"}},"required":["number"],"additionalProperties":false}""")
    ];

    public static bool Handles(string toolName) => toolName is "remember" or "forget";

    public async Task<IReadOnlyList<AssistantNote>> LoadAsync(CancellationToken ct)
    {
        _loaded = [.. await notes.ListAsync(ct)];
        return _loaded;
    }

    /// <summary>Блок для системного повідомлення: нотатки під номерами.</summary>
    public static string Format(IReadOnlyList<AssistantNote> list)
    {
        if (list.Count == 0)
            return "Твоя пам'ять про неї поки порожня.";

        var text = new StringBuilder("Що ти пам'ятаєш про неї з минулих розмов (№. нотатка):");
        for (var i = 0; i < list.Count; i++)
            text.Append('\n').Append(i + 1).Append(". ").Append(list[i].Text);
        return text.ToString();
    }

    public async Task<string> ExecuteAsync(ChatToolCall call, CancellationToken ct)
    {
        JsonElement args;
        try
        {
            args = JsonDocument.Parse(string.IsNullOrWhiteSpace(call.ArgumentsJson) ? "{}" : call.ArgumentsJson).RootElement;
        }
        catch (JsonException)
        {
            return Reply("error", "Некоректні аргументи");
        }

        return call.Name == "forget" ? await ForgetAsync(args, ct) : await RememberAsync(args, ct);
    }

    private async Task<string> RememberAsync(JsonElement args, CancellationToken ct)
    {
        var text = args.TryGetProperty("text", out var t) && t.ValueKind == JsonValueKind.String ? t.GetString() : null;
        var replaced = ByNumber(args, "replaces");

        if (replaced is not null)
        {
            var tracked = await notes.GetByIdAsync(replaced.Id, ct);
            if (tracked is null)
                return Reply("error", AssistantNoteErrors.NotFound.Message);
            var edited = tracked.Edit(text);
            if (edited.IsFailure)
                return Reply("error", edited.Error.Message);
        }
        else
        {
            if (_loaded.Count + Remembered.Count >= AssistantNote.MaxCount)
                return Reply("error", AssistantNoteErrors.Full.Message);
            var created = AssistantNote.Create(text);
            if (created.IsFailure)
                return Reply("error", created.Error.Message);
            notes.Add(created.Value);
        }

        await unitOfWork.SaveChangesAsync(ct);
        Remembered.Add(text!.Trim());
        return Reply("ok", "Записано");
    }

    private async Task<string> ForgetAsync(JsonElement args, CancellationToken ct)
    {
        var note = ByNumber(args, "number");
        var tracked = note is null ? null : await notes.GetByIdAsync(note.Id, ct);
        if (tracked is null)
            return Reply("error", AssistantNoteErrors.NotFound.Message);

        notes.Remove(tracked);
        await unitOfWork.SaveChangesAsync(ct);
        return Reply("ok", "Стерто");
    }

    private AssistantNote? ByNumber(JsonElement args, string name) =>
        args.TryGetProperty(name, out var n) && n.TryGetInt32(out var number) && number >= 1 && number <= _loaded.Count
            ? _loaded[number - 1]
            : null;

    private static string Reply(string key, string message) =>
        JsonSerializer.Serialize(new Dictionary<string, string> { [key] = message });
}

public sealed record GetAssistantNotesQuery : IQuery<IReadOnlyList<AssistantNoteResponse>>;

public sealed record AddAssistantNoteCommand(string? Text) : ICommand<AssistantNoteResponse>;

public sealed record UpdateAssistantNoteCommand(Guid Id, string? Text) : ICommand<AssistantNoteResponse>;

public sealed record DeleteAssistantNoteCommand(Guid Id) : ICommand<bool>;

internal sealed class GetAssistantNotesQueryHandler(IAssistantNoteRepository notes)
    : IQueryHandler<GetAssistantNotesQuery, IReadOnlyList<AssistantNoteResponse>>
{
    public async Task<Result<IReadOnlyList<AssistantNoteResponse>>> Handle(GetAssistantNotesQuery query, CancellationToken ct) =>
        Result.Success<IReadOnlyList<AssistantNoteResponse>>((await notes.ListAsync(ct)).Select(n => n.ToResponse()).ToList());
}

internal sealed class AddAssistantNoteCommandHandler(IAssistantNoteRepository notes, IUnitOfWork unitOfWork)
    : ICommandHandler<AddAssistantNoteCommand, AssistantNoteResponse>
{
    public async Task<Result<AssistantNoteResponse>> Handle(AddAssistantNoteCommand command, CancellationToken ct)
    {
        if (await notes.CountAsync(ct) >= AssistantNote.MaxCount)
            return Result.Failure<AssistantNoteResponse>(AssistantNoteErrors.Full);

        var created = AssistantNote.Create(command.Text);
        if (created.IsFailure)
            return Result.Failure<AssistantNoteResponse>(created.Error);

        notes.Add(created.Value);
        await unitOfWork.SaveChangesAsync(ct);
        return created.Value.ToResponse();
    }
}

internal sealed class UpdateAssistantNoteCommandHandler(IAssistantNoteRepository notes, IUnitOfWork unitOfWork)
    : ICommandHandler<UpdateAssistantNoteCommand, AssistantNoteResponse>
{
    public async Task<Result<AssistantNoteResponse>> Handle(UpdateAssistantNoteCommand command, CancellationToken ct)
    {
        var note = await notes.GetByIdAsync(command.Id, ct);
        if (note is null)
            return Result.Failure<AssistantNoteResponse>(AssistantNoteErrors.NotFound);

        var edited = note.Edit(command.Text);
        if (edited.IsFailure)
            return Result.Failure<AssistantNoteResponse>(edited.Error);

        await unitOfWork.SaveChangesAsync(ct);
        return note.ToResponse();
    }
}

internal sealed class DeleteAssistantNoteCommandHandler(IAssistantNoteRepository notes, IUnitOfWork unitOfWork)
    : ICommandHandler<DeleteAssistantNoteCommand, bool>
{
    public async Task<Result<bool>> Handle(DeleteAssistantNoteCommand command, CancellationToken ct)
    {
        var note = await notes.GetByIdAsync(command.Id, ct);
        if (note is null)
            return Result.Failure<bool>(AssistantNoteErrors.NotFound);

        notes.Remove(note);
        await unitOfWork.SaveChangesAsync(ct);
        return true;
    }
}

internal static class AssistantNoteMapping
{
    public static AssistantNoteResponse ToResponse(this AssistantNote note) => new(note.Id, note.Text, note.UpdatedAtUtc);
}
