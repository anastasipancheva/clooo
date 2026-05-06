namespace ScoreHub.Domain.Entities;

/// <summary>Final score record for a team after a lecture activity.</summary>
public sealed class TeamGroupScore
{
    public Guid Id { get; set; }

    public Guid TeamId { get; set; }
    public Team Team { get; set; } = null!;

    public Guid ActivityId { get; set; }
    public Activity Activity { get; set; } = null!;

    public int TasksAccepted { get; set; }
    public int TasksTotal { get; set; }

    /// <summary>LectureBasePoints * (TasksAccepted / TasksTotal)</summary>
    public decimal BasePoints { get; set; }

    /// <summary>Bonus coefficient 0.8–1.2 set by assistant/teacher.</summary>
    public decimal GroupCoefficient { get; set; } = 1.0m;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
