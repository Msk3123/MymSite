using SiteMym.Application.Abstractions.Messaging;
using SiteMym.Application.Abstractions.Persistence;
using SiteMym.Domain.Common;
using SiteMym.Domain.Products;

namespace SiteMym.Application.Products.Manage;

public sealed record UpdateProductCommand(Guid Id, ProductInput Input) : ICommand<AdminProductResponse>;

internal sealed class UpdateProductCommandHandler(IProductRepository products, IUnitOfWork unitOfWork)
    : ICommandHandler<UpdateProductCommand, AdminProductResponse>
{
    public async Task<Result<AdminProductResponse>> Handle(UpdateProductCommand command, CancellationToken ct)
    {
        var product = await products.GetByIdAsync(command.Id, ct);
        if (product is null)
            return Result.Failure<AdminProductResponse>(ProductErrors.NotFound);

        var input = command.Input;
        var info = product.UpdateInfo(
            input.Name,
            input.TitleOrName(),
            input.Brand ?? string.Empty,
            input.Gender,
            input.Category,
            input.Season,
            input.Condition,
            input.SizeCm,
            input.Description);
        if (info.IsFailure)
            return Result.Failure<AdminProductResponse>(info.Error);

        var price = product.ChangePrice(input.Price, input.OldPrice);
        if (price.IsFailure)
            return Result.Failure<AdminProductResponse>(price.Error);

        product.UpdateDetails(input.ToDetails());
        product.SetMeasurements(input.ToMeasurements());
        product.SetStorageLocation(input.StorageLocation);

        return await unitOfWork.SaveOrConflictAsync(product, ct);
    }
}
