using SiteMym.Domain.Products;

namespace SiteMym.Application.Products.Manage;

/// <summary>Форма речі в адмінці — однакова для «Додати» і «Редагувати».</summary>
public sealed record ProductInput(
    string Name,
    string? Title,
    string? Brand,
    Gender Gender,
    ProductCategory Category,
    Season Season,
    ItemCondition Condition,
    int SizeCm,
    decimal Price,
    decimal? OldPrice,
    string? Description,
    string? SizeNote,
    string? SeasonNote,
    string? Composition,
    string? Insulation,
    string? FitNote,
    string? DefectNote,
    string? LotContents,
    IReadOnlyList<MeasurementInput>? Measurements,
    string? StorageLocation = null);

public sealed record MeasurementInput(string Label, string? ShortLabel, int ValueCm);

internal static class ProductInputExtensions
{
    /// <summary>Повна назва необов'язкова — якщо мама її не вписала, беремо коротку.</summary>
    public static string TitleOrName(this ProductInput input) =>
        string.IsNullOrWhiteSpace(input.Title) ? input.Name : input.Title;

    public static ProductDetails ToDetails(this ProductInput input) => new(
        SizeNote: Clean(input.SizeNote),
        SeasonNote: Clean(input.SeasonNote),
        Composition: Clean(input.Composition),
        Insulation: Clean(input.Insulation),
        FitNote: Clean(input.FitNote),
        DefectNote: Clean(input.DefectNote),
        LotContents: Clean(input.LotContents));

    public static IEnumerable<Measurement> ToMeasurements(this ProductInput input) =>
        (input.Measurements ?? [])
            .Where(m => !string.IsNullOrWhiteSpace(m.Label) && m.ValueCm > 0)
            .Select(m => new Measurement(
                m.Label.Trim(),
                string.IsNullOrWhiteSpace(m.ShortLabel) ? m.Label.Trim() : m.ShortLabel.Trim(),
                m.ValueCm));

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
