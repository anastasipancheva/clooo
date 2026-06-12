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

    /// <summary>Список всех курсов: Id, Code, Title, AcademicYear, IsEnrolled.</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<object>>> List(CancellationToken ct)
    {
        var uid = CurrentUserId;
        var enrolledIds = uid is null
            ? new HashSet<Guid>()
            : (await _db.CourseEnrollments
                .Where(e => e.UserId == uid.Value)
                .Select(e => e.CourseId)
                .ToListAsync(ct)).ToHashSet();

        var list = await _db.Courses
            .AsNoTracking()
            .OrderBy(c => c.Code)
            .Select(c => new { c.Id, c.Code, c.Title, c.AcademicYear })
            .ToListAsync(ct);

        return Ok(list.Select(c => new { c.Id, c.Code, c.Title, c.AcademicYear, IsEnrolled = enrolledIds.Contains(c.Id) }));
    }

    /// <summary>Получить информацию о курсе по инвайт-коду (для страницы вступления).</summary>
    [HttpGet("by-invite/{code}")]
    [AllowAnonymous]
    public async Task<IActionResult> ByInviteCode(string code, CancellationToken ct)
    {
        var course = await _db.Courses
            .AsNoTracking()
            .Where(c => c.InviteCode == code.ToLowerInvariant())
            .Select(c => new { c.Id, c.Code, c.Title, c.AcademicYear })
            .FirstOrDefaultAsync(ct);

        return course is null ? NotFound(new { error = "Курс не найден или ссылка недействительна." }) : Ok(course);
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

    /// <summary>Записать текущего пользователя на курс по инвайт-коду.</summary>
    [HttpPost("{courseId:guid}/enroll")]
    public async Task<IActionResult> Enroll(Guid courseId, [FromBody] EnrollDto dto, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();

        var course = await _db.Courses.FirstOrDefaultAsync(c => c.Id == courseId, ct);
        if (course is null) return NotFound(new { error = "Course not found." });

        // Validate invite code (teachers/admins bypass this check)
        var isTeacherOrAdmin = User.IsInRole("Teacher") || User.IsInRole("Admin");
        if (!isTeacherOrAdmin)
        {
            if (string.IsNullOrWhiteSpace(dto.InviteCode) ||
                !string.Equals(course.InviteCode, dto.InviteCode.Trim().ToLowerInvariant(), StringComparison.Ordinal))
            {
                return BadRequest(new { error = "Неверный код приглашения." });
            }
        }

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

    public sealed record EnrollDto(string? InviteCode);
}
