using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ScoreHub.Application.Abstractions;
using ScoreHub.Application.Common;
using ScoreHub.Domain.Entities;
using ScoreHub.Domain.Enums;
using ScoreHub.Infrastructure.Persistence;

namespace ScoreHub.Infrastructure.Services;

public sealed class ScoringService : IScoringService
{
    private readonly ScoreHubDbContext _db;

    public ScoringService(ScoreHubDbContext db) => _db = db;

    private static bool CanManage(UserRole r) => r is UserRole.Teacher or UserRole.Admin;
    private static bool CanAssist(UserRole r) => r is UserRole.Assistant or UserRole.Teacher or UserRole.Admin;

    public async Task<OpResult<Unit>> SetGroupScore(
        Guid actorId, Guid activityId, Guid teamId, decimal groupCoefficient, CancellationToken ct = default)
    {
        var actor = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == actorId, ct);
        if (actor is null || !CanAssist(actor.Role))
            return OpResult<Unit>.Fail("Недостаточно прав.");

        if (groupCoefficient is < 0.8m or > 1.2m)
            return OpResult<Unit>.Fail("Коэффициент должен быть от 0.8 до 1.2.");

        var activity = await _db.Activities.AsNoTracking().FirstOrDefaultAsync(a => a.Id == activityId, ct);
        if (activity is null || activity.Type != ActivityType.Lecture)
            return OpResult<Unit>.Fail("Это не лекция.");

        var team = await _db.Teams.Include(t => t.Members).FirstOrDefaultAsync(t => t.Id == teamId, ct);
        if (team is null || team.ActivityId != activityId)
            return OpResult<Unit>.Fail("Команда не найдена.");

        // Count accepted tasks
        var tasks = await _db.TaskItems
            .Where(ti => ti.TaskSet.ActivityId == activityId)
            .CountAsync(ct);

        var accepted = await _db.TaskSubmissions
            .CountAsync(s => s.ActivityId == activityId && s.TeamId == teamId && s.Status == SubmissionStatus.Accepted, ct);

        decimal basePoints = tasks > 0
            ? Math.Round((decimal)accepted / tasks * activity.LectureBasePoints, 4)
            : 0;

        var score = await _db.TeamGroupScores
            .FirstOrDefaultAsync(s => s.TeamId == teamId && s.ActivityId == activityId, ct);

        if (score is null)
        {
            score = new TeamGroupScore
            {
                Id = Guid.NewGuid(),
                TeamId = teamId,
                ActivityId = activityId
            };
            _db.TeamGroupScores.Add(score);
        }

        score.TasksAccepted = accepted;
        score.TasksTotal = tasks;
        score.BasePoints = basePoints;
        score.GroupCoefficient = groupCoefficient;
        score.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return OpResult<Unit>.Ok(Unit.Value);
    }

    public async Task<OpResult<Unit>> FinalizeKt(Guid actorId, Guid activityId, CancellationToken ct = default)
    {
        var actor = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == actorId, ct);
        if (actor is null || !CanManage(actor.Role))
            return OpResult<Unit>.Fail("Недостаточно прав.");

        var ktActivity = await _db.Activities
            .Include(a => a.Module)
            .ThenInclude(m => m.Course)
            .FirstOrDefaultAsync(a => a.Id == activityId, ct);

        if (ktActivity is null || ktActivity.Type != ActivityType.ControlPoint)
            return OpResult<Unit>.Fail("Это не КТ.");

        var course = ktActivity.Module.Course;
        var multiplierMap = JsonSerializer.Deserialize<List<KtMapEntry>>(course.KtMultiplierMapJson) ?? [];

        // Get all students in this course
        var allStudentIds = await _db.TeamMembers
            .Where(m => m.Team.Activity.Module.CourseId == course.Id)
            .Select(m => m.UserId)
            .Distinct()
            .ToListAsync(ct);

        // KT tasks count for this activity
        var ktTaskIds = await _db.TaskItems
            .Where(ti => ti.TaskSet.ActivityId == activityId)
            .Select(ti => ti.Id)
            .ToListAsync(ct);

        foreach (var studentId in allStudentIds)
        {
            var solved = await _db.TaskSubmissions
                .CountAsync(s => s.ActivityId == activityId
                    && s.StudentId == studentId
                    && s.Status == SubmissionStatus.Accepted, ct);

            decimal multiplier = GetMultiplier(multiplierMap, solved);

            await UpsertModuleScore(studentId, course.Id, ktActivity.Module.Number, multiplier, ct);
        }

        await _db.SaveChangesAsync(ct);
        return OpResult<Unit>.Ok(Unit.Value);
    }

    private async Task UpsertModuleScore(Guid studentId, Guid courseId, int moduleNumber, decimal ktMultiplier, CancellationToken ct)
    {
        var record = await _db.StudentActivityScores
            .FirstOrDefaultAsync(s => s.CourseId == courseId && s.StudentId == studentId && s.ModuleNumber == moduleNumber, ct);

        if (record is null)
        {
            record = new StudentActivityScore
            {
                Id = Guid.NewGuid(),
                CourseId = courseId,
                StudentId = studentId,
                ModuleNumber = moduleNumber
            };
            _db.StudentActivityScores.Add(record);
        }

        // Recalculate lecture points from TeamGroupScores
        var lecturePoints = await ComputeLecturePoints(studentId, courseId, moduleNumber, ct);
        var hwPoints = await ComputeHomeworkPoints(studentId, courseId, moduleNumber, ct);

        record.LecturePoints = lecturePoints;
        record.HomeworkPoints = hwPoints;
        record.KtMultiplier = ktMultiplier;
        record.ModuleScore = Math.Round((lecturePoints + hwPoints) * ktMultiplier, 4);
        record.UpdatedAt = DateTimeOffset.UtcNow;
    }

    private async Task<decimal> ComputeLecturePoints(Guid studentId, Guid courseId, int moduleNumber, CancellationToken ct)
    {
        // Get all lecture activities in module
        var lectureIds = await _db.Activities
            .Where(a => a.Module.CourseId == courseId
                && a.Module.Number == moduleNumber
                && a.Type == ActivityType.Lecture)
            .Select(a => a.Id)
            .ToListAsync(ct);

        decimal total = 0;

        foreach (var actId in lectureIds)
        {
            // Find team the student was in for this lecture
            var teamId = await _db.TeamMembers
                .Where(m => m.Team.ActivityId == actId && m.UserId == studentId)
                .Select(m => (Guid?)m.TeamId)
                .FirstOrDefaultAsync(ct);

            if (teamId is null) continue;

            var groupScore = await _db.TeamGroupScores
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.TeamId == teamId && s.ActivityId == actId, ct);

            if (groupScore is null) continue;

            // Absent students get 0.8 instead of GroupCoefficient
            var member = await _db.TeamMembers
                .FirstOrDefaultAsync(m => m.TeamId == teamId && m.UserId == studentId, ct);

            decimal coeff = (member?.IsAbsent == true) ? 0.8m : groupScore.GroupCoefficient;
            decimal lectureScore = groupScore.BasePoints * coeff;

            // Add mini-test bonus
            var bonus = await _db.MiniTestAnswers
                .Where(a => a.ActivityId == actId && a.StudentId == studentId)
                .SumAsync(a => (decimal?)a.BonusAwarded, ct) ?? 0;

            total += lectureScore + bonus;
        }

        return Math.Round(total, 4);
    }

    private async Task<decimal> ComputeHomeworkPoints(Guid studentId, Guid courseId, int moduleNumber, CancellationToken ct)
    {
        var moduleActivities = await _db.Activities
            .Where(a => a.Module.CourseId == courseId && a.Module.Number == moduleNumber)
            .Select(a => a.Id)
            .ToListAsync(ct);

        var accepted = await _db.HomeworkSubmissions
            .Include(s => s.Members)
            .Include(s => s.TaskItem)
            .Where(s => moduleActivities.Contains(s.ActivityId)
                && s.Status == SubmissionStatus.Accepted
                && s.Members.Any(m => m.UserId == studentId))
            .ToListAsync(ct);

        return accepted.Sum(s => s.TaskItem.Points * s.TimeCoefficient);
    }

    private static decimal GetMultiplier(List<KtMapEntry> map, int solved)
    {
        var entry = map
            .Where(e => e.TasksSolved <= solved)
            .OrderByDescending(e => e.TasksSolved)
            .FirstOrDefault();
        return entry?.Multiplier ?? 0.5m;
    }

    public async Task<OpResult<StudentScoreDto>> GetStudentScore(
        Guid actorId, Guid courseId, Guid studentId, CancellationToken ct = default)
    {
        var student = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == studentId, ct);
        if (student is null) return OpResult<StudentScoreDto>.Fail("Студент не найден.");

        var course = await _db.Courses.AsNoTracking().FirstOrDefaultAsync(c => c.Id == courseId, ct);
        if (course is null) return OpResult<StudentScoreDto>.Fail("Курс не найден.");

        var scores = await _db.StudentActivityScores
            .AsNoTracking()
            .Where(s => s.CourseId == courseId && s.StudentId == studentId)
            .ToListAsync(ct);

        var modules = scores.Select(s => new ModuleScoreDto(
            s.ModuleNumber, s.LecturePoints, s.HomeworkPoints, s.KtMultiplier, s.ModuleScore))
            .ToList();

        decimal final = modules.Sum(m => m.ModuleScore);
        string mark = GetMark(course.FinalGradingTableJson, final);

        return OpResult<StudentScoreDto>.Ok(new StudentScoreDto(studentId, student.DisplayName, modules, final, mark));
    }

    public async Task<OpResult<IReadOnlyList<StudentScoreDto>>> GetCourseScores(
        Guid actorId, Guid courseId, CancellationToken ct = default)
    {
        var actor = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == actorId, ct);
        if (actor is null || !CanAssist(actor.Role))
            return OpResult<IReadOnlyList<StudentScoreDto>>.Fail("Недостаточно прав.");

        var course = await _db.Courses.AsNoTracking().FirstOrDefaultAsync(c => c.Id == courseId, ct);
        if (course is null) return OpResult<IReadOnlyList<StudentScoreDto>>.Fail("Курс не найден.");

        var allScores = await _db.StudentActivityScores
            .AsNoTracking()
            .Where(s => s.CourseId == courseId)
            .ToListAsync(ct);

        var studentIds = allScores.Select(s => s.StudentId).Distinct().ToList();
        var users = await _db.Users.AsNoTracking()
            .Where(u => studentIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.DisplayName, ct);

        var result = studentIds.Select(sid =>
        {
            var modules = allScores.Where(s => s.StudentId == sid)
                .Select(s => new ModuleScoreDto(s.ModuleNumber, s.LecturePoints, s.HomeworkPoints, s.KtMultiplier, s.ModuleScore))
                .ToList();
            decimal final = modules.Sum(m => m.ModuleScore);
            return new StudentScoreDto(sid, users.GetValueOrDefault(sid, "?"), modules, final, GetMark(course.FinalGradingTableJson, final));
        }).OrderByDescending(s => s.FinalScore).ToList();

        return OpResult<IReadOnlyList<StudentScoreDto>>.Ok(result);
    }

    private static string GetMark(string gradingJson, decimal score)
    {
        var table = JsonSerializer.Deserialize<List<GradeEntry>>(gradingJson) ?? [];
        var entry = table.Where(e => score >= e.Min).OrderByDescending(e => e.Min).FirstOrDefault();
        return entry?.Mark ?? "2-";
    }

    private sealed record KtMapEntry(
        [property: System.Text.Json.Serialization.JsonPropertyName("tasks_solved")] int TasksSolved,
        [property: System.Text.Json.Serialization.JsonPropertyName("multiplier")] decimal Multiplier);

    private sealed record GradeEntry(
        [property: System.Text.Json.Serialization.JsonPropertyName("min")] decimal Min,
        [property: System.Text.Json.Serialization.JsonPropertyName("mark")] string Mark);
}
