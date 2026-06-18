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

        // Все записанные на курс студенты (КТ индивидуальна и команд может не быть).
        var allStudentIds = await _db.CourseEnrollments
            .Where(e => e.CourseId == course.Id)
            .Join(_db.Users, e => e.UserId, u => u.Id, (e, u) => u)
            .Where(u => u.Role == UserRole.Student)
            .Select(u => u.Id)
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

    public async Task RecomputeModuleScoresForActivity(Guid activityId, CancellationToken ct = default)
    {
        var act = await _db.Activities
            .AsNoTracking()
            .Where(a => a.Id == activityId)
            .Select(a => new { CourseId = a.Module.CourseId, ModuleNumber = a.Module.Number })
            .FirstOrDefaultAsync(ct);
        if (act is null) return;

        var studentIds = await _db.CourseEnrollments
            .Where(e => e.CourseId == act.CourseId)
            .Join(_db.Users, e => e.UserId, u => u.Id, (e, u) => u)
            .Where(u => u.Role == UserRole.Student)
            .Select(u => u.Id)
            .ToListAsync(ct);

        foreach (var sid in studentIds)
        {
            // Сохраняем уже выставленный КТ-множитель; если КТ ещё не была — показываем баллы с ×1.0.
            var existingMult = await _db.StudentActivityScores
                .Where(s => s.CourseId == act.CourseId && s.StudentId == sid && s.ModuleNumber == act.ModuleNumber)
                .Select(s => (decimal?)s.KtMultiplier)
                .FirstOrDefaultAsync(ct);
            var mult = existingMult is > 0 ? existingMult.Value : 1.0m;
            await UpsertModuleScore(sid, act.CourseId, act.ModuleNumber, mult, ct);
        }

        await _db.SaveChangesAsync(ct);
    }

    /// <summary>Ручные правки ячеек студента по курсу: CellKey → значение.</summary>
    private async Task<Dictionary<string, decimal>> LoadOverrides(Guid courseId, Guid studentId, CancellationToken ct) =>
        await _db.GradeOverrides.AsNoTracking()
            .Where(o => o.CourseId == courseId && o.StudentId == studentId)
            .ToDictionaryAsync(o => o.CellKey, o => o.Value, ct);

    /// <summary>Пересчитать и сохранить балл одного студента за модуль с учётом ручных правок.</summary>
    public async Task RecomputeStudentModule(Guid courseId, Guid studentId, int moduleNumber, CancellationToken ct = default)
    {
        var existingMult = await _db.StudentActivityScores
            .Where(s => s.CourseId == courseId && s.StudentId == studentId && s.ModuleNumber == moduleNumber)
            .Select(s => (decimal?)s.KtMultiplier)
            .FirstOrDefaultAsync(ct);
        await UpsertModuleScore(studentId, courseId, moduleNumber, existingMult is > 0 ? existingMult.Value : 1.0m, ct);
        await _db.SaveChangesAsync(ct);
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

        var overrides = await LoadOverrides(courseId, studentId, ct);
        // КТ-множитель: ручная правка ktCoef:<module> перекрывает вычисленный.
        var mult = overrides.GetValueOrDefault($"ktCoef:{moduleNumber}", ktMultiplier);

        var lecturePoints = await ComputeLecturePoints(studentId, courseId, moduleNumber, overrides, ct);
        var hwPoints = overrides.TryGetValue($"homework:{moduleNumber}", out var hwOv)
            ? hwOv
            : await ComputeHomeworkPoints(studentId, courseId, moduleNumber, ct);

        record.LecturePoints = lecturePoints;
        record.HomeworkPoints = hwPoints;
        record.KtMultiplier = mult;
        record.ModuleScore = Math.Round((lecturePoints + hwPoints) * mult, 4);
        record.UpdatedAt = DateTimeOffset.UtcNow;
    }

    private async Task<decimal> ComputeLecturePoints(Guid studentId, Guid courseId, int moduleNumber, Dictionary<string, decimal> overrides, CancellationToken ct)
    {
        var lectureIds = await _db.Activities
            .Where(a => a.Module.CourseId == courseId
                && a.Module.Number == moduleNumber
                && a.Type == ActivityType.Lecture)
            .Select(a => a.Id)
            .ToListAsync(ct);

        decimal total = 0;

        foreach (var actId in lectureIds)
        {
            var member = await _db.TeamMembers
                .FirstOrDefaultAsync(m => m.Team.ActivityId == actId && m.UserId == studentId, ct);
            bool present = member is not null && !member.IsAbsent;
            var teamId = member?.TeamId;

            // Коды задач занятия.
            var taskCodes = await _db.TaskItems
                .Where(t => t.TaskSet.ActivityId == actId)
                .Select(t => t.Code).Distinct().ToListAsync(ct);

            // Принятые сдачи команды по коду.
            var acceptedByCode = teamId is null ? new() : (await _db.TaskSubmissions.AsNoTracking()
                .Where(s => s.ActivityId == actId && s.TeamId == teamId && s.Status == SubmissionStatus.Accepted)
                .Select(s => new { Code = s.TaskItem.Code, s.DefenderUserId, s.DefenderCoefficient, Points = s.TaskItem.Points })
                .ToListAsync(ct))
                .GroupBy(s => s.Code).ToDictionary(g => g.Key, g => g.First());

            // Коды: все задачи занятия + те, на которые есть ручная правка.
            var allCodes = taskCodes
                .Concat(overrides.Keys.Where(k => k.StartsWith($"task:{actId}:")).Select(k => k[$"task:{actId}:".Length..]))
                .Distinct();

            decimal lectureScore = 0;
            foreach (var code in allCodes)
            {
                var key = $"task:{actId}:{code}";
                if (overrides.TryGetValue(key, out var ov)) { lectureScore += ov; continue; }
                if (present && acceptedByCode.TryGetValue(code, out var sub))
                {
                    var basePoints = sub.Points > 0 ? sub.Points : 1.0m;
                    lectureScore += (sub.DefenderUserId == studentId) ? basePoints * (sub.DefenderCoefficient ?? 1.0m) : basePoints;
                }
            }

            // Тест/бонус (с учётом ручной правки).
            decimal test;
            var testKey = $"test:{actId}";
            if (overrides.TryGetValue(testKey, out var tOv)) test = tOv;
            else
            {
                var bonuses = await _db.MiniTestAnswers
                    .Where(a => a.ActivityId == actId && a.StudentId == studentId)
                    .Select(a => a.BonusAwarded).ToListAsync(ct);
                test = present ? bonuses.Sum() : 0;
            }

            total += lectureScore + test;
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
        var actor = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == actorId, ct);
        if (actor is null) return OpResult<StudentScoreDto>.Fail("Пользователь не найден.");
        // Студент может смотреть только свои баллы; персонал (ассистент/препод/админ) — любые.
        if (!CanAssist(actor.Role) && actorId != studentId)
            return OpResult<StudentScoreDto>.Fail("Нет доступа к баллам другого студента.");

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
