using ScoreHub.Domain.Enums;

namespace ScoreHub.Domain.Entities;

public sealed class TeamHelpRequest
{
    public Guid Id { get; set; }

    public Guid TeamId { get; set; }
    public Team Team { get; set; } = null!;

    public Guid CreatedByUserId { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public TeamHelpRequestStatus Status { get; set; } = TeamHelpRequestStatus.Open;

    public string? Message { get; set; }
}

