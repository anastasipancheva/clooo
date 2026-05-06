using ScoreHub.Application.Common;

namespace ScoreHub.Application.Abstractions;

public interface IControlPointService
{
    Task<OpResult<Unit>> MarkTaskReady(Guid actorId, Guid activityId, Guid taskItemId, CancellationToken ct = default);
    Task<OpResult<IReadOnlyList<KtQueueRow>>> GetQueueForTask(Guid actorId, Guid activityId, Guid taskItemId, CancellationToken ct = default);
    Task<OpResult<Unit>> CallNextStudent(Guid actorId, Guid activityId, Guid taskItemId, CancellationToken ct = default);
    Task<OpResult<Unit>> CompleteKtReview(Guid actorId, Guid submissionId, bool accepted, int result01, decimal? defenderCoefficient, CancellationToken ct = default);
    Task<OpResult<IReadOnlyList<MyKtSlotRow>>> GetMyQueue(Guid actorId, Guid activityId, CancellationToken ct = default);
}

public sealed record KtQueueRow(
    Guid SubmissionId,
    Guid StudentId,
    string StudentEmail,
    DateTimeOffset? ReadyAt,
    string Status);

public sealed record MyKtSlotRow(Guid TaskItemId, string TaskCode, string Status, int QueuePosition, DateTimeOffset? ReadyAt);
