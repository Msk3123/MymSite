using System.Text.Json;

namespace SiteMym.Api.Common;

/// <summary>
/// Enum-и в API виглядають так само, як у фронтових URL: AutumnWinter ⇄ "autumn-winter".
/// JSON це робить через JsonStringEnumConverter, а тут — те саме для query-параметрів.
/// </summary>
public static class KebabEnum
{
    public static readonly JsonNamingPolicy Policy = JsonNamingPolicy.KebabCaseLower;

    public static string ToKebab<TEnum>(TEnum value) where TEnum : struct, Enum =>
        Policy.ConvertName(value.ToString());

    public static bool TryParse<TEnum>(string value, out TEnum result) where TEnum : struct, Enum
    {
        foreach (var candidate in Enum.GetValues<TEnum>())
        {
            if (string.Equals(ToKebab(candidate), value.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                result = candidate;
                return true;
            }
        }

        result = default;
        return false;
    }

    public static string Allowed<TEnum>() where TEnum : struct, Enum =>
        string.Join(", ", Enum.GetValues<TEnum>().Select(ToKebab));
}
