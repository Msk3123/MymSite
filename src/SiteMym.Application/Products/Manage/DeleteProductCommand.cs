using Microsoft.Extensions.Logging;
using SiteMym.Application.Abstractions.Messaging;
using SiteMym.Application.Abstractions.Persistence;
using SiteMym.Application.Abstractions.Storage;
using SiteMym.Domain.Common;
using SiteMym.Domain.Products;

namespace SiteMym.Application.Products.Manage;

public sealed record DeleteProductCommand(Guid Id) : ICommand<bool>;

internal sealed class DeleteProductCommandHandler(
    IProductRepository products,
    ProductRemover remover,
    IUnitOfWork unitOfWork) : ICommandHandler<DeleteProductCommand, bool>
{
    public async Task<Result<bool>> Handle(DeleteProductCommand command, CancellationToken ct)
    {
        var product = await products.GetByIdAsync(command.Id, ct);
        if (product is null)
            return Result.Failure<bool>(ProductErrors.NotFound);

        var removed = await remover.RemoveAsync(product, ct);
        if (removed.IsFailure)
            return Result.Failure<bool>(removed.Error);

        await unitOfWork.SaveChangesAsync(ct);
        await remover.DeleteFilesAsync(removed.Value, ct);
        return true;
    }
}

/// <summary>
/// Видалення речі для мами — одна дія, а під капотом два випадки:
/// річ, яку ніхто не замовляв, стирається повністю; замовлену — ховаємо назавжди (Product.Delete),
/// бо на неї посилаються старі замовлення. Фото стираються з диска в обох випадках — після збереження в базі.
/// </summary>
internal sealed class ProductRemover(
    IProductRepository products,
    IOrderRepository orders,
    IFileStorage storage,
    ILogger<ProductRemover> logger)
{
    /// <returns>Адреси фото, які треба стерти після SaveChanges.</returns>
    public async Task<Result<IReadOnlyList<string>>> RemoveAsync(Product product, CancellationToken ct)
    {
        if (product.Status == ProductStatus.Reserved)
            return Result.Failure<IReadOnlyList<string>>(ProductErrors.ReservedCannotDelete);

        if (!await orders.ExistsWithProductAsync(product.Id, ct))
        {
            var urls = product.Photos.Select(p => p.Url).ToList();
            products.Remove(product);
            return urls;
        }

        var deleted = product.Delete();
        return deleted.IsFailure
            ? Result.Failure<IReadOnlyList<string>>(deleted.Error)
            : deleted.Value.Select(p => p.Url).ToList();
    }

    // Якщо стерти файл не вдалось — лишиться зайвий файл, а не битий запис у базі.
    public async Task DeleteFilesAsync(IEnumerable<string> urls, CancellationToken ct)
    {
        foreach (var url in urls)
        {
            try
            {
                await storage.DeleteAsync(url, ct);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Could not delete photo file {Url}", url);
            }
        }
    }
}
