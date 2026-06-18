using ScoreHub.Application.Common;

namespace ScoreHub.Application.Abstractions;

public interface IScoringService
{
    /// <summary>Finalize KT: compute multiplier per student, recalculate ModuleScore.</summary>
    Task<OpResult<Unit>> FinalizeKt(Guid actorId, Guid activityId, CancellationToken ct = default);

    /// <summary>Пересчитать баллы модуля занятия для всех записанных студентов (при завершении занятия).
    /// КТ-множитель сохраняется (или 1.0, если КТ ещё не финализирована).</summary>
    Task RecomputeModuleScoresForActivity(Guid activityId, CancellationToken ct = default);

    /// <summary>Пересчитать и сохранить балл одного студента за модуль с учётом ручных правок.</summary>
    Task RecomputeStudentModule(Guid courseId, Guid studentId, int moduleNumber, CancellationToken ct = default);

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
