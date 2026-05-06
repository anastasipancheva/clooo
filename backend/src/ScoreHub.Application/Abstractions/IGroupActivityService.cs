using ScoreHub.Application.Common;

namespace ScoreHub.Application.Abstractions;

public interface IGroupActivityService
{
    Task<OpResult<Guid>> RequestAssistantHelp(Guid actorId, Guid teamId, string? message, CancellationToken ct = default);
    Task<OpResult<Unit>> MarkTeamTaskReady(Guid actorId, Guid teamId, Guid taskItemId, CancellationToken ct = default);

    Task<OpResult<IReadOnlyList<HelpRequestRow>>> ListOpenHelpRequests(Guid actorId, Guid activityId, CancellationToken ct = default);
    Task<OpResult<Unit>> ResolveHelpRequest(Guid actorId, Guid helpRequestId, CancellationToken ct = default);

    Task<OpResult<IReadOnlyList<TeamSubmissionRow>>> ListPendingTeamSubmissions(Guid actorId, Guid activityId, CancellationToken ct = default);
    Task<OpResult<Unit>> StartTeamReview(Guid actorId, Guid submissionId, Guid defenderUserId, CancellationToken ct = default);
    Task<OpResult<Unit>> CompleteTeamReview(Guid actorId, Guid submissionId, bool accepted, int result01, decimal? defenderCoefficient, CancellationToken ct = default);
}

public sealed record HelpRequestRow(Guid Id, Guid TeamId, string TeamName, Guid CreatedByUserId, DateTimeOffset CreatedAt, string? Message);

public sealed record TeamSubmissionRow(
    Guid SubmissionId,
    Guid TeamId,
    string TeamName,
    Guid TaskItemId,
    string TaskCode,
    SubmissionStatusDto Status,
    DateTimeOffset? ReadyAt,
    Guid? ReviewerId,
    Guid? DefenderUserId);

public enum SubmissionStatusDto
{
    Draft = 1,
    ReadyForReview = 2,
    InReview = 3,
    Accepted = 4,
    Rejected = 5
}
