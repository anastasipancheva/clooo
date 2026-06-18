using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ScoreHub.Domain.Auth;
using ScoreHub.Domain.Enums;
using ScoreHub.Infrastructure.Persistence;

namespace ScoreHub.Api.Controllers;

/// <summary>Иерархическая ведомость курса: модуль → лекция → задача, с итоговыми колонками.</summary>
[ApiController]
[Route("api/courses/{courseId:guid}/gradebook")]
[Authorize(Roles = $"{AppRoles.Assistant},{AppRoles.Teacher},{AppRoles.Admin}")]
public sealed class GradebookController : ApiControllerBase
{
    private readonly ScoreHubDbContext _db;
    public GradebookController(ScoreHubDbContext db) { _db = db; }

    [HttpGet]
    public async Task<IActionResult> Get(Guid courseId, CancellationToken ct)
    {
        var course = await _db.Courses.AsNoTracking().FirstOrDefaultAsync(c => c.Id == courseId, ct);
        if (course is null) return NotFound();

        // Студенты курса (по фамилии — по displayName).
        var students = (await _db.CourseEnrollments
            .Where(e => e.CourseId == courseId)
            .Join(_db.Users, e => e.UserId, u => u.Id, (e, u) => u)
            .Where(u => u.Role == UserRole.Student)
            .Select(u => new { u.Id, u.DisplayName })
            .ToListAsync(ct))
            .OrderBy(s => s.DisplayName, StringComparer.OrdinalIgnoreCase)
            .ToList();
        var studentIds = students.Select(s => s.Id).ToHashSet();

        // Структура курса.
        var modules = await _db.Modules.AsNoTracking()
            .Where(m => m.CourseId == courseId)
            .OrderBy(m => m.Number)
            .Select(m => new { m.Number })
            .ToListAsync(ct);

        var activities = (await _db.Activities.AsNoTracking()
            .Where(a => a.Module.CourseId == courseId)
            .Select(a => new { a.Id, a.Title, a.Type, ModuleNumber = a.Module.Number, a.StartsAt })
            .ToListAsync(ct))
            .OrderBy(a => a.StartsAt)
            .ToList();

        // Задачи занятий (код + баллы).
        var taskItems = await _db.TaskItems.AsNoTracking()
            .Where(t => t.TaskSet.Activity.Module.CourseId == courseId)
            .Select(t => new { ActivityId = t.TaskSet.ActivityId, t.Code, t.Points })
            .ToListAsync(ct);
        decimal Num(string c) => int.TryParse(c, out var n) ? n : 0;
        var taskCodesByActivity = taskItems
            .GroupBy(t => t.ActivityId)
            .ToDictionary(g => g.Key, g => g.Select(t => t.Code).Distinct().OrderBy(Num).ToList());

        // Принятые командные сдачи (лекции).
        var teamSubs = await _db.TaskSubmissions.AsNoTracking()
            .Where(s => s.Status == SubmissionStatus.Accepted && s.TeamId != null && s.Activity.Module.CourseId == courseId)
            .Select(s => new { s.ActivityId, TeamId = s.TeamId!.Value, Code = s.TaskItem.Code, Points = s.TaskItem.Points, s.DefenderUserId, s.DefenderCoefficient })
            .ToListAsync(ct);
        var teamSubLookup = teamSubs.ToDictionary(s => (s.ActivityId, s.TeamId, s.Code));

        // Членство в командах (для определения присутствия и команды на занятии).
        var memberships = await _db.TeamMembers.AsNoTracking()
            .Where(m => m.Team.Activity.Module.CourseId == courseId)
            .Select(m => new { ActivityId = m.Team.ActivityId, m.TeamId, m.UserId, m.IsAbsent })
            .ToListAsync(ct);
        var membershipByActStudent = memberships
            .GroupBy(m => (m.ActivityId, m.UserId))
            .ToDictionary(g => g.Key, g => g.First());

        // Принятые индивидуальные сдачи КТ.
        var ktSubs = await _db.TaskSubmissions.AsNoTracking()
            .Where(s => s.Status == SubmissionStatus.Accepted && s.StudentId != null
                && s.Activity.Type == ActivityType.ControlPoint && s.Activity.Module.CourseId == courseId)
            .Select(s => new { s.ActivityId, StudentId = s.StudentId!.Value, Points = s.TaskItem.Points })
            .ToListAsync(ct);

        // Бонус за мини-тест.
        var activityIds = activities.Select(a => a.Id).ToList();
        var miniBonus = await _db.MiniTestAnswers.AsNoTracking()
            .Where(a => activityIds.Contains(a.ActivityId))
            .Select(a => new { a.ActivityId, a.StudentId, a.BonusAwarded })
            .ToListAsync(ct);
        var bonusByActStudent = miniBonus
            .GroupBy(b => (b.ActivityId, b.StudentId))
            .ToDictionary(g => g.Key, g => g.Sum(x => x.BonusAwarded));

        // Модульные итоги (КТ-множитель и moduleScore).
        var sas = await _db.StudentActivityScores.AsNoTracking()
            .Where(s => s.CourseId == courseId)
            .Select(s => new { s.StudentId, s.ModuleNumber, s.LecturePoints, s.HomeworkPoints, s.KtMultiplier, s.ModuleScore })
            .ToListAsync(ct);
        var sasByStudentModule = sas.ToDictionary(s => (s.StudentId, s.ModuleNumber));

        var lectureActs = activities.Where(a => a.Type == ActivityType.Lecture).ToList();
        var ktActsByModule = activities.Where(a => a.Type == ActivityType.ControlPoint)
            .GroupBy(a => a.ModuleNumber).ToDictionary(g => g.Key, g => g.Select(a => a.Id).ToList());

        // === Сборка структуры колонок ===
        var moduleCols = modules.Select(m => new
        {
            number = m.Number,
            lectures = lectureActs.Where(a => a.ModuleNumber == m.Number)
                .Select(a => new { id = a.Id, title = a.Title, taskCodes = taskCodesByActivity.GetValueOrDefault(a.Id, new List<string>()) })
                .ToList(),
            hasKt = ktActsByModule.ContainsKey(m.Number)
        }).ToList();

        var gradeTable = JsonSerializer.Deserialize<List<GradeEntry>>(course.FinalGradingTableJson) ?? new();
        string MarkFor(decimal score) =>
            gradeTable.Where(e => score >= e.Min).OrderByDescending(e => e.Min).FirstOrDefault()?.Mark ?? "2-";

        var rows = new Dictionary<string, object>();
        foreach (var st in students)
        {
            var sid = st.Id;
            decimal weighted = 0, raw = 0;
            var modulesOut = new Dictionary<string, object>();

            foreach (var mc in moduleCols)
            {
                var sasRec = sasByStudentModule.GetValueOrDefault((sid, mc.number));
                decimal moduleScore = sasRec?.ModuleScore ?? 0;
                decimal homework = sasRec?.HomeworkPoints ?? 0;
                decimal ktCoef = sasRec?.KtMultiplier ?? 0;
                decimal lecturePointsRaw = sasRec?.LecturePoints ?? 0;

                // КТ-баллы (сумма принятых задач КТ модуля).
                decimal ktPoints = 0;
                if (ktActsByModule.TryGetValue(mc.number, out var ktIds))
                    ktPoints = ktSubs.Where(k => k.StudentId == sid && ktIds.Contains(k.ActivityId)).Sum(k => k.Points);

                var lecturesOut = new Dictionary<string, object>();
                foreach (var lec in mc.lectures)
                {
                    var tasksOut = new Dictionary<string, decimal>();
                    decimal defenderCoef = 1.0m;
                    var mem = membershipByActStudent.GetValueOrDefault((lec.id, sid));
                    bool present = mem is not null && !mem.IsAbsent;

                    foreach (var code in lec.taskCodes)
                    {
                        decimal pts = 0;
                        if (present && mem is not null && teamSubLookup.TryGetValue((lec.id, mem.TeamId, code), out var sub))
                        {
                            if (sub.DefenderUserId == sid)
                            {
                                var c = sub.DefenderCoefficient ?? 1.0m;
                                defenderCoef = c;
                                pts = (sub.Points > 0 ? sub.Points : 1m) * c;
                            }
                            else
                            {
                                pts = sub.Points > 0 ? sub.Points : 1m;
                            }
                        }
                        tasksOut[code] = decimal.Round(pts, 2);
                    }

                    decimal test = present ? bonusByActStudent.GetValueOrDefault((lec.id, sid), 0) : 0;
                    decimal lecTotal = tasksOut.Values.Sum() + test;
                    lecturesOut[lec.id.ToString()] = new
                    {
                        total = decimal.Round(lecTotal, 2),
                        test = decimal.Round(test, 2),
                        coef = defenderCoef,
                        tasks = tasksOut
                    };
                }

                modulesOut[mc.number.ToString()] = new
                {
                    score = decimal.Round(moduleScore, 2),
                    homework = decimal.Round(homework, 2),
                    ktCoef,
                    ktPoints = decimal.Round(ktPoints, 2),
                    lectures = lecturesOut
                };

                weighted += moduleScore;
                raw += lecturePointsRaw + homework;
            }

            rows[sid.ToString()] = new
            {
                finalMark = MarkFor(weighted),
                weighted = decimal.Round(weighted, 2),
                raw = decimal.Round(raw, 2),
                modules = modulesOut
            };
        }

        return Ok(new
        {
            students = students.Select(s => new { id = s.Id, name = s.DisplayName }),
            modules = moduleCols,
            rows
        });
    }

    private sealed record GradeEntry(
        [property: System.Text.Json.Serialization.JsonPropertyName("min")] decimal Min,
        [property: System.Text.Json.Serialization.JsonPropertyName("mark")] string Mark);
}
