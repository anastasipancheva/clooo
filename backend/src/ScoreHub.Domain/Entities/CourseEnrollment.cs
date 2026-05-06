namespace ScoreHub.Domain.Entities;

public sealed class CourseEnrollment
{
    public Guid CourseId { get; set; }
    public Guid UserId { get; set; }
    public DateTimeOffset EnrolledAt { get; set; } = DateTimeOffset.UtcNow;
}
