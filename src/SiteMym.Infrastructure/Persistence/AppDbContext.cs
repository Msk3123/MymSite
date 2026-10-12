using Microsoft.EntityFrameworkCore;
using SiteMym.Application.Abstractions.Persistence;
using SiteMym.Domain.Orders;
using SiteMym.Domain.Products;

namespace SiteMym.Infrastructure.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options), IUnitOfWork
{
    public const string OrderNumberSequence = "order_numbers";

    public DbSet<Product> Products => Set<Product>();
    public DbSet<Order> Orders => Set<Order>();

    public override async Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken ct = default)
    {
        try
        {
            return await base.SaveChangesAsync(acceptAllChangesOnSuccess, ct);
        }
        catch (DbUpdateConcurrencyException ex)
        {
            // Application нічого не знає про EF — віддаємо йому свій тип.
            throw new ConcurrencyConflictException(ex);
        }
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasSequence<int>(OrderNumberSequence).StartsAt(1001);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }

    protected override void ConfigureConventions(ModelConfigurationBuilder builder)
    {
        // Enum-и зберігаємо рядками: у базі видно «Available», а не «1».
        builder.Properties<Enum>().HaveConversion<string>().HaveMaxLength(32);
        builder.Properties<decimal>().HavePrecision(10, 2);
    }
}
