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

        var courseIds = await _db.CourseEnrollments
            .Where(e => e.UserId == uid.Value)
            .Select(e => e.CourseId)
            .ToListAsync(ct);

        // For assistants: Active activities must have an approved ActivityAssistant record.
        // Scheduled activities are shown so they can apply; Active without approval are hidden.
        IQueryable<Domain.Entities.Activity> query = _db.Activities.AsNoTracking();

        if (isAssistant)
        {
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

    /// <summary>Самостоятельная запись студента на курс.</summary>
    [HttpPost("courses/{courseId:guid}/enroll")]
    public async Task<IActionResult> Enroll(Guid courseId, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();

        var courseExists = await _db.Courses.AnyAsync(c => c.Id == courseId, ct);
        if (!courseExists) return NotFound();

        var exists = await _db.CourseEnrollments
            .AnyAsync(e => e.CourseId == courseId && e.UserId == uid.Value, ct);
        if (exists) return Conflict(new { error = "Already enrolled" });

        _db.CourseEnrollments.Add(new CourseEnrollment
        {
            CourseId = courseId,
            UserId = uid.Value,
            EnrolledAt = DateTimeOffset.UtcNow
        });
        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (Microsoft.EntityFrameworkCore.DbUpdateException)
        {
            // Race condition: another request enrolled between our check and save
            return Conflict(new { error = "Already enrolled" });
        }
        return Ok();
    }
}
