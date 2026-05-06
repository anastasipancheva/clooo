namespace ScoreHub.Domain.Entities;

public sealed class HomeworkSubmissionMember
{
    public Guid HomeworkSubmissionId { get; set; }
    public HomeworkSubmission HomeworkSubmission { get; set; } = null!;

    public Guid UserId { get; set; }
}
