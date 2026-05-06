using Microsoft.EntityFrameworkCore;
using ScoreHub.Application.Abstractions;
using ScoreHub.Application.Common;
using ScoreHub.Domain.Entities;
using ScoreHub.Domain.Enums;
using ScoreHub.Infrastructure.Persistence;

namespace ScoreHub.Infrastructure.Services;

public sealed class ControlPointService : IControlPointService
{
    private readonly ScoreHubDbContext _db;
    private readonly INotificationService _notify;

    public ControlPointService(ScoreHubDbContext db, INotificationService notify)
    {
        _db = db;
        _notify = notify;
    }

    private static bool CanAssist(UserRole r) => r is UserRole.Assistant or UserRole.Teacher or UserRole.Admin;

    private static bool WithinWindow(Activity a) =>
        DateTimeOffset.UtcNow >= a.StartsAt && DateTimeOffset.UtcNow <= a.EndsAt;

    private Task<bool> StudentHasConcurrentReviewAsync(Guid activityId, Guid studentId, Guid? exceptSubmissionId, CancellationToken ct) =>
        _db.TaskSubmissions.AnyAsync(
            s => s.ActivityId == activityId
                 && s.StudentId == studentId
                 && s.Status == SubmissionStatus.InReview
                 && (exceptSubmissionId == null || s.Id != exceptSubmissionId),
            ct);

    public async Task<OpResult<Unit>> MarkTaskReady(Guid actorId, Guid activityId, Guid taskItemId, CancellationToken ct = default)
    {
        var activity = await _db.Activities.FirstOrDefaultAsync(a => a.Id == activityId, ct);
        if (activity is null)
            return OpResult<Unit>.Fail("Занятие не найдено.");

        if (activity.Type != ActivityType.ControlPoint)
            return OpResult<Unit>.Fail("Это не контрольная точка.");

        if (!WithinWindow(activity))
            return OpResult<Unit>.Fail("Вне времени занятия.");

        var task = await _db.TaskItems.Include(t => t.TaskSet).FirstOrDefaultAsync(t => t.Id == taskItemId, ct);
        if (task is null || task.TaskSet.ActivityId != activityId)
            return OpResult<Unit>.Fail("Задача не относится к этой КТ.");

        var sub = await _db.TaskSubmissions.FirstOrDefaultAsync(
            s => s.ActivityId == activityId && s.TaskItemId == taskItemId && s.StudentId == actorId,
            ct);

        if (sub is { Status: SubmissionStatus.Accepted })
            return OpResult<Unit>.Fail("Задача уже принята.");

        if (sub is null)
        {
            sub = new TaskSubmission
            {
                Id = Guid.NewGuid(),
                ActivityId = activityId,
                TaskItemId = taskItemId,
                StudentId = actorId,
                CreatedAt = DateTimeOffset.UtcNow,
                Status = SubmissionStatus.ReadyForReview,
                ReadyAt = DateTimeOffset.UtcNow
            };
            _db.TaskSubmissions.Add(sub);
        }
        else
        {
            if (sub.Status == SubmissionStatus.InReview)
                return OpResult<Unit>.Fail("Вы уже вызваны на приём по этой задаче.");

            sub.Status = SubmissionStatus.ReadyForReview;
            sub.ReadyAt = DateTimeOffset.UtcNow;
            sub.ReviewerId = null;
            sub.DefenderUserId = null;
            sub.ReviewedAt = null;
            sub.Result01 = null;
            sub.DefenderCoefficient = null;
        }

        await _db.SaveChangesAsync(ct);

        var assistants = await _db.TaskAssistants
            .Where(x => x.TaskItemId == taskItemId)
            .Select(x => x.AssistantId)
            .ToListAsync(ct);

        if (assistants.Count > 0)
        {
            await _notify.NotifyManyAsync(
                assistants,
                "KtTaskReady",
                "Студент отметил готовность по задаче КТ",
                $"Задача {task.Code}",
                ct);
        }

        return OpResult<Unit>.Ok(Unit.Value);
    }

    public async Task<OpResult<IReadOnlyList<KtQueueRow>>> GetQueueForTask(
        Guid actorId,
        Guid activityId,
        Guid taskItemId,
        CancellationToken ct = default)
    {
        var actor = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == actorId, ct);
        if (actor is null || !CanAssist(actor.Role))
            return OpResult<IReadOnlyList<KtQueueRow>>.Fail("Недостаточно прав.");

        if (!await _db.TaskAssistants.AnyAsync(x => x.TaskItemId == taskItemId && x.AssistantId == actorId, ct)
            && actor.Role is not (UserRole.Teacher or UserRole.Admin))
            return OpResult<IReadOnlyList<KtQueueRow>>.Fail("Вы не закреплены за этой задачей.");

        var activity = await _db.Activities.AsNoTracking().FirstOrDefaultAsync(a => a.Id == activityId, ct);
        if (activity is null || activity.Type != ActivityType.ControlPoint)
            return OpResult<IReadOnlyList<KtQueueRow>>.Fail("Неверное занятие.");

        var list = await _db.TaskSubmissions
            .Where(s => s.ActivityId == activityId && s.TaskItemId == taskItemId && s.StudentId != null)
            .Where(s => s.Status == SubmissionStatus.ReadyForReview || s.Status == SubmissionStatus.InReview)
            .OrderBy(s => s.ReadyAt)
            .Join(_db.Users, s => s.StudentId, u => u.Id, (s, u) => new KtQueueRow(
                s.Id,
                u.Id,
                u.Email,
                s.ReadyAt,
                s.Status.ToString()))
            .ToListAsync(ct);

        return OpResult<IReadOnlyList<KtQueueRow>>.Ok(list);
    }

    public async Task<OpResult<Unit>> CallNextStudent(Guid actorId, Guid activityId, Guid taskItemId, CancellationToken ct = default)
    {
        var actor = await _db.Users.FirstOrDefaultAsync(u => u.Id == actorId, ct);
        if (actor is null || !CanAssist(actor.Role))
            return OpResult<Unit>.Fail("Недостаточно прав.");

        if (!await _db.TaskAssistants.AnyAsync(x => x.TaskItemId == taskItemId && x.AssistantId == actorId, ct)
            && actor.Role is not (UserRole.Teacher or UserRole.Admin))
            return OpResult<Unit>.Fail("Вы не закреплены за этой задачей.");

        var activity = await _db.Activities.FirstOrDefaultAsync(a => a.Id == activityId, ct);
        if (activity is null || activity.Type != ActivityType.ControlPoint)
            return OpResult<Unit>.Fail("Неверное занятие.");

        if (!WithinWindow(activity) && actor.Role is not (UserRole.Teacher or UserRole.Admin))
            return OpResult<Unit>.Fail("Вне времени занятия.");

        await using var tx = await _db.Database.BeginTransactionAsync(ct);

        var candidates = await _db.TaskSubmissions
            .Where(s =>
                s.ActivityId == activityId
                && s.TaskItemId == taskItemId
                && s.Status == SubmissionStatus.ReadyForReview
                && s.StudentId != null)
            .OrderBy(s => s.ReadyAt)
            .Take(50)
            .ToListAsync(ct);

        TaskSubmission? next = null;
        foreach (var c in candidates)
        {
            if (!await StudentHasConcurrentReviewAsync(activityId, c.StudentId!.Value, null, ct))
            {
                next = c;
                break;
            }
        }

        if (next is null)
        {
            await tx.RollbackAsync(ct);
            return OpResult<Unit>.Fail(candidates.Count == 0
                ? "Очередь пуста."
                : "Все ожидающие уже на приёме по другим задачам; завершите приём или подождите.");
        }

        next.Status = SubmissionStatus.InReview;
        next.ReviewerId = actorId;
        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        await _notify.NotifyManyAsync(
            new[] { next.StudentId!.Value },
            "KtCalled",
            "Вас вызвали на сдачу задачи КТ",
            null,
            ct);

        return OpResult<Unit>.Ok(Unit.Value);
    }

    public async Task<OpResult<Unit>> CompleteKtReview(
        Guid actorId,
        Guid submissionId,
        bool accepted,
        int result01,
        decimal? defenderCoefficient,
        CancellationToken ct = default)
    {
        var actor = await _db.Users.FirstOrDefaultAsync(u => u.Id == actorId, ct);
        if (actor is null || !CanAssist(actor.Role))
            return OpResult<Unit>.Fail("Недостаточно прав.");

        if (result01 is not (0 or 1))
            return OpResult<Unit>.Fail("result01 должен быть 0 или 1.");

        if (defenderCoefficient is < 0.8m or > 1.2m)
            return OpResult<Unit>.Fail("Коэффициент должен быть от 0.8 до 1.2.");

        var sub = await _db.TaskSubmissions
            .Include(s => s.Activity)
            .FirstOrDefaultAsync(s => s.Id == submissionId, ct);

        if (sub is null || sub.Activity.Type != ActivityType.ControlPoint || sub.StudentId is null)
            return OpResult<Unit>.Fail("Неверная сдача КТ.");

        if (sub.Status != SubmissionStatus.InReview)
            return OpResult<Unit>.Fail("Сдача не на проверке.");

        var allowed = actor.Role is UserRole.Teacher or UserRole.Admin
            || await _db.TaskAssistants.AnyAsync(
                x => x.TaskItemId == sub.TaskItemId && x.AssistantId == actorId,
                ct);
        if (!allowed)
            return OpResult<Unit>.Fail("Нет прав завершать приём по этой задаче.");

        var isReviewer = sub.ReviewerId == actorId;
        var isElevated = actor.Role is UserRole.Teacher or UserRole.Admin;
        if (!isReviewer && !isElevated)
            return OpResult<Unit>.Fail("Только вызвавший ассистент (или преподаватель) может завершить приём.");

        sub.Status = accepted ? SubmissionStatus.Accepted : SubmissionStatus.Rejected;
        sub.Result01 = accepted ? 1 : 0;
        sub.DefenderCoefficient = defenderCoefficient;
        sub.ReviewedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);

        await _notify.NotifyManyAsync(
            new[] { sub.StudentId.Value },
            accepted ? "KtAccepted" : "KtRejected",
            accepted ? "Задача КТ принята" : "Задача КТ не принята",
            null,
            ct);

        return OpResult<Unit>.Ok(Unit.Value);
    }

    public async Task<OpResult<IReadOnlyList<MyKtSlotRow>>> GetMyQueue(Guid actorId, Guid activityId, CancellationToken ct = default)
    {
        var activity = await _db.Activities.AsNoTracking().FirstOrDefaultAsync(a => a.Id == activityId, ct);
        if (activity is null || activity.Type != ActivityType.ControlPoint)
            return OpResult<IReadOnlyList<MyKtSlotRow>>.Fail("Неверное занятие.");

        var mine = await _db.TaskSubmissions
            .Where(s => s.ActivityId == activityId && s.StudentId == actorId)
            .Select(s => new { s.TaskItemId, s.Status, s.ReadyAt, s.Id })
            .ToListAsync(ct);

        var taskIdList = mine.Select(m => m.TaskItemId).Distinct().ToList();
        var taskCodes = await _db.TaskItems
            .Where(t => taskIdList.Contains(t.Id))
            .ToDictionaryAsync(t => t.Id, t => t.Code, ct);

        var result = new List<MyKtSlotRow>();
        foreach (var m in mine)
        {
            var code = taskCodes.GetValueOrDefault(m.TaskItemId, "?");
            var pos = 0;
            if (m.Status == SubmissionStatus.ReadyForReview && m.ReadyAt is { } ra)
            {
                pos = 1 + await _db.TaskSubmissions.CountAsync(
                    s => s.ActivityId == activityId
                         && s.TaskItemId == m.TaskItemId
                         && s.Status == SubmissionStatus.ReadyForReview
                         && s.ReadyAt != null
                         && s.ReadyAt < ra,
                    ct);
            }

            result.Add(new MyKtSlotRow(m.TaskItemId, code, m.Status.ToString(), pos, m.ReadyAt));
        }

        return OpResult<IReadOnlyList<MyKtSlotRow>>.Ok(result);
    }
}
