using SiteMym.Api.Auth;
using SiteMym.Api.Common;
using SiteMym.Application.Abstractions.Messaging;
using SiteMym.Application.Common;
using SiteMym.Application.Dashboard;
using SiteMym.Application.Orders.Manage;
using SiteMym.Domain.Orders;

namespace SiteMym.Api.Endpoints.Admin;

public sealed record OrderStatusRequest(OrderAction Action, string? TrackingNumber);

public sealed record OrderNoteRequest(string? Note);

public sealed class AdminOrderEndpoints : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var admin = app.MapGroup("/admin").RequireAuthorization(AdminAuth.Policy);

        admin.MapGet("/summary", async (IQueryHandler<GetShopSummaryQuery, ShopSummary> handler, CancellationToken ct) =>
            (await handler.Handle(new GetShopSummaryQuery(), ct)).ToHttp())
        .WithTags("Admin: dashboard")
        .WithSummary("Зведення для головної сторінки адмінки");

        var orders = admin.MapGroup("/orders").WithTags("Admin: orders");

        orders.MapGet("/", async (
            string? status,
            string? search,
            int? page,
            int? pageSize,
            IQueryHandler<GetOrdersQuery, PagedList<OrderResponse>> handler,
            CancellationToken ct) =>
        {
            OrderStatus? parsed = null;
            if (!string.IsNullOrWhiteSpace(status))
            {
                if (!KebabEnum.TryParse<OrderStatus>(status, out var s))
                    return Results.ValidationProblem(new Dictionary<string, string[]>
                    {
                        ["status"] = [$"Можливі значення: {KebabEnum.Allowed<OrderStatus>()}"]
                    });
                parsed = s;
            }

            return (await handler.Handle(new GetOrdersQuery(parsed, page ?? 1, pageSize ?? 20, search), ct)).ToHttp();
        });

        orders.MapGet("/{number:int}", async (int number, IQueryHandler<GetOrderQuery, OrderResponse> handler, CancellationToken ct) =>
            (await handler.Handle(new GetOrderQuery(number), ct)).ToHttp());

        orders.MapPost("/{number:int}/status", async (
            int number, OrderStatusRequest request, ICommandHandler<ChangeOrderStatusCommand, OrderResponse> handler, CancellationToken ct) =>
            (await handler.Handle(new ChangeOrderStatusCommand(number, request.Action, request.TrackingNumber), ct)).ToHttp())
        .WithSummary("confirm | ship (+trackingNumber) | complete | cancel");

        orders.MapPut("/{number:int}/note", async (
            int number, OrderNoteRequest request, ICommandHandler<SetOrderNoteCommand, OrderResponse> handler, CancellationToken ct) =>
            (await handler.Handle(new SetOrderNoteCommand(number, request.Note), ct)).ToHttp())
        .WithSummary("Нотатка для себе (покупець її не бачить)");
    }
}
