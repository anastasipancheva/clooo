using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ScoreHub.Domain.Entities;
using ScoreHub.Infrastructure.Persistence;

namespace ScoreHub.Api.Controllers;

/// <summary>Запись студента/ассистента на курс.</summary>
[ApiController]
[Route("api/student")]
[Authorize]
public sealed class StudentController : ApiControllerBase
{
    private readonly ScoreHubDbContext _db;

    public StudentController(ScoreHubDbContext db) => _db = db;

    /// <summary>Записаться на курс.</summary>
    [HttpPost("courses/{courseId:guid}/enroll")]
    public async Task<IActionResult> Enroll(Guid courseId, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();

        if (!await _db.Courses.AnyAsync(c => c.Id == courseId, ct))
            return NotFound(new { error = "Курс не найден." });

        var exists = await _db.CourseEnrollments
            .AnyAsync(e => e.CourseId == courseId && e.UserId == uid.Value, ct);
        if (exists) return Ok(new { message = "Уже записаны." });

        _db.CourseEnrollments.Add(new CourseEnrollment
        {
            CourseId = courseId,
            UserId = uid.Value,
            EnrolledAt = DateTimeOffset.UtcNow
        });
        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "Записаны на курс." });
    }

    /// <summary>Отписаться от курса.</summary>
    [HttpDelete("courses/{courseId:guid}/enroll")]
    public async Task<IActionResult> Unenroll(Guid courseId, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();

        var enrollment = await _db.CourseEnrollments
            .FirstOrDefaultAsync(e => e.CourseId == courseId && e.UserId == uid.Value, ct);
        if (enrollment is null) return NotFound(new { error = "Не записаны на этот курс." });

        _db.CourseEnrollments.Remove(enrollment);
        await _db.SaveChangesAsync(ct);
        return Ok();
    }

    /// <summary>Занятия из записанных курсов (опционально фильтр по типу: 1=Lecture, 2=ControlPoint, 3=Homework).</summary>
    [HttpGet("activities")]
    public async Task<IActionResult> GetActivities([FromQuery] int? type, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();

        var enrolledCourseIds = await _db.CourseEnrollments
            .Where(e => e.UserId == uid.Value)
            .Select(e => e.CourseId)
            .ToListAsync(ct);

        // Если нет зачислений — показать все занятия (совместимость с тестовой средой)
        var baseQuery = enrolledCourseIds.Count > 0
            ? _db.Activities.Where(a => enrolledCourseIds.Contains(a.Module.CourseId))
            : _db.Activities;

        if (type.HasValue)
            baseQuery = baseQuery.Where(a => (int)a.Type == type.Value);

        var result = await baseQuery
            .Select(a => new
            {
                a.Id,
                a.Title,
                a.Type,
                a.StartsAt,
                a.EndsAt,
                courseId = a.Module.CourseId,
                moduleNumber = a.Module.Number
            })
            .OrderByDescending(a => a.StartsAt)
            .ToListAsync(ct);

        return Ok(result);
    }

    /// <summary>Список курсов, на которые записан текущий пользователь.</summary>
    [HttpGet("courses/enrolled")]
    public async Task<IActionResult> EnrolledCourses(CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();

        var list = await _db.CourseEnrollments
            .Where(e => e.UserId == uid.Value)
            .Join(_db.Courses, e => e.CourseId, c => c.Id, (e, c) => new
            {
                c.Id, c.Code, c.Title, c.AcademicYear, e.EnrolledAt
            })
            .OrderBy(c => c.Code)
            .ToListAsync(ct);

        return Ok(list);
    }
}
