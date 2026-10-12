using Microsoft.AspNetCore.Mvc;
using SiteMym.Api.Auth;
using SiteMym.Api.Common;
using SiteMym.Application.Abstractions.Messaging;
using SiteMym.Application.Common;
using SiteMym.Application.Products;
using SiteMym.Application.Products.Manage;
using SiteMym.Domain.Products;

namespace SiteMym.Api.Endpoints.Admin;

public sealed record ProductStatusRequest(ProductAction Action);

public sealed record BulkRequest(Guid[] Ids, BulkProductAction Action);

public sealed class AdminProductEndpoints : IEndpoint
{
    // Телефон стискає фото ще в браузері (до ~1–2 МБ), але залишаємо запас для «сирих» файлів.
    private const long MaxUploadBytes = 12 * 1024 * 1024;

    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var products = app.MapGroup("/admin/products")
            .RequireAuthorization(AdminAuth.Policy)
            .WithTags("Admin: products");

        products.MapGet("/", async (
            string? status,
            string? search,
            int? page,
            int? pageSize,
            IQueryHandler<GetAdminProductsQuery, PagedList<AdminProductListItem>> handler,
            CancellationToken ct) =>
        {
            ProductStatus? parsed = null;
            if (!string.IsNullOrWhiteSpace(status))
            {
                if (!KebabEnum.TryParse<ProductStatus>(status, out var s))
                    return Results.ValidationProblem(new Dictionary<string, string[]>
                    {
                        ["status"] = [$"Можливі значення: {KebabEnum.Allowed<ProductStatus>()}"]
                    });
                parsed = s;
            }

            var filter = new ProductFilter
            {
                IncludeDrafts = true,
                Status = parsed,
                Search = string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
                Page = page ?? 1,
                PageSize = pageSize ?? 24
            };
            return (await handler.Handle(new GetAdminProductsQuery(filter), ct)).ToHttp();
        })
        .WithSummary("Усі речі, включно з чернетками, з «Де лежить»");

        products.MapPost("/bulk", async (
            BulkRequest request, ICommandHandler<BulkProductsCommand, BulkResult> handler, CancellationToken ct) =>
            (await handler.Handle(new BulkProductsCommand(request.Ids ?? [], request.Action), ct)).ToHttp())
        .WithSummary("Масова дія над вибраними: hide | discount10");

        products.MapGet("/price-hint", async (
            string category, IQueryHandler<GetPriceHintQuery, PriceHint?> handler, CancellationToken ct) =>
        {
            if (!KebabEnum.TryParse<ProductCategory>(category, out var parsed))
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["category"] = [$"Можливі значення: {KebabEnum.Allowed<ProductCategory>()}"]
                });
            var result = await handler.Handle(new GetPriceHintQuery(parsed), ct);
            return result.IsSuccess ? Results.Ok(new { hint = result.Value }) : ApiResults.Problem(result.Error);
        })
        .WithSummary("Підказка ціни: за скільки такі речі продавались");

        products.MapGet("/{id:guid}", async (
            Guid id, IQueryHandler<GetAdminProductQuery, AdminProductResponse> handler, CancellationToken ct) =>
            (await handler.Handle(new GetAdminProductQuery(id), ct)).ToHttp());

        products.MapPost("/", async (
            ProductInput input, ICommandHandler<CreateProductCommand, AdminProductResponse> handler, CancellationToken ct) =>
        {
            var result = await handler.Handle(new CreateProductCommand(input), ct);
            return result.IsSuccess
                ? Results.Created($"/api/admin/products/{result.Value.Id}", result.Value)
                : ApiResults.Problem(result.Error);
        })
        .WithSummary("Нова річ (чернетка, артикул видається автоматично)");

        products.MapPut("/{id:guid}", async (
            Guid id, ProductInput input, ICommandHandler<UpdateProductCommand, AdminProductResponse> handler, CancellationToken ct) =>
            (await handler.Handle(new UpdateProductCommand(id, input), ct)).ToHttp());

        products.MapPost("/{id:guid}/status", async (
            Guid id, ProductStatusRequest request, ICommandHandler<ChangeProductStatusCommand, AdminProductResponse> handler, CancellationToken ct) =>
            (await handler.Handle(new ChangeProductStatusCommand(id, request.Action), ct)).ToHttp())
        .WithSummary("publish | unpublish | mark-sold");

        products.MapDelete("/{id:guid}", async (
            Guid id, ICommandHandler<DeleteProductCommand, bool> handler, CancellationToken ct) =>
        {
            var result = await handler.Handle(new DeleteProductCommand(id), ct);
            return result.IsSuccess ? Results.NoContent() : ApiResults.Problem(result.Error);
        });

        products.MapPost("/{id:guid}/photos", async (
            Guid id,
            IFormFile file,
            [FromForm] bool? isDefect,
            [FromForm] string? caption,
            ICommandHandler<AddProductPhotoCommand, AdminProductResponse> handler,
            CancellationToken ct) =>
        {
            await using var stream = file.OpenReadStream();
            var command = new AddProductPhotoCommand(id, stream, isDefect ?? false, caption);
            return (await handler.Handle(command, ct)).ToHttp();
        })
        // Antiforgery-токен не потрібен: кука адмінки SameSite=Strict, з чужого сайту запит її не отримає.
        .DisableAntiforgery()
        .WithMetadata(new RequestSizeLimitAttribute(MaxUploadBytes))
        .WithSummary("Завантажити фото (multipart: file, isDefect, caption)");

        products.MapDelete("/{id:guid}/photos/{photoId:guid}", async (
            Guid id, Guid photoId, ICommandHandler<RemoveProductPhotoCommand, AdminProductResponse> handler, CancellationToken ct) =>
            (await handler.Handle(new RemoveProductPhotoCommand(id, photoId), ct)).ToHttp());

        products.MapPost("/{id:guid}/photos/{photoId:guid}/cover", async (
            Guid id, Guid photoId, ICommandHandler<MakePhotoCoverCommand, AdminProductResponse> handler, CancellationToken ct) =>
            (await handler.Handle(new MakePhotoCoverCommand(id, photoId), ct)).ToHttp())
        .WithSummary("Зробити фото головним (обкладинкою в каталозі)");
    }
}
