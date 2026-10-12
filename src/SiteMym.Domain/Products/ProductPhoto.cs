using SiteMym.Domain.Common;

namespace SiteMym.Domain.Products;

public sealed class ProductPhoto : Entity
{
    private ProductPhoto() { }

    internal ProductPhoto(Guid productId, string url, string? caption, bool isDefect, int sortOrder)
    {
        ProductId = productId;
        Url = url;
        Caption = caption;
        IsDefect = isDefect;
        SortOrder = sortOrder;
    }

    public Guid ProductId { get; private set; }
    public string Url { get; private set; } = null!;

    /// <summary>Підпис на фото: «Потертість ~1 см на лівому манжеті».</summary>
    public string? Caption { get; private set; }

    /// <summary>Фото дефекту — на сайті показується з плашкою.</summary>
    public bool IsDefect { get; private set; }

    public int SortOrder { get; internal set; }
}
