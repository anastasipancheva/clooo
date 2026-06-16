using Microsoft.EntityFrameworkCore;
using ScoreHub.Application.Abstractions;
using ScoreHub.Application.Common;
using ScoreHub.Domain.Entities;
using ScoreHub.Domain.Enums;
using ScoreHub.Infrastructure.Persistence;

namespace ScoreHub.Infrastructure.Services;

public sealed class TeamGenerationService : ITeamGenerationService
{
    private readonly ScoreHubDbContext _db;

    public TeamGenerationService(ScoreHubDbContext db) => _db = db;

    private static bool CanManage(UserRole r) => r is UserRole.Teacher or UserRole.Admin;

    public async Task<OpResult<Unit>> AutoGenerate(
        Guid actorId, Guid activityId, int teamSize, TeamGenerationStrategy strategy, bool excludeAbsent,
        CancellationToken ct = default)
    {
        var actor = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == actorId, ct);
        if (actor is null || !CanManage(actor.Role))
            return OpResult<Unit>.Fail("Недостаточно прав.");

        if (teamSize < 1 || teamSize > 10)
            return OpResult<Unit>.Fail("teamSize должен быть от 1 до 10.");

        var activity = await _db.Activities.Include(a => a.Module)
            .ThenInclude(m => m.Course)
            .FirstOrDefaultAsync(a => a.Id == activityId, ct);

        if (activity is null || activity.Type != ActivityType.Lecture)
            return OpResult<Unit>.Fail("Авто-генерация только для лекций.");

        // Get all students enrolled in this course
        var courseId = activity.Module.CourseId;
        var allStudentIds = await _db.Users
            .Where(u => u.Role == UserRole.Student)
            .Select(u => u.Id)
            .ToListAsync(ct);

        // Filter absent if requested (based on existing TeamMember records marking IsAbsent)
        List<Guid> students;
        if (excludeAbsent)
        {
            var absentIds = await _db.TeamMembers
                .Where(m => m.Team.ActivityId == activityId && m.IsAbsent)
                .Select(m => m.UserId)
                .ToListAsync(ct);
            students = allStudentIds.Except(absentIds).ToList();
        }
        else
        {
            students = allStudentIds;
        }

        if (students.Count == 0)
            return OpResult<Unit>.Fail("Нет студентов для распределения.");

        // Sort students by score for balancing strategies
        List<Guid> ordered = strategy switch
        {
            TeamGenerationStrategy.Random => Shuffle(students),
            TeamGenerationStrategy.BalanceRaw => await SortByRawScore(students, courseId, ct),
            TeamGenerationStrategy.BalanceFinal => await SortByFinalScore(students, courseId, ct),
            _ => Shuffle(students)
        };

        // Snake draft: split into teams
        int teamCount = (int)Math.Ceiling((double)ordered.Count / teamSize);
        var teams = Enumerable.Range(0, teamCount).Select(_ => new List<Guid>()).ToList();

        for (int i = 0; i < ordered.Count; i++)
        {
            int teamIdx = SnakeDraftIndex(i, teamCount);
            teams[teamIdx].Add(ordered[i]);
        }

        // Delete existing teams for this activity and recreate
        var existing = await _db.Teams
            .Include(t => t.Members)
            .Include(t => t.Assistants)
            .Where(t => t.ActivityId == activityId)
            .ToListAsync(ct);

        _db.Teams.RemoveRange(existing);
        await _db.SaveChangesAsync(ct);

        for (int i = 0; i < teams.Count; i++)
        {
            var team = new Team
            {
                Id = Guid.NewGuid(),
                ActivityId = activityId,
                Name = $"Команда {i + 1}",
                Members = teams[i].Select(uid => new TeamMember { UserId = uid }).ToList()
            };
            _db.Teams.Add(team);
        }

        await _db.SaveChangesAsync(ct);
        return OpResult<Unit>.Ok(Unit.Value);
    }

    public async Task<OpResult<Unit>> AutoAssignAssistants(
        Guid actorId, Guid activityId, CancellationToken ct = default)
    {
        var actor = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == actorId, ct);
        if (actor is null || !CanManage(actor.Role))
            return OpResult<Unit>.Fail("Недостаточно прав.");

        var activeAssistantIds = await _db.ActivityAssistants
            .Where(a => a.ActivityId == activityId)
            .Select(a => a.AssistantId)
            .ToListAsync(ct);

        if (activeAssistantIds.Count == 0)
            return OpResult<Unit>.Fail("Нет активных ассистентов для этого занятия.");

        var teams = await _db.Teams
            .Include(t => t.Assistants)
            .Where(t => t.ActivityId == activityId)
            .ToListAsync(ct);

        if (teams.Count == 0)
            return OpResult<Unit>.Fail("Нет команд на этом занятии.");

        // Remove existing assignments
        foreach (var team in teams)
            team.Assistants.Clear();

        // Round-robin random assignment
        var shuffled = Shuffle(activeAssistantIds);
        for (int i = 0; i < teams.Count; i++)
        {
            var assistantId = shuffled[i % shuffled.Count];
            teams[i].Assistants.Add(new TeamAssistant { AssistantId = assistantId });
        }

        await _db.SaveChangesAsync(ct);
        return OpResult<Unit>.Ok(Unit.Value);
    }

    public async Task<OpResult<Unit>> SwapMembers(
        Guid actorId, Guid activityId, Guid studentAId, Guid studentBId, CancellationToken ct = default)
    {
        var actor = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == actorId, ct);
        if (actor is null || !CanManage(actor.Role))
            return OpResult<Unit>.Fail("Недостаточно прав.");

        var memberA = await _db.TeamMembers
            .FirstOrDefaultAsync(m => m.Team.ActivityId == activityId && m.UserId == studentAId, ct);
        var memberB = await _db.TeamMembers
            .FirstOrDefaultAsync(m => m.Team.ActivityId == activityId && m.UserId == studentBId, ct);

        if (memberA is null || memberB is null)
            return OpResult<Unit>.Fail("Один или оба студента не найдены в командах этого занятия.");

        if (memberA.TeamId == memberB.TeamId)
            return OpResult<Unit>.Fail("Студенты уже в одной команде.");

        var teamAId = memberA.TeamId;
        var teamBId = memberB.TeamId;

        memberA.TeamId = teamBId;
        memberB.TeamId = teamAId;

        _db.TeamSwapLogs.Add(new TeamSwapLog
        {
            Id = Guid.NewGuid(),
            ActivityId = activityId,
            StudentAId = studentAId,
            TeamAId = teamAId,
            StudentBId = studentBId,
            TeamBId = teamBId,
            InitiatedByUserId = actorId
        });

        await _db.SaveChangesAsync(ct);
        return OpResult<Unit>.Ok(Unit.Value);
    }

    // --- helpers ---

    private static List<Guid> Shuffle(List<Guid> list)
    {
        var copy = list.ToList();
        var rng = new Random();
        for (int i = copy.Count - 1; i > 0; i--)
        {
            int j = rng.Next(i + 1);
            (copy[i], copy[j]) = (copy[j], copy[i]);
        }
        return copy;
    }

    private static int SnakeDraftIndex(int pickNumber, int teamCount)
    {
        int round = pickNumber / teamCount;
        int posInRound = pickNumber % teamCount;
        return round % 2 == 0 ? posInRound : teamCount - 1 - posInRound;
    }

    private async Task<List<Guid>> SortByRawScore(List<Guid> studentIds, Guid courseId, CancellationToken ct)
    {
        // Raw score = sum of group base points across all lectures (before KT multiplier)
        var rawScores = new Dictionary<Guid, decimal>();
        foreach (var sid in studentIds)
        {
            // SQLite не умеет SUM по decimal — суммируем в памяти.
            var bp = await _db.TeamGroupScores
                .Where(s => s.Team.Activity.Module.CourseId == courseId
                    && s.Team.Members.Any(m => m.UserId == sid))
                .Select(s => s.BasePoints)
                .ToListAsync(ct);
            rawScores[sid] = bp.Sum();
        }
        return studentIds.OrderByDescending(id => rawScores.GetValueOrDefault(id)).ToList();
    }

    private async Task<List<Guid>> SortByFinalScore(List<Guid> studentIds, Guid courseId, CancellationToken ct)
    {
        // SQLite не умеет SUM/GroupBy по decimal в SQL — агрегируем в памяти.
        var rows = await _db.StudentActivityScores
            .AsNoTracking()
            .Where(s => s.CourseId == courseId && studentIds.Contains(s.StudentId))
            .Select(s => new { s.StudentId, s.ModuleScore })
            .ToListAsync(ct);

        var dict = rows.GroupBy(s => s.StudentId).ToDictionary(g => g.Key, g => g.Sum(s => s.ModuleScore));
        return studentIds.OrderByDescending(id => dict.GetValueOrDefault(id)).ToList();
    }
}
