using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SiteMym.Domain.Products;

namespace SiteMym.Infrastructure.Persistence.Configurations;

public sealed class ProductPhotoConfiguration : IEntityTypeConfiguration<ProductPhoto>
{
    public void Configure(EntityTypeBuilder<ProductPhoto> builder)
    {
        builder.ToTable("product_photos");
        builder.HasKey(ph => ph.Id);
        builder.Property(ph => ph.Id).ValueGeneratedNever();

        builder.Property(ph => ph.Url).HasMaxLength(500).IsRequired();
        builder.Property(ph => ph.Caption).HasMaxLength(200);

        builder.HasIndex(ph => new { ph.ProductId, ph.SortOrder });
    }
}
