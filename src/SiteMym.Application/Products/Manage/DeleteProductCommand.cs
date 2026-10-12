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
    IOrderRepository orders,
    IUnitOfWork unitOfWork,
    IFileStorage storage,
    ILogger<DeleteProductCommandHandler> logger) : ICommandHandler<DeleteProductCommand, bool>
{
    public async Task<Result<bool>> Handle(DeleteProductCommand command, CancellationToken ct)
    {
        var product = await products.GetByIdAsync(command.Id, ct);
        if (product is null)
            return Result.Failure<bool>(ProductErrors.NotFound);

        // Замовлення посилаються на річ — історія продажів не повинна ламатися.
        if (await orders.ExistsWithProductAsync(product.Id, ct))
            return Result.Failure<bool>(ProductErrors.UsedInOrders);

        var photoUrls = product.Photos.Select(p => p.Url).ToList();
        products.Remove(product);
        await unitOfWork.SaveChangesAsync(ct);

        // Файли прибираємо після бази: якщо впаде тут, лишиться зайвий файл, а не битий запис.
        foreach (var url in photoUrls)
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

        return true;
    }
}
