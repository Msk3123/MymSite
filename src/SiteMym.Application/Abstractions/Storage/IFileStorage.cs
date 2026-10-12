namespace SiteMym.Application.Abstractions.Storage;

/// <summary>
/// Де лежать фото речей. Зараз — папка на диску сервера (LocalFileStorage),
/// пізніше можна підмінити на Cloudflare R2 / S3 / Azure Blob без змін у use cases.
/// </summary>
public interface IFileStorage
{
    /// <returns>Публічна адреса файлу, яку можна вставити в &lt;img src&gt;.</returns>
    Task<string> SaveAsync(Stream content, string folder, string extension, CancellationToken ct = default);

    /// <summary>Тихо нічого не робить, якщо файлу вже немає.</summary>
    Task DeleteAsync(string url, CancellationToken ct = default);
}
