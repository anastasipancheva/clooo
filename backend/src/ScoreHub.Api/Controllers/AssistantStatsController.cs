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

    /// <summary>Все заявки текущего ассистента (Pending/Approved/Rejected).</summary>
    [HttpGet("my-applications")]
    public async Task<IActionResult> MyApplications(CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();

        var apps = await _db.AssistantApplications
            .AsNoTracking()
            .Where(a => a.AssistantId == uid.Value)
            .Select(a => new
            {
                a.Id,
                a.ActivityId,
                ActivityTitle = a.Activity.Title,
                ActivityStatus = a.Activity.Status.ToString(),
                a.Status,
                a.Message,
                a.AppliedAt,
                a.ReviewedAt,
                ModuleTitle = a.Activity.Module.Title,
                CourseCode = a.Activity.Module.Course.Code,
            })
            .ToListAsync(ct);

        return Ok(apps);
    }

    /// <summary>Все одобренные заявки текущего ассистента с данными о модуле и курсе.
    /// Преподаватель видит все занятия (без необходимости подавать заявки).</summary>
    [HttpGet("my-sessions")]
    public async Task<IActionResult> MySessions(CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();

        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == uid.Value, ct);
        if (user is null) return Unauthorized();

        var isTeacher = user.Role is ScoreHub.Domain.Enums.UserRole.Teacher or ScoreHub.Domain.Enums.UserRole.Admin;

        if (isTeacher)
        {
            // Преподаватель является ассистентом на всех занятиях автоматически
            var allSessions = await _db.Activities
                .AsNoTracking()
                .Where(a => a.Status != ScoreHub.Domain.Enums.ActivityStatus.Finished)
                .Select(a => new
                {
                    Id = a.Id,
                    ActivityId = a.Id,
                    ActivityTitle = a.Title,
                    ActivityType = a.Type.ToString(),
                    ActivityStatus = a.Status.ToString(),
                    ActivityStartsAt = a.StartsAt,
                    ModuleId = a.Module.Id,
                    ModuleNumber = a.Module.Number,
                    ModuleTitle = a.Module.Title,
                    CourseId = a.Module.Course.Id,
                    CourseCode = a.Module.Course.Code,
                    CourseTitle = a.Module.Course.Title,
                })
                .ToListAsync(ct);
            return Ok(allSessions.OrderBy(a => a.ActivityStartsAt));
        }

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
