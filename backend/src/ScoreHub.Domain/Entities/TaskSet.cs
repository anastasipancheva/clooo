namespace ScoreHub.Domain.Entities;

/// <summary>
/// A configurable set of tasks for an activity (lecture/KT/homework session).
/// </summary>
public sealed class TaskSet
{
    public Guid Id { get; set; }

    public Guid ActivityId { get; set; }
    public Activity Activity { get; set; } = null!;

    public string Title { get; set; } = null!;

    /// <summary>Students can see tasks only when Published = true (or activity has started for KT).</summary>
    public bool Published { get; set; } = true;

    public List<TaskItem> Tasks { get; set; } = new();
}

