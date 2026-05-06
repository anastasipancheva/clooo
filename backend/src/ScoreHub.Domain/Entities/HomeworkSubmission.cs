using ScoreHub.Domain.Enums;

namespace ScoreHub.Domain.Entities;

/// <summary>Submission of a homework or group-session task by 1–3 students.</summary>
public sealed class HomeworkSubmission
{
    public Guid Id { get; set; }

    public Guid ActivityId { get; set; }
    public Activity Activity { get; set; } = null!;

    public Guid TaskItemId { get; set; }
    public TaskItem TaskItem { get; set; } = null!;

    public string DocumentUrl { get; set; } = null!;
    public DateTimeOffset SubmittedAt { get; set; } = DateTimeOffset.UtcNow;

    public SubmissionStatus Status { get; set; } = SubmissionStatus.Draft;

    public Guid? ReviewerId { get; set; }
    public DateTimeOffset? ReviewStartedAt { get; set; }
    public DateTimeOffset? ReviewedAt { get; set; }

    public int? Result01 { get; set; }

    /// <summary>Computed at submission time: 1.0 / 0.75 / 0.5 based on deadline rules.</summary>
    public decimal TimeCoefficient { get; set; } = 1.0m;

    public List<HomeworkSubmissionMember> Members { get; set; } = new();
}
