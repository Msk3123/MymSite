using System.Globalization;
using System.Text.RegularExpressions;
using SiteMym.Application.Abstractions.Messaging;
using SiteMym.Application.Abstractions.Persistence;
using SiteMym.Domain.Common;
using SiteMym.Domain.Products;

namespace SiteMym.Application.Products.Manage;

/// <summary>Нова річ — одразу чернетка. На сайті з'явиться після «Опублікувати».</summary>
public sealed record CreateProductCommand(ProductInput Input) : ICommand<AdminProductResponse>;

internal sealed partial class CreateProductCommandHandler(IProductRepository products, IUnitOfWork unitOfWork)
    : ICommandHandler<CreateProductCommand, AdminProductResponse>
{
    private const string SkuPrefix = "МШ-";

    public async Task<Result<AdminProductResponse>> Handle(CreateProductCommand command, CancellationToken ct)
    {
        var input = command.Input;
        var sku = await NextSkuAsync(ct);

        var created = Product.Create(
            sku,
            input.Name,
            input.TitleOrName(),
            input.Brand ?? string.Empty,
            input.Gender,
            input.Category,
            input.Season,
            input.Condition,
            input.SizeCm,
            input.Price,
            input.OldPrice,
            input.Description);

        if (created.IsFailure)
            return Result.Failure<AdminProductResponse>(created.Error);

        var product = created.Value;
        product.UpdateDetails(input.ToDetails());
        product.SetMeasurements(input.ToMeasurements());
        product.SetStorageLocation(input.StorageLocation);

        products.Add(product);
        await unitOfWork.SaveChangesAsync(ct);
        return product.ToAdminResponse();
    }

    /// <summary>Мамі не треба вигадувати артикул: беремо найбільший «МШ-NNNN» і додаємо 1.</summary>
    private async Task<string> NextSkuAsync(CancellationToken ct)
    {
        var existing = await products.GetSkusAsync(SkuPrefix, ct);
        var max = existing
            .Select(sku => SkuNumber().Match(sku))
            .Where(m => m.Success)
            .Select(m => int.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture))
            .DefaultIfEmpty(0)
            .Max();

        return $"{SkuPrefix}{max + 1:D4}";
    }

    [GeneratedRegex(@"^МШ-(\d+)$")]
    private static partial Regex SkuNumber();
}
