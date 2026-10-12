using Microsoft.AspNetCore.Mvc;
using SiteMym.Api.Auth;
using SiteMym.Api.Common;
using SiteMym.Application.Abstractions.Ai;
using SiteMym.Application.Abstractions.Messaging;
using SiteMym.Application.Assistant;

namespace SiteMym.Api.Endpoints.Admin;

/// <param name="Context">Що відкрито на екрані: «замовлення №1047» — помічник розумітиме «а що їй відповісти?».</param>
public sealed record AssistantRequest(AssistantMessage[] Messages, string? Context);

public sealed class AssistantEndpoints : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var assistant = app.MapGroup("/admin/assistant")
            .RequireAuthorization(AdminAuth.Policy)
            .WithTags("Admin: assistant");

        assistant.MapGet("/", (IChatModel model) => Results.Ok(new { enabled = model.IsConfigured }))
            .WithSummary("Чи підключений помічник (є ключ OpenAI)");

        assistant.MapPost("/", async (
            AssistantRequest request,
            ICommandHandler<AskAssistantCommand, AssistantReply> handler,
            CancellationToken ct) =>
            (await handler.Handle(new AskAssistantCommand(request.Messages ?? [], request.Context), ct)).ToHttp())
        .RequireRateLimiting(AdminAuth.AssistantRateLimit)
        .WithSummary("Питання помічнику; історію розмови надсилає браузер");

        assistant.MapPost("/describe", async (
            IFormFileCollection files,
            [FromForm] int? tagIndex,
            ICommandHandler<DescribeProductCommand, ProductSuggestion> handler,
            CancellationToken ct) =>
        {
            var photos = new List<byte[]>();
            foreach (var file in files.Take(DescribeProductCommand.MaxPhotos + 1))
            {
                await using var stream = file.OpenReadStream();
                using var buffer = new MemoryStream();
                await stream.CopyToAsync(buffer, ct);
                photos.Add(buffer.ToArray());
            }
            return (await handler.Handle(new DescribeProductCommand(photos, tagIndex), ct)).ToHttp();
        })
        // Кука адмінки SameSite=Strict — antiforgery-токен не потрібен (як і для завантаження фото).
        .DisableAntiforgery()
        .WithMetadata(new RequestSizeLimitAttribute(4 * 12 * 1024 * 1024))
        .RequireRateLimiting(AdminAuth.AssistantRateLimit)
        .WithSummary("Заповнити картку речі з фото (multipart: files до 4, tagIndex — яке фото бірка)");
    }
}
