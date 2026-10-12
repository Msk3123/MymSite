using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SiteMym.Domain.Orders;

namespace SiteMym.Infrastructure.Persistence.Configurations;

public sealed class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.HasKey(o => o.Id);
        builder.Property(o => o.Id).ValueGeneratedNever();

        builder.Property(o => o.Number)
            .HasDefaultValueSql($"nextval('{AppDbContext.OrderNumberSequence}')")
            .ValueGeneratedOnAdd();
        builder.HasIndex(o => o.Number).IsUnique();

        builder.ComplexProperty(o => o.Customer, customer =>
        {
            customer.Property(c => c.FullName).HasMaxLength(120).IsRequired();
            customer.Property(c => c.Phone).HasMaxLength(13).IsRequired();
        });

        builder.ComplexProperty(o => o.Delivery, delivery =>
        {
            delivery.Property(d => d.City).HasMaxLength(80).IsRequired();
            delivery.Property(d => d.Branch).HasMaxLength(200).IsRequired();
        });

        builder.Property(o => o.Comment).HasMaxLength(1000);
        builder.Property(o => o.AdminNote).HasMaxLength(1000);
        builder.Property(o => o.TrackingNumber).HasMaxLength(32);

        builder.HasMany(o => o.Items)
            .WithOne()
            .HasForeignKey(i => i.OrderId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(o => o.Items).AutoInclude();

        builder.HasIndex(o => new { o.Status, o.CreatedAtUtc });
    }
}
