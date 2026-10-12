using SiteMym.Application.Abstractions.Messaging;
using SiteMym.Application.Abstractions.Persistence;
using SiteMym.Domain.Common;
using SiteMym.Domain.Products;

namespace SiteMym.Application.Products.Manage;

public enum ProductAction
{
    /// <summary>Чернетка → на сайт.</summary>
    Publish,

    /// <summary>Сховати з сайту.</summary>
    Unpublish,

    /// <summary>Продала сама — у Viber, на ринку, знайомим.</summary>
    MarkSold
}

public sealed record ChangeProductStatusCommand(Guid Id, ProductAction Action) : ICommand<AdminProductResponse>;

internal sealed class ChangeProductStatusCommandHandler(IProductRepository products, IUnitOfWork unitOfWork)
    : ICommandHandler<ChangeProductStatusCommand, AdminProductResponse>
{
    public async Task<Result<AdminProductResponse>> Handle(ChangeProductStatusCommand command, CancellationToken ct)
    {
        var product = await products.GetByIdAsync(command.Id, ct);
        if (product is null)
            return Result.Failure<AdminProductResponse>(ProductErrors.NotFound);

        var result = command.Action switch
        {
            ProductAction.Publish => product.Publish(),
            ProductAction.Unpublish => product.Unpublish(),
            ProductAction.MarkSold => product.MarkSold(),
            _ => throw new ArgumentOutOfRangeException(nameof(command), command.Action, null)
        };

        return result.IsFailure
            ? Result.Failure<AdminProductResponse>(result.Error)
            : await unitOfWork.SaveOrConflictAsync(product, ct);
    }
}
