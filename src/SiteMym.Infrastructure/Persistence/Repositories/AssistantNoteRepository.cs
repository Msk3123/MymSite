using Microsoft.EntityFrameworkCore;
using SiteMym.Application.Abstractions.Persistence;
using SiteMym.Domain.Assistant;

namespace SiteMym.Infrastructure.Persistence.Repositories;

internal sealed class AssistantNoteRepository(AppDbContext db) : IAssistantNoteRepository
{
    public async Task<IReadOnlyList<AssistantNote>> ListAsync(CancellationToken ct = default) =>
        await db.AssistantNotes.AsNoTracking().OrderBy(n => n.CreatedAtUtc).ToListAsync(ct);

    public Task<AssistantNote?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        db.AssistantNotes.FirstOrDefaultAsync(n => n.Id == id, ct);

    public Task<int> CountAsync(CancellationToken ct = default) => db.AssistantNotes.CountAsync(ct);

    public void Add(AssistantNote note) => db.AssistantNotes.Add(note);

    public void Remove(AssistantNote note) => db.AssistantNotes.Remove(note);
}
