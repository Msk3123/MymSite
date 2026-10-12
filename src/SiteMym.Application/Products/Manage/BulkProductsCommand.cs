using SiteMym.Application.Abstractions.Messaging;
using SiteMym.Application.Abstractions.Persistence;
using SiteMym.Domain.Common;
using SiteMym.Domain.Products;

namespace SiteMym.Application.Products.Manage;

public enum BulkProductAction
{
    /// <summary>Сховати з сайту все вибране, що зараз у продажу.</summary>
    Hide,

    /// <summary>Знижка 10%: стара ціна закреслюється, нова — на 10% менша (до гривні).</summary>
    Discount10
}

public sealed record BulkProductsCommand(IReadOnlyCollection<Guid> Ids, BulkProductAction Action) : ICommand<BulkResult>;

/// <param name="Changed">Скільки речей змінено.</param>
/// <param name="Skipped">Скільки пропущено (наприклад, заброньовані не ховаємо).</param>
public sealed record BulkResult(int Changed, int Skipped);

internal sealed class BulkProductsCommandHandler(IProductRepository products, IUnitOfWork unitOfWork)
    : ICommandHandler<BulkProductsCommand, BulkResult>
{
    private const int MaxItems = 100;
    private const decimal DiscountFactor = 0.9m;

    public static readonly Error TooMany = new("Product.BulkTooMany", $"За раз можна змінити до {MaxItems} речей");

    public async Task<Result<BulkResult>> Handle(BulkProductsCommand command, CancellationToken ct)
    {
        var ids = command.Ids.Distinct().ToList();
        if (ids.Count > MaxItems)
            return Result.Failure<BulkResult>(TooMany);

        var items = await products.GetByIdsAsync(ids, ct);
        var changed = 0;
        foreach (var product in items)
        {
            var result = command.Action switch
            {
                BulkProductAction.Hide => product.Unpublish(),
                BulkProductAction.Discount10 => Discount(product),
                _ => throw new ArgumentOutOfRangeException(nameof(command), command.Action, null)
            };
            if (result.IsSuccess)
                changed++;
        }

        try
        {
            await unitOfWork.SaveChangesAsync(ct);
        }
        catch (ConcurrencyConflictException)
        {
            return Result.Failure<BulkResult>(ProductSaving.Conflict);
        }

        return new BulkResult(changed, ids.Count - changed);
    }

    // Продане й заброньоване не чіпаємо: ціна в замовленні вже зафіксована.
    private static Result Discount(Product product)
    {
        if (product.Status is ProductStatus.Sold or ProductStatus.Reserved)
            return Result.Failure(ProductErrors.NotAvailable(product.Sku));

        var newPrice = Math.Max(1, Math.Round(product.Price * DiscountFactor, MidpointRounding.AwayFromZero));
        return product.ChangePrice(newPrice, product.OldPrice ?? product.Price);
    }
}
