namespace ScoreHub.Domain.Entities;

/// <summary>Assistant confirmed to be present at a specific activity.</summary>
public sealed class ActivityAssistant
{
    public Guid ActivityId { get; set; }
    public Activity Activity { get; set; } = null!;

    public Guid AssistantId { get; set; }
}
