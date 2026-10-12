using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SiteMym.Domain.Assistant;

namespace SiteMym.Infrastructure.Persistence.Configurations;

public sealed class AssistantNoteConfiguration : IEntityTypeConfiguration<AssistantNote>
{
    public void Configure(EntityTypeBuilder<AssistantNote> builder)
    {
        builder.ToTable("assistant_notes");
        builder.HasKey(n => n.Id);
        builder.Property(n => n.Id).ValueGeneratedNever();
        builder.Property(n => n.Text).HasMaxLength(AssistantNote.MaxLength).IsRequired();
    }
}
