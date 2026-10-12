using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SiteMym.Domain.Orders;
using SiteMym.Domain.Products;

namespace SiteMym.Infrastructure.Persistence.Configurations;

public sealed class OrderItemConfiguration : IEntityTypeConfiguration<OrderItem>
{
    public void Configure(EntityTypeBuilder<OrderItem> builder)
    {
        builder.ToTable("order_items");
        builder.HasKey(i => i.Id);
        builder.Property(i => i.Id).ValueGeneratedNever();

        builder.Property(i => i.Sku).HasMaxLength(32).IsRequired();
        builder.Property(i => i.Name).HasMaxLength(200).IsRequired();

        // Річ не можна видалити, поки вона є в замовленні.
        builder.HasOne<Product>()
            .WithMany()
            .HasForeignKey(i => i.ProductId)
            .OnDelete(DeleteBehavior.Restrict);

        // Одна річ — максимум в одному активному замовленні забезпечує статус Reserved,
        // а цей індекс пришвидшує пошук «в якому замовленні ця річ».
        builder.HasIndex(i => i.ProductId);
    }
}
