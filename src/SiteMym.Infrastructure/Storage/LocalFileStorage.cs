using Microsoft.Extensions.Options;
using SiteMym.Application.Abstractions.Storage;

namespace SiteMym.Infrastructure.Storage;

/// <summary>Секція «Storage» в appsettings.json.</summary>
public sealed class LocalStorageOptions
{
    public const string SectionName = "Storage";

    /// <summary>Папка на диску. Відносний шлях рахується від кореня API-проєкту.</summary>
    public string LocalPath { get; set; } = "uploads";

    /// <summary>З якої адреси файли роздає API: /uploads/products/…/x.jpg.</summary>
    public string PublicPath { get; set; } = "/uploads";

    /// <summary>Повний шлях — заповнюється при старті (див. DependencyInjection).</summary>
    public string RootPath { get; set; } = string.Empty;
}

/// <summary>
/// Фото на диску сервера поруч з API. Просто і безкоштовно, але:
/// папку треба бекапити разом з базою, і на кількох серверах одночасно так не вийде.
/// Коли це стане проблемою — нова реалізація IFileStorage для R2/S3, решта коду не зміниться.
/// </summary>
internal sealed class LocalFileStorage(IOptions<LocalStorageOptions> options) : IFileStorage
{
    private readonly LocalStorageOptions _options = options.Value;

    public async Task<string> SaveAsync(Stream content, string folder, string extension, CancellationToken ct = default)
    {
        var relative = Path.Combine(folder, $"{Guid.CreateVersion7():N}{extension}");
        var fullPath = Resolve(relative);
        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);

        await using (var file = new FileStream(fullPath, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, useAsync: true))
            await content.CopyToAsync(file, ct);

        return $"{_options.PublicPath.TrimEnd('/')}/{relative.Replace('\\', '/')}";
    }

    public Task DeleteAsync(string url, CancellationToken ct = default)
    {
        var prefix = _options.PublicPath.TrimEnd('/') + "/";
        if (!url.StartsWith(prefix, StringComparison.Ordinal))
            return Task.CompletedTask;

        var fullPath = Resolve(url[prefix.Length..]);
        if (File.Exists(fullPath))
            File.Delete(fullPath);

        // Остання фото речі — прибираємо й порожню папку products/{id}.
        var folder = Path.GetDirectoryName(fullPath)!;
        if (Directory.Exists(folder) && !Directory.EnumerateFileSystemEntries(folder).Any())
            Directory.Delete(folder);
        return Task.CompletedTask;
    }

    /// <summary>Захист від «../../appsettings.json»: шлях мусить лишатися всередині папки сховища.</summary>
    private string Resolve(string relative)
    {
        var root = Path.GetFullPath(_options.RootPath);
        var full = Path.GetFullPath(Path.Combine(root, relative));
        if (!full.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Path escapes the storage root.");
        return full;
    }
}
