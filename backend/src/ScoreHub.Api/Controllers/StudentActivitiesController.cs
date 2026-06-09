using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ScoreHub.Domain.Enums;
using ScoreHub.Domain.Entities;
using ScoreHub.Infrastructure.Persistence;

namespace ScoreHub.Api.Controllers;

[ApiController]
[Route("api/student")]
[Authorize]
public sealed class StudentActivitiesController : ApiControllerBase
{
    private readonly ScoreHubDbContext _db;
    public StudentActivitiesController(ScoreHubDbContext db) { _db = db; }

    /// <summary>Все запланированные и активные занятия для курсов, на которые записан пользователь.</summary>
    [HttpGet("activities")]
    public async Task<IActionResult> MyActivities(CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();

        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == uid.Value, ct);
        if (user is null) return Unauthorized();

        var isAssistant = user.Role == Domain.Enums.UserRole.Assistant;
        var isTeacher = user.Role is Domain.Enums.UserRole.Teacher or Domain.Enums.UserRole.Admin;

        IQueryable<Domain.Entities.Activity> query = _db.Activities.AsNoTracking();

        if (isTeacher)
        {
            // Преподаватель видит все занятия без ограничений по записи на курс
            query = query.Where(a => a.Status != ActivityStatus.Finished);
        }
        else if (isAssistant)
        {
            var courseIds = await _db.CourseEnrollments
                .Where(e => e.UserId == uid.Value)
                .Select(e => e.CourseId)
                .ToListAsync(ct);

            // Active activities must have an approved ActivityAssistant record.
            // Scheduled activities are shown so they can apply; Active without approval are hidden.
            var approvedActivityIds = await _db.ActivityAssistants
                .Where(aa => aa.AssistantId == uid.Value)
                .Select(aa => aa.ActivityId)
                .ToListAsync(ct);

            query = query.Where(a =>
                courseIds.Contains(a.Module.CourseId)
                && a.Status != ActivityStatus.Finished
                && (a.Status == ActivityStatus.Scheduled || approvedActivityIds.Contains(a.Id)));
        }
        else
        {
            var courseIds = await _db.CourseEnrollments
                .Where(e => e.UserId == uid.Value)
                .Select(e => e.CourseId)
                .ToListAsync(ct);

            query = query.Where(a =>
                courseIds.Contains(a.Module.CourseId)
                && a.Status != ActivityStatus.Finished);
        }

        var activities = await query
            .Select(a => new {
                a.Id,
                a.Title,
                a.Type,
                typeLabel = a.Type == ActivityType.Lecture ? "Лекция"
                    : a.Type == ActivityType.ControlPoint ? "КТ"
                    : "ДЗ-сессия",
                status = a.Status.ToString(),
                a.StartsAt,
                a.EndsAt,
                courseCode = a.Module.Course.Code,
                courseTitle = a.Module.Course.Title,
                moduleTitle = a.Module.Title
            })
            .ToListAsync(ct);

        // Сортируем в памяти — SQLite не поддерживает ORDER BY DateTimeOffset
        return Ok(activities.OrderBy(a => a.StartsAt));
    }

}
