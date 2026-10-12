using SiteMym.Api.Common;
using SiteMym.Application.Abstractions.Messaging;
using SiteMym.Application.Common;
using SiteMym.Application.Products;
using SiteMym.Application.Products.CountProducts;
using SiteMym.Application.Products.GetProduct;
using SiteMym.Application.Products.GetProducts;
using SiteMym.Application.Products.LookupProducts;

namespace SiteMym.Api.Endpoints.Products;

public sealed class ProductEndpoints : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var products = app.MapGroup("/products").WithTags("Products");

        products.MapGet("/", async (
            [AsParameters] CatalogQuery query,
            IQueryHandler<GetProductsQuery, PagedList<ProductListItem>> handler,
            CancellationToken ct) =>
        {
            if (!query.TryToFilter(out var filter, out var errors))
                return Results.ValidationProblem(errors);

            var result = await handler.Handle(new GetProductsQuery(filter), ct);
            return result.IsSuccess ? Results.Ok(result.Value) : ApiResults.Problem(result.Error);
        })
        .WithName("GetProducts")
        .WithSummary("Каталог: фільтри, сортування, сторінки");

        products.MapGet("/count", async (
            [AsParameters] CatalogQuery query,
            IQueryHandler<CountProductsQuery, int> handler,
            CancellationToken ct) =>
        {
            if (!query.TryToFilter(out var filter, out var errors))
                return Results.ValidationProblem(errors);

            var result = await handler.Handle(new CountProductsQuery(filter), ct);
            return result.IsSuccess ? Results.Ok(new { count = result.Value }) : ApiResults.Problem(result.Error);
        })
        .WithName("CountProducts")
        .WithSummary("Скільки речей під фільтри — для лічильників у фільтрах");

        products.MapGet("/lookup", async (
            string? slugs,
            IQueryHandler<LookupProductsQuery, IReadOnlyList<ProductListItem>> handler,
            CancellationToken ct) =>
        {
            var list = (slugs ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries);
            var result = await handler.Handle(new LookupProductsQuery(list), ct);
            return result.IsSuccess ? Results.Ok(result.Value) : ApiResults.Problem(result.Error);
        })
        .WithName("LookupProducts")
        .WithSummary("Кошик: свіжі дані речей за списком slug-ів (?slugs=msh-0412,msh-0388)");

        products.MapGet("/{slug}", async (
            string slug,
            IQueryHandler<GetProductQuery, ProductResponse> handler,
            CancellationToken ct) =>
        {
            var result = await handler.Handle(new GetProductQuery(slug), ct);
            return result.IsSuccess ? Results.Ok(result.Value) : ApiResults.Problem(result.Error);
        })
        .WithName("GetProduct")
        .WithSummary("Сторінка товару");
    }
}
