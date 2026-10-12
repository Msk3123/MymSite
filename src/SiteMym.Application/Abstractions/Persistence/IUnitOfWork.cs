namespace SiteMym.Application.Abstractions.Persistence;

public interface IUnitOfWork
{
    /// <exception cref="ConcurrencyConflictException">Запис змінили паралельно.</exception>
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
