using SiteMym.Domain.Common;

namespace SiteMym.Api.Common;

public static class ApiResults
{
    /// <summary>
    /// Доменна помилка → ProblemDetails. Код помилки («Order.InvalidPhone») іде в поле code,
    /// щоб фронт міг підсвітити потрібне поле, а текст — у title, щоб його можна було просто показати.
    /// </summary>
    public static IResult Problem(Error error) =>
        Results.Problem(
            statusCode: StatusFor(error),
            title: error.Message,
            extensions: new Dictionary<string, object?> { ["code"] = error.Code });

    /// <summary>Успіх → 200 з тілом, помилка → ProblemDetails.</summary>
    public static IResult ToHttp<T>(this Result<T> result) =>
        result.IsSuccess ? Results.Ok(result.Value) : Problem(result.Error);

    private static int StatusFor(Error error) => error.Code switch
    {
        _ when error.Code.EndsWith(".NotFound", StringComparison.Ordinal) => StatusCodes.Status404NotFound,
        _ when error.Code.EndsWith(".Conflict", StringComparison.Ordinal) => StatusCodes.Status409Conflict,
        "Product.NotAvailable" or "Order.ItemsJustTaken" or "Product.UsedInOrders"
            or "Product.InvalidStatus" or "Order.InvalidStatus" => StatusCodes.Status409Conflict,
        _ when error.Code.StartsWith("Assistant.", StringComparison.Ordinal)
            && error.Code is not ("Assistant.EmptyQuestion" or "Assistant.QuestionTooLong") => StatusCodes.Status503ServiceUnavailable,
        _ => StatusCodes.Status400BadRequest
    };
}
