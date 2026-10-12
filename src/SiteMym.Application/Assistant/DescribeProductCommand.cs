using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using SiteMym.Application.Abstractions.Ai;
using SiteMym.Application.Abstractions.Messaging;
using SiteMym.Application.Products.Manage;
using SiteMym.Domain.Common;
using SiteMym.Domain.Products;

namespace SiteMym.Application.Assistant;

/// <summary>
/// «Заповнити з фото»: модель дивиться на 1–4 фото (вигляд, бірка, деталі, дефект)
/// і пропонує, як заповнити картку. Нічого не зберігає — мама перевіряє й тисне «Зберегти».
/// </summary>
/// <param name="TagPhotoIndex">Яке з фото — бірка: його модель розгляне крупно, решту — дешево, «з першого погляду».</param>
public sealed record DescribeProductCommand(IReadOnlyList<byte[]> Photos, int? TagPhotoIndex = null) : ICommand<ProductSuggestion>
{
    public const int MaxPhotos = 4;
}

/// <param name="Uncertain">Поля, у яких модель не впевнена, — на формі вони підсвічуються «перевірте».</param>
/// <param name="ConditionNote">Чому сумнів щодо стану: «бачу невеликий катишок на рукаві».</param>
public sealed record ProductSuggestion(
    string Name,
    string? Brand,
    Gender Gender,
    ProductCategory Category,
    Season Season,
    ItemCondition Condition,
    int? SizeCm,
    string? SizeNote,
    string? Composition,
    string? Insulation,
    string Description,
    string? DefectNote,
    string? ConditionNote,
    IReadOnlyList<string> Uncertain);

internal sealed class DescribeProductCommandHandler(IChatModel model, ILogger<DescribeProductCommandHandler> logger)
    : ICommandHandler<DescribeProductCommand, ProductSuggestion>
{
    public static readonly Error NoPhotos = new("Assistant.NoPhotos", "Додайте хоча б одне фото речі");
    public static readonly Error TooManyPhotos = new("Assistant.TooManyPhotos", $"Не більше {DescribeProductCommand.MaxPhotos} фото за раз");
    public static readonly Error CannotRead = new(
        "Assistant.CannotRead", "Не вдалося розібрати фото. Спробуйте чіткіше фото бірки або заповніть вручну");

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.KebabCaseLower) }
    };

    private const string Prompt = """
        Ти допомагаєш продавчині вживаного дитячого одягу заповнити картку речі для сайту.
        На фото: загальний вигляд речі, бірка з розміром і складом, деталі, можливо дефект.

        Правила:
        - Бренд, розмір і склад бери ТІЛЬКИ з бірки. Не видно — null і додай поле в uncertain.
        - Розмір на дитячих бірках — зріст у см («98», «98/104», «2-3Y»). sizeCm — перше число зросту
          (98/104 → 98; 2-3Y → 98). sizeNote — як написано на бірці, якщо це не просто одне число.
          Для взуття sizeNote «р. 26», для шапок — обхват голови «48–50 см», а sizeCm — приблизний зріст дитини.
        - Стан: new — нове з біркою; like-new — без слідів носіння; very-good — носили, виглядає охайно;
          good — є сліди носіння. Бачиш катишки, потертості, плями — не вище very-good, опиши в defectNote,
          а сумнів поясни в conditionNote.
        - name — коротко для каталогу, 2–4 слова, з великої літери, БЕЗ бренду: «Світшот з начосом», «Куртка демісезонна».
          Кофта з довгим рукавом без застібки з трикотажу — «Світшот», в'язана — «Светр».
        - composition — українською: «80% бавовна, 20% поліестер».
        - description — 1–2 речення, як продавчиня розповіла б подрузі: чесно, просто, що видно на фото
          (колір, тканина, стан). Без реклами («ідеально», «чудово», «стильний») і без вигаданих фактів
          (не пиши «носили один сезон», якщо цього не видно).
        - Стать: рожеве/сукні — girl, але якщо річ нейтральна — unisex і додай gender в uncertain.
        Пиши українською.
        """;

    private const string Schema = """
        {
          "type": "object",
          "additionalProperties": false,
          "required": ["name","brand","gender","category","season","condition","sizeCm","sizeNote","composition","insulation","description","defectNote","conditionNote","uncertain"],
          "properties": {
            "name": { "type": "string" },
            "brand": { "type": ["string","null"] },
            "gender": { "type": "string", "enum": ["boy","girl","unisex"] },
            "category": { "type": "string", "enum": ["outerwear","tops","pants","dresses","shoes","hats","sleepwear","lots"] },
            "season": { "type": "string", "enum": ["autumn-winter","spring-summer","all-season"] },
            "condition": { "type": "string", "enum": ["new","like-new","very-good","good"] },
            "sizeCm": { "type": ["integer","null"] },
            "sizeNote": { "type": ["string","null"] },
            "composition": { "type": ["string","null"] },
            "insulation": { "type": ["string","null"] },
            "description": { "type": "string" },
            "defectNote": { "type": ["string","null"] },
            "conditionNote": { "type": ["string","null"] },
            "uncertain": { "type": "array", "items": { "type": "string",
              "enum": ["name","brand","gender","category","season","condition","sizeCm","composition"] } }
          }
        }
        """;

    public async Task<Result<ProductSuggestion>> Handle(DescribeProductCommand command, CancellationToken ct)
    {
        if (!model.IsConfigured)
            return Result.Failure<ProductSuggestion>(AssistantErrors.NotConfigured);
        if (command.Photos.Count == 0)
            return Result.Failure<ProductSuggestion>(NoPhotos);
        if (command.Photos.Count > DescribeProductCommand.MaxPhotos)
            return Result.Failure<ProductSuggestion>(TooManyPhotos);

        var images = new List<ChatImage>();
        foreach (var (photo, index) in command.Photos.Select((p, i) => (p, i)))
        {
            var extension = ImageFormat.Detect(photo.AsSpan(0, Math.Min(photo.Length, 16)));
            if (extension is null || photo.Length > AddProductPhotoCommandHandler.MaxBytes)
                return Result.Failure<ProductSuggestion>(ProductErrors.PhotoInvalid);
            var mediaType = extension switch { ".png" => "image/png", ".webp" => "image/webp", _ => "image/jpeg" };
            // Не знаємо, де бірка, — дивимось крупно на все (дорожче, але прочитає).
            images.Add(new ChatImage(mediaType, photo, HighDetail: command.TagPhotoIndex is null || command.TagPhotoIndex == index));
        }

        ChatCompletion completion;
        try
        {
            completion = await model.CompleteAsync(
                [ChatMessage.System(Prompt), ChatMessage.User("Заповни картку з цих фото.", images)],
                [],
                new ChatJsonSchema("product_card", Schema),
                ct);
        }
        catch (ChatModelException ex)
        {
            logger.LogWarning(ex, "Describe failed: {Failure}", ex.Failure);
            return Result.Failure<ProductSuggestion>(ex.Failure switch
            {
                ChatModelFailure.QuotaExceeded => AssistantErrors.NoCredit,
                ChatModelFailure.Unauthorized => AssistantErrors.BadKey,
                _ => AssistantErrors.Unavailable
            });
        }

        ProductSuggestion? suggestion;
        try
        {
            suggestion = JsonSerializer.Deserialize<ProductSuggestion>(completion.Content ?? "", Json);
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "Describe returned invalid JSON");
            return Result.Failure<ProductSuggestion>(CannotRead);
        }

        if (suggestion is null || string.IsNullOrWhiteSpace(suggestion.Name))
            return Result.Failure<ProductSuggestion>(CannotRead);

        // Зріст поза межами магазину — краще порожньо, ніж неправда.
        return suggestion.SizeCm is < Product.MinSizeCm or > Product.MaxSizeCm
            ? suggestion with { SizeCm = null, Uncertain = [.. suggestion.Uncertain, "sizeCm"] }
            : suggestion;
    }
}
