using Microsoft.Extensions.Options;

namespace SiteMym.Application.Common;

/// <summary>
/// «Сьогодні» для магазину — це сьогодні за Києвом, а не за UTC.
/// Інакше замовлення о 01:30 ночі потрапило б у «вчора».
/// </summary>
public sealed class ShopClock(TimeProvider time, IOptions<ShopSettings> settings)
{
    private readonly TimeZoneInfo _zone = TimeZoneInfo.FindSystemTimeZoneById(settings.Value.TimeZone);

    public DateTime UtcNow => time.GetUtcNow().UtcDateTime;

    public DateTime LocalNow => TimeZoneInfo.ConvertTimeFromUtc(UtcNow, _zone);

    public DateTime TodayStartUtc => ToUtc(LocalNow.Date);

    public DateTime MonthStartUtc => ToUtc(new DateTime(LocalNow.Year, LocalNow.Month, 1));

    public DateTime ToLocal(DateTime utc) => TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), _zone);

    public DateTime ToUtc(DateTime local) =>
        TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(local, DateTimeKind.Unspecified), _zone);
}
