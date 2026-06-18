namespace ScoreHub.Domain.Entities;

/// <summary>Ручная правка значения ячейки в ведомости (преподаватель/ассистент).
/// CellKey кодирует ячейку: task:&lt;activityId&gt;:&lt;code&gt;, test:&lt;activityId&gt;,
/// homework:&lt;moduleNumber&gt;, ktCoef:&lt;moduleNumber&gt;, ktPoints:&lt;moduleNumber&gt;.</summary>
public sealed class GradeOverride
{
    public Guid Id { get; set; }
    public Guid CourseId { get; set; }
    public Guid StudentId { get; set; }
    public string CellKey { get; set; } = "";
    public decimal Value { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
