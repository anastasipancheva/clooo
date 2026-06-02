namespace ScoreHub.Domain.Entities;

public sealed class CourseTemplate
{
    public Guid Id { get; set; }
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public ICollection<ModuleTemplate> Modules { get; set; } = new List<ModuleTemplate>();
}

public sealed class ModuleTemplate
{
    public Guid Id { get; set; }
    public Guid CourseTemplateId { get; set; }
    public int Number { get; set; }
    public string Title { get; set; } = "";
    public DateTimeOffset? StartsAt { get; set; }
    public DateTimeOffset? EndsAt { get; set; }

    public CourseTemplate CourseTemplate { get; set; } = null!;
    public ICollection<ActivityTemplate> Activities { get; set; } = new List<ActivityTemplate>();
}

public sealed class ActivityTemplate
{
    public Guid Id { get; set; }
    public Guid ModuleTemplateId { get; set; }
    public int Type { get; set; }   // 0=Lecture, 1=Practice, 2=KT, 3=Homework
    public string Title { get; set; } = "";
    public string? TaskFileUrl { get; set; }
    public string? TheoryTestUrl { get; set; }

    public ModuleTemplate ModuleTemplate { get; set; } = null!;
    public ICollection<TaskTemplate> Tasks { get; set; } = new List<TaskTemplate>();
}

public sealed class TaskTemplate
{
    public Guid Id { get; set; }
    public Guid ActivityTemplateId { get; set; }
    public string Code { get; set; } = "";
    public string Title { get; set; } = "";
    public decimal Points { get; set; }

    public ActivityTemplate ActivityTemplate { get; set; } = null!;
}
