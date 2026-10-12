namespace SiteMym.Domain.Products;

/// <summary>Необов'язкові подробиці, які показуються на сторінці товару.</summary>
public sealed record ProductDetails(
    string? SizeNote = null,
    string? SeasonNote = null,
    string? Composition = null,
    string? Insulation = null,
    string? FitNote = null,
    string? DefectNote = null,
    string? LotContents = null)
{
    public static readonly ProductDetails Empty = new();
}
