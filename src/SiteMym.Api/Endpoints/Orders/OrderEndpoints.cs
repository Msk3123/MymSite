using SiteMym.Api.Common;
using SiteMym.Application.Abstractions.Messaging;
using SiteMym.Application.Orders.PlaceOrder;
using SiteMym.Domain.Orders;

namespace SiteMym.Api.Endpoints.Orders;

public sealed record PlaceOrderRequest(
    string FullName,
    string Phone,
    string City,
    string Branch,
    PaymentMethod Payment,
    string? Comment,
    Guid[] ProductIds);

public sealed class OrderEndpoints : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var orders = app.MapGroup("/orders").WithTags("Orders");

        orders.MapPost("/", async (
            PlaceOrderRequest request,
            ICommandHandler<PlaceOrderCommand, PlaceOrderResponse> handler,
            CancellationToken ct) =>
        {
            var command = new PlaceOrderCommand(
                request.FullName,
                request.Phone,
                request.City,
                request.Branch,
                request.Payment,
                request.Comment,
                request.ProductIds ?? []);

            var result = await handler.Handle(command, ct);

            // Публічного GET для замовлення немає (там телефон і адреса), тому без Location.
            return result.IsSuccess
                ? Results.Json(result.Value, statusCode: StatusCodes.Status201Created)
                : ApiResults.Problem(result.Error);
        })
        .WithName("PlaceOrder")
        .WithSummary("Оформлення замовлення без реєстрації");
    }
}
