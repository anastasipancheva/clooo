using ScoreHub.Domain.Enums;

namespace ScoreHub.Domain.Entities;

/// <summary>
/// A scheduled learning event: lecture (group tasks), control point (KT), or homework session.
/// </summary>
public sealed class Activity
{
    public Guid Id { get; set; }

    public Guid ModuleId { get; set; }
    public Module Module { get; set; } = null!;

    public ActivityType Type { get; set; }

    public string Title { get; set; } = null!;
    public DateTimeOffset StartsAt { get; set; }
    public DateTimeOffset EndsAt { get; set; }

    // Lecture config
    public string? PreLectureVideoUrl { get; set; }
    public decimal LectureBasePoints { get; set; } = 5.0m;
    public decimal MiniTestMaxBonus { get; set; } = 0.5m;
    public int MiniTestDurationSeconds { get; set; } = 300;
    public bool MiniTestPublished { get; set; } = false;
    public DateTimeOffset? MiniTestOpenedAt { get; set; }

    public List<TaskSet> TaskSets { get; set; } = new();
    public List<Team> Teams { get; set; } = new();
    public List<ActivityAssistant> ActiveAssistants { get; set; } = new();
    public List<MiniTestQuestion> MiniTestQuestions { get; set; } = new();
}

