using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SiteMym.Domain.Products;

namespace SiteMym.Infrastructure.Persistence.Configurations;

public sealed class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).ValueGeneratedNever();

        builder.Property(p => p.Sku).HasMaxLength(32).IsRequired();
        builder.HasIndex(p => p.Sku).IsUnique();

        builder.Property(p => p.Slug).HasMaxLength(64).IsRequired();
        builder.HasIndex(p => p.Slug).IsUnique();

        builder.Property(p => p.Name).HasMaxLength(120).IsRequired();
        builder.Property(p => p.Title).HasMaxLength(200).IsRequired();
        builder.Property(p => p.Brand).HasMaxLength(80).IsRequired();
        builder.Property(p => p.Description).HasMaxLength(2000).IsRequired();
        builder.Property(p => p.StorageLocation).HasMaxLength(100);

        builder.ComplexProperty(p => p.Details, details =>
        {
            details.Property(d => d.SizeNote).HasMaxLength(40);
            details.Property(d => d.SeasonNote).HasMaxLength(120);
            details.Property(d => d.Composition).HasMaxLength(300);
            details.Property(d => d.Insulation).HasMaxLength(120);
            details.Property(d => d.FitNote).HasMaxLength(200);
            details.Property(d => d.DefectNote).HasMaxLength(300);
            details.Property(d => d.LotContents).HasMaxLength(300);
        });

        // Заміри — маленький список без власного життя, тому jsonb-колонка замість окремої таблиці.
        builder.OwnsMany(p => p.Measurements, m => m.ToJson());

        builder.HasMany(p => p.Photos)
            .WithOne()
            .HasForeignKey(ph => ph.ProductId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(p => p.Photos).AutoInclude();

        builder.Ignore(p => p.IsAvailable);

        // Кожна річ одна: якщо дві людини одночасно замовлять ту саму куртку,
        // друге збереження впаде з DbUpdateConcurrencyException (Postgres xmin).
        builder.Property<uint>("Version").IsRowVersion();

        // Основний запит каталогу: статус + стать + зріст.
        builder.HasIndex(p => new { p.Status, p.Gender, p.SizeCm });
        builder.HasIndex(p => p.CreatedAtUtc);
    }
}
