using Microsoft.EntityFrameworkCore;
using ScoreHub.Application.Abstractions;
using ScoreHub.Application.Common;
using ScoreHub.Domain.Entities;
using ScoreHub.Domain.Enums;
using ScoreHub.Infrastructure.Persistence;

namespace ScoreHub.Infrastructure.Services;

public sealed class TeachingSetupService : ITeachingSetupService
{
    private readonly ScoreHubDbContext _db;

    public TeachingSetupService(ScoreHubDbContext db)
    {
        _db = db;
    }

    private async Task<User?> ActorAsync(Guid actorId, CancellationToken ct) =>
        await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == actorId, ct);

    private static bool CanTeach(UserRole role) => role is UserRole.Teacher or UserRole.Admin;

    public async Task<OpResult<Guid>> CreateCourse(Guid actorId, string code, string title, string academicYear, CancellationToken ct = default)
    {
        var actor = await ActorAsync(actorId, ct);
        if (actor is null || !CanTeach(actor.Role))
            return OpResult<Guid>.Fail("Недостаточно прав.");

        var c = new Course
        {
            Id = Guid.NewGuid(),
            Code = code.Trim(),
            Title = title.Trim(),
            AcademicYear = academicYear.Trim(),
            CreatedAt = DateTimeOffset.UtcNow
        };
        _db.Courses.Add(c);
        await _db.SaveChangesAsync(ct);
        return OpResult<Guid>.Ok(c.Id);
    }

    public async Task<OpResult<Guid>> AddModule(
        Guid actorId,
        Guid courseId,
        int number,
        string title,
        DateTimeOffset startsAt,
        DateTimeOffset endsAt,
        CancellationToken ct = default)
    {
        var actor = await ActorAsync(actorId, ct);
        if (actor is null || !CanTeach(actor.Role))
            return OpResult<Guid>.Fail("Недостаточно прав.");

        if (!await _db.Courses.AnyAsync(c => c.Id == courseId, ct))
            return OpResult<Guid>.Fail("Курс не найден.");

        var m = new Module
        {
            Id = Guid.NewGuid(),
            CourseId = courseId,
            Number = number,
            Title = title.Trim(),
            StartsAt = startsAt,
            EndsAt = endsAt
        };
        _db.Modules.Add(m);
        await _db.SaveChangesAsync(ct);
        return OpResult<Guid>.Ok(m.Id);
    }

    public async Task<OpResult<Guid>> AddActivity(
        Guid actorId,
        Guid moduleId,
        ActivityType type,
        string title,
        DateTimeOffset startsAt,
        DateTimeOffset endsAt,
        CancellationToken ct = default)
    {
        var actor = await ActorAsync(actorId, ct);
        if (actor is null || !CanTeach(actor.Role))
            return OpResult<Guid>.Fail("Недостаточно прав.");

        if (!await _db.Modules.AnyAsync(x => x.Id == moduleId, ct))
            return OpResult<Guid>.Fail("Модуль не найден.");

        var a = new Activity
        {
            Id = Guid.NewGuid(),
            ModuleId = moduleId,
            Type = type,
            Title = title.Trim(),
            StartsAt = startsAt,
            EndsAt = endsAt
        };
        _db.Activities.Add(a);
        await _db.SaveChangesAsync(ct);
        return OpResult<Guid>.Ok(a.Id);
    }

    public async Task<OpResult<Guid>> AddTaskSet(Guid actorId, Guid activityId, string title, CancellationToken ct = default)
    {
        var actor = await ActorAsync(actorId, ct);
        if (actor is null || !CanTeach(actor.Role))
            return OpResult<Guid>.Fail("Недостаточно прав.");

        if (!await _db.Activities.AnyAsync(x => x.Id == activityId, ct))
            return OpResult<Guid>.Fail("Занятие не найдено.");

        var ts = new TaskSet { Id = Guid.NewGuid(), ActivityId = activityId, Title = title.Trim() };
        _db.TaskSets.Add(ts);
        await _db.SaveChangesAsync(ct);
        return OpResult<Guid>.Ok(ts.Id);
    }

    public async Task<OpResult<Guid>> AddTaskItem(
        Guid actorId,
        Guid taskSetId,
        string code,
        string title,
        string? statement,
        decimal points,
        CancellationToken ct = default)
    {
        var actor = await ActorAsync(actorId, ct);
        if (actor is null || !CanTeach(actor.Role))
            return OpResult<Guid>.Fail("Недостаточно прав.");

        if (!await _db.TaskSets.AnyAsync(x => x.Id == taskSetId, ct))
            return OpResult<Guid>.Fail("Набор задач не найден.");

        var t = new TaskItem
        {
            Id = Guid.NewGuid(),
            TaskSetId = taskSetId,
            Code = code.Trim(),
            Title = title.Trim(),
            Statement = statement,
            Points = points
        };
        _db.TaskItems.Add(t);
        await _db.SaveChangesAsync(ct);
        return OpResult<Guid>.Ok(t.Id);
    }

    public async Task<OpResult<Unit>> SetTaskAssistants(
        Guid actorId,
        Guid taskItemId,
        IReadOnlyList<Guid> assistantUserIds,
        CancellationToken ct = default)
    {
        var actor = await ActorAsync(actorId, ct);
        if (actor is null || !CanTeach(actor.Role))
            return OpResult<Unit>.Fail("Недостаточно прав.");

        var task = await _db.TaskItems.FirstOrDefaultAsync(x => x.Id == taskItemId, ct);
        if (task is null)
            return OpResult<Unit>.Fail("Задача не найдена.");

        var rows = await _db.TaskAssistants.Where(x => x.TaskItemId == taskItemId).ToListAsync(ct);
        _db.TaskAssistants.RemoveRange(rows);

        foreach (var aid in assistantUserIds.Distinct())
        {
            if (!await _db.Users.AnyAsync(u => u.Id == aid, ct))
                return OpResult<Unit>.Fail($"Пользователь {aid} не найден.");
            _db.TaskAssistants.Add(new TaskAssistant { TaskItemId = taskItemId, AssistantId = aid });
        }

        await _db.SaveChangesAsync(ct);
        return OpResult<Unit>.Ok(Unit.Value);
    }

    public async Task<OpResult<Guid>> CreateTeam(Guid actorId, Guid activityId, string name, CancellationToken ct = default)
    {
        var actor = await ActorAsync(actorId, ct);
        if (actor is null || !CanTeach(actor.Role))
            return OpResult<Guid>.Fail("Недостаточно прав.");

        if (!await _db.Activities.AnyAsync(x => x.Id == activityId, ct))
            return OpResult<Guid>.Fail("Занятие не найдено.");

        var team = new Team { Id = Guid.NewGuid(), ActivityId = activityId, Name = name.Trim() };
        _db.Teams.Add(team);
        await _db.SaveChangesAsync(ct);
        return OpResult<Guid>.Ok(team.Id);
    }

    public async Task<OpResult<Unit>> SetTeamMembers(Guid actorId, Guid teamId, IReadOnlyList<Guid> memberUserIds, CancellationToken ct = default)
    {
        var actor = await ActorAsync(actorId, ct);
        if (actor is null || !CanTeach(actor.Role))
            return OpResult<Unit>.Fail("Недостаточно прав.");

        var team = await _db.Teams.FirstOrDefaultAsync(t => t.Id == teamId, ct);
        if (team is null)
            return OpResult<Unit>.Fail("Команда не найдена.");

        foreach (var uid in memberUserIds.Distinct())
        {
            if (!await _db.Users.AnyAsync(u => u.Id == uid, ct))
                return OpResult<Unit>.Fail($"Пользователь {uid} не найден.");
        }

        var existing = await _db.TeamMembers.Where(x => x.TeamId == teamId).ToListAsync(ct);
        _db.TeamMembers.RemoveRange(existing);

        foreach (var uid in memberUserIds.Distinct())
        {
            _db.TeamMembers.Add(new TeamMember
            {
                TeamId = teamId,
                UserId = uid,
                JoinedAt = DateTimeOffset.UtcNow,
                IsAbsent = false
            });
        }

        await _db.SaveChangesAsync(ct);
        return OpResult<Unit>.Ok(Unit.Value);
    }

    public async Task<OpResult<Unit>> SetTeamAssistants(Guid actorId, Guid teamId, IReadOnlyList<Guid> assistantUserIds, CancellationToken ct = default)
    {
        var actor = await ActorAsync(actorId, ct);
        if (actor is null || !CanTeach(actor.Role))
            return OpResult<Unit>.Fail("Недостаточно прав.");

        if (!await _db.Teams.AnyAsync(t => t.Id == teamId, ct))
            return OpResult<Unit>.Fail("Команда не найдена.");

        foreach (var aid in assistantUserIds.Distinct())
        {
            if (!await _db.Users.AnyAsync(u => u.Id == aid, ct))
                return OpResult<Unit>.Fail($"Пользователь {aid} не найден.");
        }

        var rows = await _db.TeamAssistants.Where(x => x.TeamId == teamId).ToListAsync(ct);
        _db.TeamAssistants.RemoveRange(rows);

        foreach (var aid in assistantUserIds.Distinct())
            _db.TeamAssistants.Add(new TeamAssistant { TeamId = teamId, AssistantId = aid });

        await _db.SaveChangesAsync(ct);
        return OpResult<Unit>.Ok(Unit.Value);
    }
}
