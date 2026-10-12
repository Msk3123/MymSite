namespace SiteMym.Domain.Common;

public abstract class Entity
{
    public Guid Id { get; protected init; } = Guid.CreateVersion7();

    public DateTime CreatedAtUtc { get; protected init; } = DateTime.UtcNow;
}
