using SiteMym.Application.Abstractions.Persistence;
using SiteMym.Domain.Common;
using SiteMym.Domain.Products;

namespace SiteMym.Application.Products.Manage;

internal static class ProductSaving
{
    public static readonly Error Conflict = new(
        "Product.Conflict",
        "Поки ви редагували, річ змінилася (наприклад, її замовили). Оновіть сторінку й спробуйте ще раз");

    /// <summary>Зберегти й віддати свіжий стан речі; паралельну зміну перетворити на зрозумілу помилку.</summary>
    public static async Task<Result<AdminProductResponse>> SaveOrConflictAsync(
        this IUnitOfWork unitOfWork, Product product, CancellationToken ct)
    {
        try
        {
            await unitOfWork.SaveChangesAsync(ct);
            return product.ToAdminResponse();
        }
        catch (ConcurrencyConflictException)
        {
            return Result.Failure<AdminProductResponse>(Conflict);
        }
    }
}
