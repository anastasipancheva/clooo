using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ScoreHub.Infrastructure.Persistence;

namespace ScoreHub.Api.Controllers;

/// <summary>Список курсов (чтение).</summary>
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
}
