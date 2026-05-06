namespace ScoreHub.Application.Abstractions;

public interface INotificationService
{
    Task NotifyManyAsync(
        IReadOnlyCollection<Guid> recipientIds,
        string type,
        string title,
        string? body,
        CancellationToken cancellationToken = default);
}
