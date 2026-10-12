using SiteMym.Domain.Common;

namespace SiteMym.Domain.Assistant;

/// <summary>
/// Те, що помічник пам'ятає про маму між розмовами: «Reima ставлю від 300», «зимове — у синіх коробках».
/// Записує сам помічник або мама вручну; мама бачить і може стерти будь-яку нотатку.
/// </summary>
public sealed class AssistantNote : Entity
{
    public const int MaxLength = 300;
    public const int MaxCount = 60;

    private AssistantNote() { }

    public string Text { get; private set; } = string.Empty;

    public DateTime UpdatedAtUtc { get; private set; }

    public static Result<AssistantNote> Create(string? text)
    {
        var note = new AssistantNote();
        var set = note.Edit(text);
        return set.IsFailure ? Result.Failure<AssistantNote>(set.Error) : note;
    }

    public Result<bool> Edit(string? text)
    {
        var trimmed = text?.Trim() ?? string.Empty;
        if (trimmed.Length == 0)
            return Result.Failure<bool>(AssistantNoteErrors.Empty);
        if (trimmed.Length > MaxLength)
            return Result.Failure<bool>(AssistantNoteErrors.TooLong);

        Text = trimmed;
        UpdatedAtUtc = DateTime.UtcNow;
        return true;
    }
}

public static class AssistantNoteErrors
{
    public static readonly Error NotFound = new("Memory.NotFound", "Такої нотатки вже немає");
    public static readonly Error Empty = new("Memory.Empty", "Напишіть, що запам'ятати");
    public static readonly Error TooLong = new("Memory.TooLong", $"Задовго — до {AssistantNote.MaxLength} символів");
    public static readonly Error Full = new(
        "Memory.Full", $"Пам'ять заповнена ({AssistantNote.MaxCount} нотаток) — видаліть щось непотрібне");
}
