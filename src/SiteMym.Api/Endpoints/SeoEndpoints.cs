using System.Globalization;
using System.Security;
using System.Text;
using SiteMym.Application.Abstractions.Messaging;
using SiteMym.Application.Common;
using SiteMym.Application.Products;
using SiteMym.Application.Products.GetProducts;

namespace SiteMym.Api.Endpoints;

/// <summary>
/// robots.txt і sitemap.xml — щоб Google знайшов і проіндексував сайт.
/// Мапляться в корінь (не під /api), до запасного маршруту React.
/// Адреса сайту — з Seo:SiteUrl (основний домен), інакше з поточного запиту.
/// </summary>
public static class SeoEndpoints
{
    public static void MapSeo(this WebApplication app)
    {
        app.MapGet("/robots.txt", (HttpContext http, IConfiguration config) =>
        {
            var site = SiteUrl(http, config);
            var text = $"""
                User-agent: *
                Allow: /
                Disallow: /admin
                Disallow: /api/
                Disallow: /checkout

                Sitemap: {site}/sitemap.xml
                """;
            return Results.Text(text.Replace("\r\n", "\n"), "text/plain; charset=utf-8");
        }).ExcludeFromDescription();

        app.MapGet("/sitemap.xml", async (
            HttpContext http,
            IConfiguration config,
            IQueryHandler<GetProductsQuery, PagedList<ProductListItem>> products,
            CancellationToken ct) =>
        {
            var site = SiteUrl(http, config);
            var xml = new StringBuilder();
            xml.AppendLine("""<?xml version="1.0" encoding="UTF-8"?>""");
            xml.AppendLine("""<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">""");

            void Url(string path, string priority, DateTime? modified = null)
            {
                xml.Append("  <url><loc>").Append(SecurityElement.Escape(site + path)).Append("</loc>");
                if (modified is { } m)
                    xml.Append("<lastmod>").Append(m.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)).Append("</lastmod>");
                xml.Append("<priority>").Append(priority).AppendLine("</priority></url>");
            }

            Url("/", "1.0");
            Url("/catalog", "0.9");
            foreach (var gender in new[] { "boy", "girl", "unisex" })
                Url($"/catalog?gender={gender}", "0.8");

            // Лише те, що можна купити: продане й сховане Google не потрібне.
            for (var page = 1; ; page++)
            {
                var result = await products.Handle(new GetProductsQuery(new ProductFilter
                {
                    IncludeSold = false,
                    Page = page,
                    PageSize = ProductFilter.MaxPageSize
                }), ct);
                if (result.IsFailure)
                    break;
                foreach (var p in result.Value.Items)
                    Url($"/product/{p.Slug}", "0.7", p.CreatedAtUtc);
                if (!result.Value.HasNextPage)
                    break;
            }

            xml.AppendLine("</urlset>");
            return Results.Text(xml.ToString(), "application/xml; charset=utf-8");
        }).ExcludeFromDescription();
    }

    private static string SiteUrl(HttpContext http, IConfiguration config) =>
        (config["Seo:SiteUrl"] is { Length: > 0 } configured ? configured : $"{http.Request.Scheme}://{http.Request.Host}").TrimEnd('/');
}
