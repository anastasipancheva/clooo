using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ScoreHub.Domain.Auth;
using ScoreHub.Infrastructure.Persistence;

namespace ScoreHub.Api.Controllers;

/// <summary>Статистика ассистента: одобренные сессии, счётчик по модулям.</summary>
[ApiController]
[Route("api/assistant")]
[Authorize(Roles = $"{AppRoles.Assistant},{AppRoles.Teacher},{AppRoles.Admin}")]
public sealed class AssistantStatsController : ApiControllerBase
{
    private readonly ScoreHubDbContext _db;
    public AssistantStatsController(ScoreHubDbContext db) { _db = db; }

    /// <summary>Все одобренные заявки текущего ассистента с данными о модуле и курсе.</summary>
    [HttpGet("my-sessions")]
    public async Task<IActionResult> MySessions(CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();

        var sessions = await _db.AssistantApplications
            .AsNoTracking()
            .Where(a => a.AssistantId == uid.Value && a.Status == "Approved")
            .Select(a => new
            {
                a.Id,
                ActivityId = a.ActivityId,
                ActivityTitle = a.Activity.Title,
                ActivityType = a.Activity.Type.ToString(),
                ActivityStatus = a.Activity.Status.ToString(),
                ActivityStartsAt = a.Activity.StartsAt,
                ModuleId = a.Activity.Module.Id,
                ModuleNumber = a.Activity.Module.Number,
                ModuleTitle = a.Activity.Module.Title,
                CourseId = a.Activity.Module.Course.Id,
                CourseCode = a.Activity.Module.Course.Code,
                CourseTitle = a.Activity.Module.Course.Title,
            })
            .ToListAsync(ct);

        // Сортируем в памяти — SQLite не поддерживает ORDER BY DateTimeOffset
        return Ok(sessions.OrderBy(a => a.ActivityStartsAt));
    }
}
