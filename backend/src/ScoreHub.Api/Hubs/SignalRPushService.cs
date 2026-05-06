using Microsoft.AspNetCore.SignalR;
using ScoreHub.Application.Abstractions;

namespace ScoreHub.Api.Hubs;

public sealed class SignalRPushService : IRealtimePushService
{
    private readonly IHubContext<NotificationHub> _hub;

    public SignalRPushService(IHubContext<NotificationHub> hub)
    {
        _hub = hub;
    }

    public Task PushToUsersAsync(IEnumerable<Guid> userIds, string method, object payload, CancellationToken ct = default)
    {
        var tasks = userIds.Select(id =>
            _hub.Clients.Group(id.ToString()).SendAsync(method, payload, ct));
        return Task.WhenAll(tasks);
    }
}
