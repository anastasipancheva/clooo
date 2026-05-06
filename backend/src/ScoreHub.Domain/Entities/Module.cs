namespace ScoreHub.Domain.Entities;

public sealed class Module
{
    public Guid Id { get; set; }

    public Guid CourseId { get; set; }
    public Course Course { get; set; } = null!;

    public int Number { get; set; } // 1..3
    public string Title { get; set; } = null!;

    public DateTimeOffset StartsAt { get; set; }
    public DateTimeOffset EndsAt { get; set; }

    public List<Activity> Activities { get; set; } = new();
}

