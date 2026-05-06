namespace ScoreHub.Domain.Entities;

public sealed class TeamAssistant
{
    public Guid TeamId { get; set; }
    public Team Team { get; set; } = null!;

    public Guid AssistantId { get; set; }
}

