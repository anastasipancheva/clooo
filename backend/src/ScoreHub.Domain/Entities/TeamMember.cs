namespace ScoreHub.Domain.Entities;

public sealed class TeamMember
{
    public Guid TeamId { get; set; }
    public Team Team { get; set; } = null!;

    public Guid UserId { get; set; }

    public DateTimeOffset JoinedAt { get; set; } = DateTimeOffset.UtcNow;
    public bool IsAbsent { get; set; } // for default 0.8 coefficient logic later
}

