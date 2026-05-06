using ScoreHub.Application.Common;

namespace ScoreHub.Application.Abstractions;

public interface IHomeworkService
{
    Task<OpResult<Guid>> CreateSubmission(Guid actorId, Guid activityId, Guid taskItemId, string documentUrl, IReadOnlyList<Guid> memberUserIds, CancellationToken ct = default);
    Task<OpResult<IReadOnlyList<HwQueueRow>>> GetQueue(Guid actorId, Guid activityId, CancellationToken ct = default);
    Task<OpResult<Unit>> StartReview(Guid actorId, Guid submissionId, CancellationToken ct = default);
    Task<OpResult<Unit>> CompleteReview(Guid actorId, Guid submissionId, bool accepted, CancellationToken ct = default);
    Task<OpResult<Unit>> BackToQueue(Guid actorId, Guid submissionId, CancellationToken ct = default);
}

public sealed record HwQueueRow(
    Guid SubmissionId,
    Guid TaskItemId,
    string TaskCode,
    string TaskTitle,
    IReadOnlyList<Guid> MemberIds,
    DateTimeOffset SubmittedAt,
    string Status,
    decimal TimeCoefficient,
    int Priority,
    string DocumentUrl);
