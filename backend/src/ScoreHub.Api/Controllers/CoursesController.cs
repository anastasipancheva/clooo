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

    /// <summary>Список всех курсов: Id, Code, Title, AcademicYear + isEnrolled для текущего пользователя.</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<object>>> List(CancellationToken ct)
    {
        var uid = CurrentUserId;

        var enrolledIds = uid.HasValue
            ? await _db.CourseEnrollments
                .Where(e => e.UserId == uid.Value)
                .Select(e => e.CourseId)
                .ToListAsync(ct)
            : new List<Guid>();

        var list = await _db.Courses
            .AsNoTracking()
            .OrderBy(c => c.Code)
            .Select(c => new { c.Id, c.Code, c.Title, c.AcademicYear })
            .ToListAsync(ct);

        return Ok(list.Select(c => new { c.Id, c.Code, c.Title, c.AcademicYear, IsEnrolled = enrolledIds.Contains(c.Id) }));
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

}
