using Microsoft.EntityFrameworkCore;
using ScoreHub.Application.Abstractions;
using ScoreHub.Application.Common;
using ScoreHub.Domain.Entities;
using ScoreHub.Domain.Enums;
using ScoreHub.Infrastructure.Persistence;

namespace ScoreHub.Infrastructure.Services;

public sealed class HomeworkService : IHomeworkService
{
    private readonly ScoreHubDbContext _db;
    private readonly INotificationService _notify;

    public HomeworkService(ScoreHubDbContext db, INotificationService notify)
    {
        _db = db;
        _notify = notify;
    }

    private static bool CanReview(UserRole r) => r is UserRole.Assistant or UserRole.Teacher or UserRole.Admin;

    public async Task<OpResult<Guid>> CreateSubmission(
        Guid actorId, Guid activityId, Guid taskItemId, string documentUrl,
        IReadOnlyList<Guid> memberUserIds, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(documentUrl))
            return OpResult<Guid>.Fail("documentUrl обязателен.");

        var distinct = memberUserIds.Distinct().ToList();
        if (distinct.Count is < 1 or > 3)
            return OpResult<Guid>.Fail("Группа должна быть от 1 до 3 студентов.");

        if (!distinct.Contains(actorId))
            return OpResult<Guid>.Fail("Вы должны быть в числе сдающих.");

        var activity = await _db.Activities.Include(a => a.Module).FirstOrDefaultAsync(a => a.Id == activityId, ct);
        if (activity is null)
            return OpResult<Guid>.Fail("Занятие не найдено.");

        var task = await _db.TaskItems.Include(t => t.TaskSet).FirstOrDefaultAsync(t => t.Id == taskItemId, ct);
        if (task is null || task.TaskSet.ActivityId != activityId)
            return OpResult<Guid>.Fail("Задача не относится к этому занятию.");

        var now = DateTimeOffset.UtcNow;
        decimal timeCoeff = ComputeTimeCoefficient(activity, now);

        var sub = new HomeworkSubmission
        {
            Id = Guid.NewGuid(),
            ActivityId = activityId,
            TaskItemId = taskItemId,
            DocumentUrl = documentUrl,
            SubmittedAt = now,
            Status = SubmissionStatus.Draft,
            TimeCoefficient = timeCoeff,
            Members = distinct.Select(uid => new HomeworkSubmissionMember
            {
                HomeworkSubmissionId = Guid.Empty, // EF will fix
                UserId = uid
            }).ToList()
        };

        _db.HomeworkSubmissions.Add(sub);
        await _db.SaveChangesAsync(ct);

        // Notify teacher/admins about new submission
        var teachers = await _db.Users
            .Where(u => u.Role == UserRole.Teacher || u.Role == UserRole.Admin)
            .Select(u => u.Id)
            .ToListAsync(ct);

        await _notify.NotifyManyAsync(teachers, "HomeworkQueueUpdated",
            $"Новая сдача ДЗ: {task.Code}", null, ct);

        return OpResult<Guid>.Ok(sub.Id);
    }

    private static decimal ComputeTimeCoefficient(Activity activity, DateTimeOffset now)
    {
        if (activity.Type == ActivityType.HomeworkSession)
            return 1.0m;

        // Task from a Lecture: penalty based on days since lecture ended
        var daysSince = (now - activity.EndsAt).TotalDays;
        return daysSince switch
        {
            <= 7 => 0.75m,
            _ => 0.5m
        };
    }

    public async Task<OpResult<IReadOnlyList<HwQueueRow>>> GetQueue(
        Guid actorId, Guid activityId, CancellationToken ct = default)
    {
        var actor = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == actorId, ct);
        if (actor is null || !CanReview(actor.Role))
            return OpResult<IReadOnlyList<HwQueueRow>>.Fail("Недостаточно прав.");

        var activity = await _db.Activities.AsNoTracking()
            .Include(a => a.Module)
            .FirstOrDefaultAsync(a => a.Id == activityId, ct);
        if (activity is null)
            return OpResult<IReadOnlyList<HwQueueRow>>.Fail("Занятие не найдено.");

        // Find KT activityId for this module to determine "last lecture" reference
        var moduleId = activity.ModuleId;
        var lastLectureEndsAt = await _db.Activities
            .Where(a => a.ModuleId == moduleId && a.Type == ActivityType.Lecture)
            .OrderByDescending(a => a.EndsAt)
            .Select(a => (DateTimeOffset?)a.EndsAt)
            .FirstOrDefaultAsync(ct);

        var subs = await _db.HomeworkSubmissions
            .Include(s => s.Members)
            .Include(s => s.TaskItem)
            .Where(s => s.ActivityId == activityId
                && (s.Status == SubmissionStatus.Draft
                    || s.Status == SubmissionStatus.ReadyForReview
                    || s.Status == SubmissionStatus.InReview))
            .ToListAsync(ct);

        var rows = subs.Select(s =>
        {
            int priority = ComputePriority(s, lastLectureEndsAt);
            return new HwQueueRow(
                s.Id,
                s.TaskItemId,
                s.TaskItem.Code,
                s.TaskItem.Title,
                s.Members.Select(m => m.UserId).ToList(),
                s.SubmittedAt,
                s.Status.ToString(),
                s.TimeCoefficient,
                priority,
                s.DocumentUrl);
        })
        .OrderBy(r => r.Priority)
        .ThenBy(r => r.SubmittedAt)
        .ToList();

        return OpResult<IReadOnlyList<HwQueueRow>>.Ok(rows);
    }

    private static int ComputePriority(HomeworkSubmission s, DateTimeOffset? lastLectureEndsAt)
    {
        // Priority 1: re-submission from the latest lecture (TimeCoeff 0.75 means within 7 days)
        if (s.TimeCoefficient == 0.75m) return 1;
        // Priority 2: homework session task (TimeCoeff 1.0)
        if (s.TimeCoefficient == 1.0m) return 2;
        // Priority 3: older re-submissions
        return 3;
    }

    public async Task<OpResult<Unit>> StartReview(Guid actorId, Guid submissionId, CancellationToken ct = default)
    {
        var actor = await _db.Users.FirstOrDefaultAsync(u => u.Id == actorId, ct);
        if (actor is null || !CanReview(actor.Role))
            return OpResult<Unit>.Fail("Недостаточно прав.");

        var sub = await _db.HomeworkSubmissions
            .Include(s => s.Members)
            .FirstOrDefaultAsync(s => s.Id == submissionId, ct);
        if (sub is null) return OpResult<Unit>.Fail("Сдача не найдена.");

        if (sub.Status == SubmissionStatus.InReview)
            return OpResult<Unit>.Fail("Уже на проверке.");
        if (sub.Status == SubmissionStatus.Accepted)
            return OpResult<Unit>.Fail("Уже принято.");

        sub.Status = SubmissionStatus.InReview;
        sub.ReviewerId = actorId;
        sub.ReviewStartedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        var memberIds = sub.Members.Select(m => m.UserId).ToList();
        await _notify.NotifyManyAsync(memberIds, "ReviewStarted", "Ассистент начал приём ДЗ", null, ct);

        return OpResult<Unit>.Ok(Unit.Value);
    }

    public async Task<OpResult<Unit>> CompleteReview(
        Guid actorId, Guid submissionId, bool accepted, CancellationToken ct = default)
    {
        var actor = await _db.Users.FirstOrDefaultAsync(u => u.Id == actorId, ct);
        if (actor is null || !CanReview(actor.Role))
            return OpResult<Unit>.Fail("Недостаточно прав.");

        var sub = await _db.HomeworkSubmissions
            .Include(s => s.Members)
            .FirstOrDefaultAsync(s => s.Id == submissionId, ct);
        if (sub is null) return OpResult<Unit>.Fail("Сдача не найдена.");
        if (sub.Status != SubmissionStatus.InReview) return OpResult<Unit>.Fail("Не на проверке.");

        sub.Status = accepted ? SubmissionStatus.Accepted : SubmissionStatus.Rejected;
        sub.Result01 = accepted ? 1 : 0;
        sub.ReviewedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        var memberIds = sub.Members.Select(m => m.UserId).ToList();
        await _notify.NotifyManyAsync(
            memberIds,
            accepted ? "TaskAccepted" : "TaskRejected",
            accepted ? "ДЗ принято" : "ДЗ не принято, пересдача",
            null, ct);

        return OpResult<Unit>.Ok(Unit.Value);
    }

    public async Task<OpResult<Unit>> BackToQueue(Guid actorId, Guid submissionId, CancellationToken ct = default)
    {
        var actor = await _db.Users.FirstOrDefaultAsync(u => u.Id == actorId, ct);
        if (actor is null || !CanReview(actor.Role))
            return OpResult<Unit>.Fail("Недостаточно прав.");

        var sub = await _db.HomeworkSubmissions
            .Include(s => s.Members)
            .FirstOrDefaultAsync(s => s.Id == submissionId, ct);
        if (sub is null) return OpResult<Unit>.Fail("Сдача не найдена.");
        if (sub.Status != SubmissionStatus.InReview) return OpResult<Unit>.Fail("Не на проверке.");

        // Reset and re-queue with new SubmittedAt so they go to the end
        sub.Status = SubmissionStatus.Draft;
        sub.ReviewerId = null;
        sub.ReviewStartedAt = null;
        sub.SubmittedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        var memberIds = sub.Members.Select(m => m.UserId).ToList();
        await _notify.NotifyManyAsync(memberIds, "TaskRejected", "Не успели — перемещены в конец очереди", null, ct);

        return OpResult<Unit>.Ok(Unit.Value);
    }
}
