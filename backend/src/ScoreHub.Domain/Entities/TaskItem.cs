namespace ScoreHub.Domain.Entities;

/// <summary>
/// A single problem/exercise to be solved and defended.
/// </summary>
public sealed class TaskItem
{
    public Guid Id { get; set; }

    public Guid TaskSetId { get; set; }
    public TaskSet TaskSet { get; set; } = null!;

    public string Code { get; set; } = null!; // e.g. "A1", "KT-3"
    public string Title { get; set; } = null!;
    public string? Statement { get; set; }

    /// <summary>
    /// Default points for homework tasks; for lecture/KT can be treated as weight/config.
    /// </summary>
    public decimal Points { get; set; }

    public List<TaskAssistant> Assistants { get; set; } = new();
}

