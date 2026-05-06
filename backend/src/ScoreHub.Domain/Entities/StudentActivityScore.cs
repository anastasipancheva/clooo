namespace ScoreHub.Domain.Entities;

/// <summary>Running score record for one student across the semester.</summary>
public sealed class StudentActivityScore
{
    public Guid Id { get; set; }

    public Guid CourseId { get; set; }
    public Course Course { get; set; } = null!;

    public Guid StudentId { get; set; }
    public int ModuleNumber { get; set; } // 1, 2, or 3

    // Sum of (GroupPoints * GroupCoeff + MiniTestBonus) across all lectures in module
    public decimal LecturePoints { get; set; }

    // Sum of (HW_Points * TimeCoeff) across all HW submissions in module
    public decimal HomeworkPoints { get; set; }

    // KT multiplier applied after KT finalize
    public decimal KtMultiplier { get; set; } = 1.0m;

    // (LecturePoints + HomeworkPoints) * KtMultiplier
    public decimal ModuleScore { get; set; }

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
