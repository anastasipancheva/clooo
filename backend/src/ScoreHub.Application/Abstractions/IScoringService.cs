using ScoreHub.Application.Common;

namespace ScoreHub.Application.Abstractions;

public interface IScoringService
{
    /// <summary>Finalize KT: compute multiplier per student, recalculate ModuleScore.</summary>
    Task<OpResult<Unit>> FinalizeKt(Guid actorId, Guid activityId, CancellationToken ct = default);

    Task<OpResult<StudentScoreDto>> GetStudentScore(Guid actorId, Guid courseId, Guid studentId, CancellationToken ct = default);
    Task<OpResult<IReadOnlyList<StudentScoreDto>>> GetCourseScores(Guid actorId, Guid courseId, CancellationToken ct = default);
}

public sealed record StudentScoreDto(
    Guid StudentId,
    string DisplayName,
    IReadOnlyList<ModuleScoreDto> Modules,
    decimal FinalScore,
    string Mark);

public sealed record ModuleScoreDto(
    int ModuleNumber,
    decimal LecturePoints,
    decimal HomeworkPoints,
    decimal KtMultiplier,
    decimal ModuleScore);
