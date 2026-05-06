namespace ScoreHub.Application.Abstractions;

public interface IRealtimePushService
{
    Task PushToUsersAsync(IEnumerable<Guid> userIds, string method, object payload, CancellationToken ct = default);
}
