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

    // Занятие «открыто» для командных действий, когда преподаватель его запустил (Status = Active).
    // Привязываться к расписанию (StartsAt/EndsAt) нельзя: преподаватель стартует пару вручную,
    // и реальное время может не совпадать с плановым окном.
    private static bool IsLive(Activity a) => a.Status == ActivityStatus.Active;

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

        if (!IsLive(team.Activity))
            return OpResult<Guid>.Fail("Занятие не запущено преподавателем.");

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

    public async Task<OpResult<Unit>> MarkTeamTaskReadyByNumber(Guid actorId, Guid teamId, int taskNumber, CancellationToken ct = default)
    {
        var team = await _db.Teams
            .Include(t => t.Activity)
            .FirstOrDefaultAsync(t => t.Id == teamId, ct);
        if (team is null)
            return OpResult<Unit>.Fail("Команда не найдена.");

        var activity = team.Activity;
        if (activity.TaskCount <= 0)
            return OpResult<Unit>.Fail("Для занятия не задано количество задач.");
        if (taskNumber < 1 || taskNumber > activity.TaskCount)
            return OpResult<Unit>.Fail($"Номер задачи должен быть от 1 до {activity.TaskCount}.");

        // Гарантируем, что для занятия есть служебный набор задач с элементом нужного номера
        // (условия — во внешнем файле, нам нужен лишь Code = номер, чтобы связать сдачу/приём).
        var taskItem = await EnsureNumberedTaskItemAsync(activity.Id, taskNumber, ct);

        return await MarkTeamTaskReady(actorId, teamId, taskItem.Id, ct);
    }

    /// <summary>Находит/создаёт TaskItem с Code = номер в служебном наборе занятия.</summary>
    private async Task<TaskItem> EnsureNumberedTaskItemAsync(Guid activityId, int number, CancellationToken ct)
    {
        var code = number.ToString();

        var existing = await _db.TaskItems
            .FirstOrDefaultAsync(t => t.TaskSet.ActivityId == activityId && t.Code == code, ct);
        if (existing is not null) return existing;

        var taskSet = await _db.TaskSets
            .FirstOrDefaultAsync(ts => ts.ActivityId == activityId && ts.Title == "Задачи", ct);
        if (taskSet is null)
        {
            taskSet = new TaskSet
            {
                Id = Guid.NewGuid(),
                ActivityId = activityId,
                Title = "Задачи",
                Published = true
            };
            _db.TaskSets.Add(taskSet);
        }

        var item = new TaskItem
        {
            Id = Guid.NewGuid(),
            TaskSetId = taskSet.Id,
            TaskSet = taskSet,
            Code = code,
            Title = $"Задача {number}",
            Points = 1m
        };
        _db.TaskItems.Add(item);
        await _db.SaveChangesAsync(ct);
        return item;
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

        if (!IsLive(team.Activity))
            return OpResult<Unit>.Fail("Занятие не запущено преподавателем.");

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
                ReadyAt = DateTimeOffset.UtcNow,
                // Тот, кто отметил задачу готовой, и будет её защищать.
                DefenderUserId = actorId
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
            sub.DefenderUserId = actorId;
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

        // Сортируем в памяти — SQLite не поддерживает ORDER BY DateTimeOffset
        var list = (await query
            .Select(h => new HelpRequestRow(h.Id, h.TeamId, h.Team.Name, h.CreatedByUserId, h.CreatedAt, h.Message))
            .ToListAsync(ct))
            .OrderBy(h => h.CreatedAt)
            .ToList();

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

        // Сортируем в памяти — SQLite не поддерживает ORDER BY DateTimeOffset
        var rows = (await _db.TaskSubmissions
            .Include(s => s.Team)
            .Include(s => s.TaskItem)
            .Where(s =>
                s.ActivityId == activityId
                && s.TeamId != null
                && myTeams.Contains(s.TeamId!.Value)
                && (s.Status == SubmissionStatus.ReadyForReview || s.Status == SubmissionStatus.InReview))
            .Select(s => new TeamSubmissionRow(
                s.Id,
                s.TeamId!.Value,
                s.Team!.Name,
                s.TaskItemId,
                s.TaskItem.Code,
                MapStatus(s.Status),
                s.ReadyAt,
                s.ReviewerId,
                s.DefenderUserId,
                s.DefenderUserId == null ? null
                    : _db.Users.Where(u => u.Id == s.DefenderUserId).Select(u => u.DisplayName).FirstOrDefault()))
            .ToListAsync(ct))
            .OrderBy(r => r.ReadyAt)
            .ToList();

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

        if (!IsLive(sub.Activity))
            return OpResult<Unit>.Fail("Занятие не запущено преподавателем.");

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

        // Коэффициент защитника: от 1.0 до 1.2 (начисляется только тому, кто сдавал).
        if (defenderCoefficient is < 1.0m or > 1.2m)
            return OpResult<Unit>.Fail("Коэффициент защитника должен быть от 1.0 до 1.2.");

        var sub = await _db.TaskSubmissions
            .Include(s => s.Team!)
            .ThenInclude(t => t!.Members)
            .Include(s => s.Activity)
            .FirstOrDefaultAsync(s => s.Id == submissionId, ct);

        if (sub?.TeamId is null)
            return OpResult<Unit>.Fail("Это не командная сдача.");

        // Принимаем/отклоняем напрямую из «Ожидает» (или «На приёме»).
        if (sub.Status is not (SubmissionStatus.ReadyForReview or SubmissionStatus.InReview))
            return OpResult<Unit>.Fail("Сдача не ожидает приёма.");

        var isElevated = actor.Role is UserRole.Teacher or UserRole.Admin;
        var isAssigned = await _db.TeamAssistants.AnyAsync(x => x.TeamId == sub.TeamId && x.AssistantId == actorId, ct);
        if (!isElevated && !isAssigned && sub.ReviewerId != actorId)
            return OpResult<Unit>.Fail("Вы не закреплены за этой командой.");

        if (!IsLive(sub.Activity) && !isElevated)
            return OpResult<Unit>.Fail("Занятие не запущено преподавателем.");

        sub.Status = accepted ? SubmissionStatus.Accepted : SubmissionStatus.Rejected;
        sub.Result01 = accepted ? 1 : 0;
        sub.ReviewerId = actorId;
        // Коэффициент сохраняем только при принятии задачи.
        sub.DefenderCoefficient = accepted ? defenderCoefficient : null;
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

    public async Task<OpResult<IReadOnlyList<TeamAttendanceRow>>> ListAttendance(Guid actorId, Guid activityId, CancellationToken ct = default)
    {
        var actor = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == actorId, ct);
        if (actor is null || !CanAssist(actor.Role))
            return OpResult<IReadOnlyList<TeamAttendanceRow>>.Fail("Недостаточно прав.");

        var teamsQuery = _db.Teams.AsNoTracking().Where(t => t.ActivityId == activityId);
        if (actor.Role is not (UserRole.Teacher or UserRole.Admin))
            teamsQuery = teamsQuery.Where(t => _db.TeamAssistants.Any(a => a.TeamId == t.Id && a.AssistantId == actorId));

        var rows = await teamsQuery
            .Select(t => new TeamAttendanceRow(
                t.Id,
                t.Name,
                t.Members.Select(m => new TeamAttendanceMember(
                    m.UserId,
                    _db.Users.Where(u => u.Id == m.UserId).Select(u => u.DisplayName).FirstOrDefault() ?? "?",
                    m.IsAbsent)).ToList()))
            .ToListAsync(ct);

        return OpResult<IReadOnlyList<TeamAttendanceRow>>.Ok(rows);
    }

    public async Task<OpResult<Unit>> SetAttendance(Guid actorId, Guid teamId, Guid memberUserId, bool isAbsent, CancellationToken ct = default)
    {
        var actor = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == actorId, ct);
        if (actor is null || !CanAssist(actor.Role))
            return OpResult<Unit>.Fail("Недостаточно прав.");

        var team = await _db.Teams.Include(t => t.Activity).FirstOrDefaultAsync(t => t.Id == teamId, ct);
        if (team is null) return OpResult<Unit>.Fail("Команда не найдена.");

        if (team.Activity.Status == ActivityStatus.Finished)
            return OpResult<Unit>.Fail("Занятие завершено — отметки изменить нельзя.");

        var isElevated = actor.Role is UserRole.Teacher or UserRole.Admin;
        var isAssigned = await _db.TeamAssistants.AnyAsync(x => x.TeamId == teamId && x.AssistantId == actorId, ct);
        if (!isElevated && !isAssigned)
            return OpResult<Unit>.Fail("Вы не закреплены за этой командой.");

        var member = await _db.TeamMembers.FirstOrDefaultAsync(m => m.TeamId == teamId && m.UserId == memberUserId, ct);
        if (member is null) return OpResult<Unit>.Fail("Участник не найден в команде.");

        member.IsAbsent = isAbsent;
        await _db.SaveChangesAsync(ct);
        return OpResult<Unit>.Ok(Unit.Value);
    }
}
