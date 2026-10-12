namespace SiteMym.Application.Abstractions.Persistence;

/// <summary>
/// Хтось змінив той самий запис між нашим читанням і збереженням
/// (наприклад, двоє одночасно замовили одну річ). Infrastructure перекладає сюди свою EF-помилку.
/// </summary>
public sealed class ConcurrencyConflictException(Exception inner)
    : Exception("The record was changed by someone else.", inner);
