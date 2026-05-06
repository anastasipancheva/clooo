namespace ScoreHub.Domain.Entities;

public sealed class TeamSwapLog
{
    public Guid Id { get; set; }

    public Guid ActivityId { get; set; }
    public Guid StudentAId { get; set; }
    public Guid TeamAId { get; set; }
    public Guid StudentBId { get; set; }
    public Guid TeamBId { get; set; }

    public Guid InitiatedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
