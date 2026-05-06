namespace ScoreHub.Domain.Entities;

public sealed class Notification
{
    public Guid Id { get; set; }

    public Guid RecipientId { get; set; }

    public string Type { get; set; } = null!; // e.g. "TeamHelpRequested", "ReadyToDefend"
    public string Title { get; set; } = null!;
    public string? Body { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ReadAt { get; set; }
}

