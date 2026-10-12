namespace SiteMym.Domain.Products;

/// <summary>Замір речі в розкладеному вигляді: «Довжина по спинці» / «Довжина» — 46 см.</summary>
public sealed record Measurement(string Label, string ShortLabel, int ValueCm);
