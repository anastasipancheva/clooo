using ScoreHub.Application.Common;
using ScoreHub.Domain.Enums;

namespace ScoreHub.Application.Abstractions;

public interface ITeachingSetupService
{
    Task<OpResult<Guid>> CreateCourse(Guid actorId, string code, string title, string academicYear, CancellationToken ct = default);
    Task<OpResult<Guid>> AddModule(Guid actorId, Guid courseId, int number, string title, DateTimeOffset startsAt, DateTimeOffset endsAt, CancellationToken ct = default);
    Task<OpResult<Guid>> AddActivity(
        Guid actorId,
        Guid moduleId,
        ActivityType type,
        string title,
        DateTimeOffset startsAt,
        DateTimeOffset endsAt,
        CancellationToken ct = default);

    Task<OpResult<Guid>> AddTaskSet(Guid actorId, Guid activityId, string title, CancellationToken ct = default);
    Task<OpResult<Guid>> AddTaskItem(Guid actorId, Guid taskSetId, string code, string title, string? statement, decimal points, CancellationToken ct = default);

    Task<OpResult<Unit>> SetTaskAssistants(Guid actorId, Guid taskItemId, IReadOnlyList<Guid> assistantUserIds, CancellationToken ct = default);
    Task<OpResult<Guid>> CreateTeam(Guid actorId, Guid activityId, string name, CancellationToken ct = default);
    Task<OpResult<Unit>> SetTeamMembers(Guid actorId, Guid teamId, IReadOnlyList<Guid> memberUserIds, CancellationToken ct = default);
    Task<OpResult<Unit>> SetTeamAssistants(Guid actorId, Guid teamId, IReadOnlyList<Guid> assistantUserIds, CancellationToken ct = default);
}

/// <summary>Marker for operations without return payload.</summary>
public readonly struct Unit
{
    public static Unit Value => default;
}
