using ScoreHub.Application.Abstractions;
using ScoreHub.Domain.Entities;
using ScoreHub.Infrastructure.Persistence;

namespace ScoreHub.Infrastructure.Services;

public sealed class NotificationService : INotificationService
{
    private readonly ScoreHubDbContext _db;
    private readonly IRealtimePushService _push;

    public NotificationService(ScoreHubDbContext db, IRealtimePushService push)
    {
        _db = db;
        _push = push;
    }

    public async Task NotifyManyAsync(
        IReadOnlyCollection<Guid> recipientIds,
        string type,
        string title,
        string? body,
        CancellationToken cancellationToken = default)
    {
        if (recipientIds.Count == 0) return;

        var now = DateTimeOffset.UtcNow;
        var distinct = recipientIds.Distinct().ToList();

        foreach (var id in distinct)
        {
            _db.Notifications.Add(new Notification
            {
                Id = Guid.NewGuid(),
                RecipientId = id,
                Type = type,
                Title = title,
                Body = body,
                CreatedAt = now
            });
        }

        await _db.SaveChangesAsync(cancellationToken);

        await _push.PushToUsersAsync(
            distinct,
            "Notification",
            new { type, title, body, createdAt = now },
            cancellationToken);
    }
}
