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

        var courseIds = await _db.CourseEnrollments
            .Where(e => e.UserId == uid.Value)
            .Select(e => e.CourseId)
            .ToListAsync(ct);

        var activities = await _db.Activities
            .AsNoTracking()
            .Where(a => courseIds.Contains(a.Module.CourseId)
                && a.Status != ActivityStatus.Finished)
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

    /// <summary>Моя команда и задачи на занятии.</summary>
    [HttpGet("/api/activities/{activityId:guid}/my-team")]
    public async Task<IActionResult> MyTeam(Guid activityId, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();

        var membership = await _db.TeamMembers
            .AsNoTracking()
            .Where(m => m.UserId == uid.Value && m.Team.ActivityId == activityId)
            .Select(m => new { m.TeamId, m.Team.Name })
            .FirstOrDefaultAsync(ct);

        if (membership is null) return NotFound(new { error = "Not in a team" });

        var tasks = await _db.TaskSubmissions
            .AsNoTracking()
            .Where(s => s.ActivityId == activityId && s.TeamId == membership.TeamId)
            .Select(s => new { s.Id, s.TaskItem.Code, Status = s.Status.ToString() })
            .ToListAsync(ct);

        return Ok(new { teamId = membership.TeamId, teamName = membership.Name, tasks });
    }

    /// <summary>Самостоятельная запись студента на курс по инвайт-коду.</summary>
    [HttpPost("courses/{courseId:guid}/enroll")]
    public async Task<IActionResult> Enroll(Guid courseId, [FromBody] EnrollDto dto, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();

        var course = await _db.Courses.FirstOrDefaultAsync(c => c.Id == courseId, ct);
        if (course is null) return NotFound();

        // Validate invite code
        if (string.IsNullOrWhiteSpace(dto.InviteCode) ||
            !string.Equals(course.InviteCode, dto.InviteCode.Trim().ToLowerInvariant(), StringComparison.Ordinal))
        {
            return BadRequest(new { error = "Неверный код приглашения." });
        }

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
            return Conflict(new { error = "Already enrolled" });
        }
        return Ok();
    }

    public sealed record EnrollDto(string? InviteCode);
}
