using Microsoft.Extensions.Logging;
using SiteMym.Application.Abstractions.Messaging;
using SiteMym.Application.Abstractions.Persistence;
using SiteMym.Application.Abstractions.Storage;
using SiteMym.Domain.Common;
using SiteMym.Domain.Products;

namespace SiteMym.Application.Products.Manage;

public sealed record AddProductPhotoCommand(Guid ProductId, Stream Content, bool IsDefect, string? Caption)
    : ICommand<AdminProductResponse>;

public sealed record RemoveProductPhotoCommand(Guid ProductId, Guid PhotoId) : ICommand<AdminProductResponse>;

public sealed record MakePhotoCoverCommand(Guid ProductId, Guid PhotoId) : ICommand<AdminProductResponse>;

internal sealed class AddProductPhotoCommandHandler(
    IProductRepository products,
    IUnitOfWork unitOfWork,
    IFileStorage storage) : ICommandHandler<AddProductPhotoCommand, AdminProductResponse>
{
    public const long MaxBytes = 10 * 1024 * 1024;

    public async Task<Result<AdminProductResponse>> Handle(AddProductPhotoCommand command, CancellationToken ct)
    {
        var product = await products.GetByIdAsync(command.ProductId, ct);
        if (product is null)
            return Result.Failure<AdminProductResponse>(ProductErrors.NotFound);
        if (product.Photos.Count >= Product.MaxPhotos)
            return Result.Failure<AdminProductResponse>(ProductErrors.TooManyPhotos);

        // Не віримо ні розширенню, ні Content-Type з браузера — дивимось на перші байти файлу.
        await using var buffer = new MemoryStream();
        await command.Content.CopyToAsync(buffer, ct);
        if (buffer.Length is 0 or > MaxBytes)
            return Result.Failure<AdminProductResponse>(ProductErrors.PhotoInvalid);

        var extension = ImageFormat.Detect(buffer.GetBuffer().AsSpan(0, (int)Math.Min(buffer.Length, 16)));
        if (extension is null)
            return Result.Failure<AdminProductResponse>(ProductErrors.PhotoInvalid);

        buffer.Position = 0;
        var url = await storage.SaveAsync(buffer, $"products/{product.Id:N}", extension, ct);

        var added = product.AddPhoto(url, command.Caption, command.IsDefect);
        if (added.IsFailure)
        {
            await storage.DeleteAsync(url, ct);
            return Result.Failure<AdminProductResponse>(added.Error);
        }

        return await unitOfWork.SaveOrConflictAsync(product, ct);
    }
}

internal sealed class RemoveProductPhotoCommandHandler(
    IProductRepository products,
    IUnitOfWork unitOfWork,
    IFileStorage storage,
    ILogger<RemoveProductPhotoCommandHandler> logger) : ICommandHandler<RemoveProductPhotoCommand, AdminProductResponse>
{
    public async Task<Result<AdminProductResponse>> Handle(RemoveProductPhotoCommand command, CancellationToken ct)
    {
        var product = await products.GetByIdAsync(command.ProductId, ct);
        if (product is null)
            return Result.Failure<AdminProductResponse>(ProductErrors.NotFound);

        var removed = product.RemovePhoto(command.PhotoId);
        if (removed.IsFailure)
            return Result.Failure<AdminProductResponse>(removed.Error);

        var saved = await unitOfWork.SaveOrConflictAsync(product, ct);
        if (saved.IsSuccess)
        {
            try
            {
                await storage.DeleteAsync(removed.Value.Url, ct);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Could not delete photo file {Url}", removed.Value.Url);
            }
        }

        return saved;
    }
}

internal sealed class MakePhotoCoverCommandHandler(IProductRepository products, IUnitOfWork unitOfWork)
    : ICommandHandler<MakePhotoCoverCommand, AdminProductResponse>
{
    public async Task<Result<AdminProductResponse>> Handle(MakePhotoCoverCommand command, CancellationToken ct)
    {
        var product = await products.GetByIdAsync(command.ProductId, ct);
        if (product is null)
            return Result.Failure<AdminProductResponse>(ProductErrors.NotFound);

        var result = product.MakePhotoCover(command.PhotoId);
        return result.IsFailure
            ? Result.Failure<AdminProductResponse>(result.Error)
            : await unitOfWork.SaveOrConflictAsync(product, ct);
    }
}

/// <summary>Визначає формат за «магічними» байтами на початку файлу.</summary>
internal static class ImageFormat
{
    public static string? Detect(ReadOnlySpan<byte> header) => header switch
    {
        [0xFF, 0xD8, 0xFF, ..] => ".jpg",
        [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, ..] => ".png",
        [(byte)'R', (byte)'I', (byte)'F', (byte)'F', _, _, _, _, (byte)'W', (byte)'E', (byte)'B', (byte)'P', ..] => ".webp",
        _ => null
    };
}
