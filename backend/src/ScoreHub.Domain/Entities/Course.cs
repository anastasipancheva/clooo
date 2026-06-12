namespace ScoreHub.Domain.Entities;

public sealed class Course
{
    public Guid Id { get; set; }

    public string Code { get; set; } = null!; // e.g. MKN2
    public string Title { get; set; } = null!;
    public string AcademicYear { get; set; } = null!; // e.g. 2024/2025

    // JSON: [{"tasks_solved":0,"multiplier":0.5}, ...]
    public string KtMultiplierMapJson { get; set; } =
        """[{"tasks_solved":0,"multiplier":0.5},{"tasks_solved":1,"multiplier":0.7},{"tasks_solved":2,"multiplier":1.0},{"tasks_solved":3,"multiplier":1.3},{"tasks_solved":4,"multiplier":1.7},{"tasks_solved":5,"multiplier":2.0}]""";

    // JSON: [{"min":233,"mark":"5+"}, ...]
    public string FinalGradingTableJson { get; set; } =
        """[{"min":233,"mark":"5+"},{"min":215,"mark":"5"},{"min":200,"mark":"5-"},{"min":183,"mark":"4+"},{"min":166,"mark":"4"},{"min":150,"mark":"4-"},{"min":131,"mark":"3+"},{"min":113,"mark":"3"},{"min":92,"mark":"3-"},{"min":75,"mark":"2+"},{"min":60,"mark":"2"},{"min":0,"mark":"2-"}]""";

    /// <summary>Уникальный код приглашения (8 симв.). Студент может записаться только зная этот код.</summary>
    public string InviteCode { get; set; } = null!;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public List<Module> Modules { get; set; } = new();
}

