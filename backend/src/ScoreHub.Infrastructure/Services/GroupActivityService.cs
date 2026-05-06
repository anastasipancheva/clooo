using Microsoft.EntityFrameworkCore;
using ScoreHub.Application.Abstractions;
using ScoreHub.Application.Common;
using ScoreHub.Domain.Entities;
using ScoreHub.Domain.Enums;
using ScoreHub.Infrastructure.Persistence;

namespace ScoreHub.Infrastructure.Services;

public sealed class GroupActivityService : IGroupActivityService
{
    private readonly ScoreHubDbContext _db;
    private readonly INotificationService _notify;

    public GroupActivityService(ScoreHubDbContext db, INotificationService notify)
    {
        _db = db;
        _notify = notify;
    }

    private static bool IsGroupActivity(ActivityType t) => t is ActivityType.Lecture or ActivityType.HomeworkSession;

    private static bool WithinWindow(Activity a) =>
        DateTimeOffset.UtcNow >= a.StartsAt && DateTimeOffset.UtcNow <= a.EndsAt;

    private static bool CanAssist(UserRole r) => r is UserRole.Assistant or UserRole.Teacher or UserRole.Admin;

    private static SubmissionStatusDto MapStatus(SubmissionStatus s) => (SubmissionStatusDto)(int)s;

    public async Task<OpResult<Guid>> RequestAssistantHelp(Guid actorId, Guid teamId, string? message, CancellationToken ct = default)
    {
        var team = await _db.Teams
            .Include(t => t.Members)
            .Include(t => t.Assistants)
            .Include(t => t.Activity)
            .FirstOrDefaultAsync(t => t.Id == teamId, ct);

        if (team is null)
            return OpResult<Guid>.Fail("Команда не найдена.");

        if (!IsGroupActivity(team.Activity.Type))
            return OpResult<Guid>.Fail("Это занятие не для командной работы.");

        if (!WithinWindow(team.Activity))
            return OpResult<Guid>.Fail("Вне времени занятия.");

        if (team.Members.All(m => m.UserId != actorId))
            return OpResult<Guid>.Fail("Вы не в этой команде.");

        var hr = new TeamHelpRequest
        {
            Id = Guid.NewGuid(),
            TeamId = teamId,
            CreatedByUserId = actorId,
            CreatedAt = DateTimeOffset.UtcNow,
            Status = TeamHelpRequestStatus.Open,
            Message = message
        };
        _db.TeamHelpRequests.Add(hr);
        await _db.SaveChangesAsync(ct);

        var recipients = team.Members.Select(m => m.UserId)
            .Concat(team.Assistants.Select(a => a.AssistantId))
            .Distinct()
            .ToList();

        await _notify.NotifyManyAsync(
            recipients,
            "TeamHelpRequested",
            $"Команда «{team.Name}» вызвала ассистента",
            message,
            ct);

        return OpResult<Guid>.Ok(hr.Id);
    }

    public async Task<OpResult<Unit>> MarkTeamTaskReady(Guid actorId, Guid teamId, Guid taskItemId, CancellationToken ct = default)
    {
        var team = await _db.Teams
            .Include(t => t.Members)
            .Include(t => t.Activity)
            .FirstOrDefaultAsync(t => t.Id == teamId, ct);

        if (team is null)
            return OpResult<Unit>.Fail("Команда не найдена.");

        if (!IsGroupActivity(team.Activity.Type))
            return OpResult<Unit>.Fail("Неверный тип занятия.");

        if (!WithinWindow(team.Activity))
            return OpResult<Unit>.Fail("Вне времени занятия.");

        if (team.Members.All(m => m.UserId != actorId))
            return OpResult<Unit>.Fail("Вы не в этой команде.");

        var task = await _db.TaskItems.Include(x => x.TaskSet).FirstOrDefaultAsync(x => x.Id == taskItemId, ct);
        if (task is null || task.TaskSet.ActivityId != team.ActivityId)
            return OpResult<Unit>.Fail("Задача не относится к этому занятию.");

        var sub = await _db.TaskSubmissions.FirstOrDefaultAsync(
            s => s.ActivityId == team.ActivityId && s.TaskItemId == taskItemId && s.TeamId == teamId,
            ct);

        if (sub is { Status: SubmissionStatus.Accepted })
            return OpResult<Unit>.Fail("Задача уже принята.");

        if (sub is null)
        {
            sub = new TaskSubmission
            {
                Id = Guid.NewGuid(),
                ActivityId = team.ActivityId,
                TaskItemId = taskItemId,
                TeamId = teamId,
                CreatedAt = DateTimeOffset.UtcNow,
                Status = SubmissionStatus.ReadyForReview,
                ReadyAt = DateTimeOffset.UtcNow
            };
            _db.TaskSubmissions.Add(sub);
        }
        else
        {
            if (sub.Status == SubmissionStatus.InReview)
                return OpResult<Unit>.Fail("Задача уже на проверке.");

            sub.Status = SubmissionStatus.ReadyForReview;
            sub.ReadyAt = DateTimeOffset.UtcNow;
            sub.ReviewerId = null;
            sub.DefenderUserId = null;
            sub.ReviewedAt = null;
            sub.Result01 = null;
            sub.DefenderCoefficient = null;
        }

        await _db.SaveChangesAsync(ct);

        var assistantIds = await _db.TeamAssistants
            .Where(x => x.TeamId == teamId)
            .Select(x => x.AssistantId)
            .ToListAsync(ct);

        var memberIds = team.Members.Select(m => m.UserId).ToList();
        await _notify.NotifyManyAsync(
            assistantIds.Concat(memberIds).Distinct().ToList(),
            "TeamReadyToDefend",
            $"Команда «{team.Name}» готова сдать {task.Code}",
            null,
            ct);

        return OpResult<Unit>.Ok(Unit.Value);
    }

    public async Task<OpResult<IReadOnlyList<HelpRequestRow>>> ListOpenHelpRequests(Guid actorId, Guid activityId, CancellationToken ct = default)
    {
        var actor = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == actorId, ct);
        if (actor is null || !CanAssist(actor.Role))
            return OpResult<IReadOnlyList<HelpRequestRow>>.Fail("Недостаточно прав.");

        var query = _db.TeamHelpRequests
            .Where(h => h.Status == TeamHelpRequestStatus.Open)
            .Where(h => h.Team.ActivityId == activityId);

        if (actor.Role is not (UserRole.Teacher or UserRole.Admin))
        {
            var myTeamIds = await _db.Teams
                .Where(t => t.ActivityId == activityId)
                .Where(t => _db.TeamAssistants.Any(a => a.TeamId == t.Id && a.AssistantId == actorId))
                .Select(t => t.Id)
                .ToListAsync(ct);
            query = query.Where(h => myTeamIds.Contains(h.TeamId));
        }

        var list = await query
            .OrderBy(h => h.CreatedAt)
            .Select(h => new HelpRequestRow(h.Id, h.TeamId, h.Team.Name, h.CreatedByUserId, h.CreatedAt, h.Message))
            .ToListAsync(ct);

        return OpResult<IReadOnlyList<HelpRequestRow>>.Ok(list);
    }

    public async Task<OpResult<Unit>> ResolveHelpRequest(Guid actorId, Guid helpRequestId, CancellationToken ct = default)
    {
        var actor = await _db.Users.FirstOrDefaultAsync(u => u.Id == actorId, ct);
        if (actor is null || !CanAssist(actor.Role))
            return OpResult<Unit>.Fail("Недостаточно прав.");

        var hr = await _db.TeamHelpRequests.Include(h => h.Team).FirstOrDefaultAsync(h => h.Id == helpRequestId, ct);
        if (hr is null)
            return OpResult<Unit>.Fail("Запрос не найден.");

        var allowed = await _db.TeamAssistants.AnyAsync(
            x => x.TeamId == hr.TeamId && x.AssistantId == actorId,
            ct);
        if (!allowed && actor.Role is not (UserRole.Teacher or UserRole.Admin))
            return OpResult<Unit>.Fail("Вы не закреплены за этой командой.");

        hr.Status = TeamHelpRequestStatus.Resolved;
        await _db.SaveChangesAsync(ct);
        return OpResult<Unit>.Ok(Unit.Value);
    }

    public async Task<OpResult<IReadOnlyList<TeamSubmissionRow>>> ListPendingTeamSubmissions(Guid actorId, Guid activityId, CancellationToken ct = default)
    {
        var actor = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == actorId, ct);
        if (actor is null || !CanAssist(actor.Role))
            return OpResult<IReadOnlyList<TeamSubmissionRow>>.Fail("Недостаточно прав.");

        List<Guid> myTeams;
        if (actor.Role is UserRole.Teacher or UserRole.Admin)
        {
            myTeams = await _db.Teams.Where(t => t.ActivityId == activityId).Select(t => t.Id).ToListAsync(ct);
        }
        else
        {
            myTeams = await _db.Teams
                .Where(t => t.ActivityId == activityId)
                .Where(t => _db.TeamAssistants.Any(a => a.TeamId == t.Id && a.AssistantId == actorId))
                .Select(t => t.Id)
                .ToListAsync(ct);
        }

        var rows = await _db.TaskSubmissions
            .Include(s => s.Team)
            .Include(s => s.TaskItem)
            .Where(s =>
                s.ActivityId == activityId
                && s.TeamId != null
                && myTeams.Contains(s.TeamId!.Value)
                && (s.Status == SubmissionStatus.ReadyForReview || s.Status == SubmissionStatus.InReview))
            .OrderBy(s => s.ReadyAt)
            .Select(s => new TeamSubmissionRow(
                s.Id,
                s.TeamId!.Value,
                s.Team!.Name,
                s.TaskItemId,
                s.TaskItem.Code,
                MapStatus(s.Status),
                s.ReadyAt,
                s.ReviewerId,
                s.DefenderUserId))
            .ToListAsync(ct);

        return OpResult<IReadOnlyList<TeamSubmissionRow>>.Ok(rows);
    }

    public async Task<OpResult<Unit>> StartTeamReview(Guid actorId, Guid submissionId, Guid defenderUserId, CancellationToken ct = default)
    {
        var actor = await _db.Users.FirstOrDefaultAsync(u => u.Id == actorId, ct);
        if (actor is null || !CanAssist(actor.Role))
            return OpResult<Unit>.Fail("Недостаточно прав.");

        var sub = await _db.TaskSubmissions
            .Include(s => s.Team!)
            .ThenInclude(t => t!.Members)
            .Include(s => s.Activity)
            .FirstOrDefaultAsync(s => s.Id == submissionId, ct);

        if (sub?.TeamId is null)
            return OpResult<Unit>.Fail("Это не командная сдача.");

        if (!IsGroupActivity(sub.Activity.Type))
            return OpResult<Unit>.Fail("Неверный тип занятия.");

        if (!WithinWindow(sub.Activity))
            return OpResult<Unit>.Fail("Вне времени занятия.");

        if (sub.Status != SubmissionStatus.ReadyForReview)
            return OpResult<Unit>.Fail("Сдача не в статусе ожидания.");

        var canReview = actor.Role is UserRole.Teacher or UserRole.Admin
            || await _db.TeamAssistants.AnyAsync(
                x => x.TeamId == sub.TeamId && x.AssistantId == actorId,
                ct);
        if (!canReview)
            return OpResult<Unit>.Fail("Нет прав вести приём у этой команды.");

        if (sub.Team!.Members.All(m => m.UserId != defenderUserId))
            return OpResult<Unit>.Fail("Защитник должен быть из состава команды.");

        sub.Status = SubmissionStatus.InReview;
        sub.ReviewerId = actorId;
        sub.DefenderUserId = defenderUserId;
        await _db.SaveChangesAsync(ct);

        var memberIds = sub.Team.Members.Select(m => m.UserId).ToList();
        await _notify.NotifyManyAsync(
            memberIds,
            "ReviewStarted",
            "Ассистент начал приём задачи",
            null,
            ct);

        return OpResult<Unit>.Ok(Unit.Value);
    }

    public async Task<OpResult<Unit>> CompleteTeamReview(
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
            return OpResult<Unit>.Fail("Коэффициент защитника должен быть от 0.8 до 1.2.");

        var sub = await _db.TaskSubmissions
            .Include(s => s.Team!)
            .ThenInclude(t => t!.Members)
            .Include(s => s.Activity)
            .FirstOrDefaultAsync(s => s.Id == submissionId, ct);

        if (sub?.TeamId is null)
            return OpResult<Unit>.Fail("Это не командная сдача.");

        if (sub.Status != SubmissionStatus.InReview)
            return OpResult<Unit>.Fail("Сдача не на проверке.");

        var isReviewer = sub.ReviewerId == actorId;
        var isElevated = actor.Role is UserRole.Teacher or UserRole.Admin;
        if (!isReviewer && !isElevated)
            return OpResult<Unit>.Fail("Только принявший может завершить проверку.");

        if (!WithinWindow(sub.Activity) && !isElevated)
            return OpResult<Unit>.Fail("Вне времени занятия.");

        sub.Status = accepted ? SubmissionStatus.Accepted : SubmissionStatus.Rejected;
        sub.Result01 = accepted ? 1 : 0;
        sub.DefenderCoefficient = defenderCoefficient;
        sub.ReviewedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);

        var memberIds = sub.Team!.Members.Select(m => m.UserId).ToList();
        await _notify.NotifyManyAsync(
            memberIds,
            accepted ? "TaskAccepted" : "TaskRejected",
            accepted ? "Задача принята" : "Задача не принята, дорешивать",
            null,
            ct);

        return OpResult<Unit>.Ok(Unit.Value);
    }
}
