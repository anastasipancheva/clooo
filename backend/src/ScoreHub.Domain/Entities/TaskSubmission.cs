using ScoreHub.Domain.Enums;

namespace ScoreHub.Domain.Entities;

/// <summary>
/// Represents either a team defense (lecture/homework session) or an individual KT defense attempt,
/// depending on which fields are set.
/// </summary>
public sealed class TaskSubmission
{
    public Guid Id { get; set; }

    public Guid ActivityId { get; set; }
    public Activity Activity { get; set; } = null!;

    public Guid TaskItemId { get; set; }
    public TaskItem TaskItem { get; set; } = null!;

    // Lecture/homework: team submission
    public Guid? TeamId { get; set; }
    public Team? Team { get; set; }

    // Control point: individual submission
    public Guid? StudentId { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// Time when the student/team marked "ready to defend".
    /// Important for KT queue ordering.
    /// </summary>
    public DateTimeOffset? ReadyAt { get; set; }

    public SubmissionStatus Status { get; set; } = SubmissionStatus.Draft;

    public Guid? ReviewerId { get; set; }

    /// <summary>Student who defends (team flow); chosen by assistant.</summary>
    public Guid? DefenderUserId { get; set; }

    public DateTimeOffset? ReviewedAt { get; set; }

    /// <summary>
    /// 1 = accepted, 0 = rejected/not solved (for now).
    /// We'll extend to points/partial acceptance later if needed.
    /// </summary>
    public int? Result01 { get; set; }

    /// <summary>
    /// Optional coefficient for defenders (individual multiplier).
    /// </summary>
    public decimal? DefenderCoefficient { get; set; }
}

