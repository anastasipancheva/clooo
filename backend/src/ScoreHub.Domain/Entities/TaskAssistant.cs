namespace ScoreHub.Domain.Entities;

/// <summary>
/// Assistants assigned to accept/grade a specific task (typical for KT).
/// </summary>
public sealed class TaskAssistant
{
    public Guid TaskItemId { get; set; }
    public TaskItem TaskItem { get; set; } = null!;

    public Guid AssistantId { get; set; }
}

