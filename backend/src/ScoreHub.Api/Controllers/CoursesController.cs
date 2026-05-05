using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ScoreHub.Domain.Entities;
using ScoreHub.Infrastructure.Persistence;

namespace ScoreHub.Api.Controllers;

/// <summary>Список курсов (чтение), запись и зачисление студентов.</summary>
[ApiController]
[Route("api/courses")]
[Authorize]
public sealed class CoursesController : ControllerBase
{
    private readonly ScoreHubDbContext _db;

    public CoursesController(ScoreHubDbContext db)
    {
        _db = db;
    }

    private Guid? CurrentUserId
    {
        get
        {
            var v = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return v is not null && Guid.TryParse(v, out var g) ? g : null;
        }
    }

    /// <summary>Список всех курсов: Id, Code, Title, AcademicYear.</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<object>>> List(CancellationToken ct)
    {
        var list = await _db.Courses
            .AsNoTracking()
            .OrderBy(c => c.Code)
            .Select(c => new { c.Id, c.Code, c.Title, c.AcademicYear })
            .ToListAsync(ct);

        return Ok(list);
    }

    /// <summary>Список студентов, записанных на курс.</summary>
    [HttpGet("{courseId:guid}/students")]
    public async Task<IActionResult> GetStudents(Guid courseId, CancellationToken ct)
    {
        var exists = await _db.Courses.AnyAsync(c => c.Id == courseId, ct);
        if (!exists) return NotFound();

        var students = await _db.CourseEnrollments
            .AsNoTracking()
            .Where(e => e.CourseId == courseId)
            .Join(_db.Users, e => e.UserId, u => u.Id, (e, u) => new
            {
                u.Id,
                u.Email,
                u.DisplayName,
                Role = u.Role.ToString(),
                e.EnrolledAt
            })
            .ToListAsync(ct);

        return Ok(students);
    }

    /// <summary>Записать текущего пользователя на курс (студент записывается сам).</summary>
    [HttpPost("{courseId:guid}/enroll")]
    public async Task<IActionResult> Enroll(Guid courseId, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();

        var exists = await _db.Courses.AnyAsync(c => c.Id == courseId, ct);
        if (!exists) return NotFound(new { error = "Course not found." });

        var already = await _db.CourseEnrollments
            .AnyAsync(e => e.CourseId == courseId && e.UserId == uid.Value, ct);

        if (already) return Conflict(new { error = "Already enrolled." });

        _db.CourseEnrollments.Add(new CourseEnrollment
        {
            CourseId = courseId,
            UserId = uid.Value,
            EnrolledAt = DateTimeOffset.UtcNow
        });
        await _db.SaveChangesAsync(ct);
        return Ok();
    }
}
