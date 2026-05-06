using ScoreHub.Application.Common;

namespace ScoreHub.Application.Abstractions;

public enum TeamGenerationStrategy { Random, BalanceRaw, BalanceFinal }

public interface ITeamGenerationService
{
    Task<OpResult<Unit>> AutoGenerate(Guid actorId, Guid activityId, int teamSize, TeamGenerationStrategy strategy, bool excludeAbsent, CancellationToken ct = default);
    Task<OpResult<Unit>> AutoAssignAssistants(Guid actorId, Guid activityId, CancellationToken ct = default);
    Task<OpResult<Unit>> SwapMembers(Guid actorId, Guid activityId, Guid studentAId, Guid studentBId, CancellationToken ct = default);
}
