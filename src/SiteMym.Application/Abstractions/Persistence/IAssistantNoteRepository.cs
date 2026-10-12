using SiteMym.Domain.Assistant;

namespace SiteMym.Application.Abstractions.Persistence;

public interface IAssistantNoteRepository
{
    /// <summary>Усі нотатки, старіші першими — у такому порядку їх бачить помічник.</summary>
    Task<IReadOnlyList<AssistantNote>> ListAsync(CancellationToken ct = default);

    Task<AssistantNote?> GetByIdAsync(Guid id, CancellationToken ct = default);

    Task<int> CountAsync(CancellationToken ct = default);

    void Add(AssistantNote note);

    void Remove(AssistantNote note);
}
