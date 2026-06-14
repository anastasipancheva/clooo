using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ScoreHub.Domain.Auth;
using ScoreHub.Domain.Entities;
using ScoreHub.Infrastructure.Persistence;

namespace ScoreHub.Api.Controllers;

[ApiController]
[Route("api/activities/{activityId:guid}/assistant-applications")]
[Authorize]
public sealed class AssistantApplicationController : ApiControllerBase
{
    private readonly ScoreHubDbContext _db;
    public AssistantApplicationController(ScoreHubDbContext db) { _db = db; }

    /// <summary>Преподаватель просматривает все заявки на занятие.</summary>
    [HttpGet]
    [Authorize(Roles = $"{AppRoles.Teacher},{AppRoles.Admin}")]
    public async Task<IActionResult> List(Guid activityId, CancellationToken ct)
    {
        var apps = await _db.AssistantApplications
            .AsNoTracking()
            .Where(a => a.ActivityId == activityId)
            .Select(a => new {
                a.Id, a.AssistantId,
                assistantName = a.Assistant.DisplayName,
                assistantEmail = a.Assistant.Email,
                a.Status, a.Message, a.AppliedAt, a.ReviewedAt
            })
            .ToListAsync(ct);
        return Ok(apps);
    }

    /// <summary>Ассистент подаёт заявку на занятие.</summary>
    [HttpPost]
    [Authorize(Roles = $"{AppRoles.Assistant},{AppRoles.Teacher},{AppRoles.Admin}")]
    public async Task<IActionResult> Apply(Guid activityId, [FromBody] ApplyDto dto, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();

        var isTeacher = User.IsInRole(AppRoles.Teacher) || User.IsInRole(AppRoles.Admin);

        var activity = await _db.Activities
            .Where(a => a.Id == activityId)
            .Select(a => new { a.Id, a.Status, CourseId = a.Module.CourseId })
            .FirstOrDefaultAsync(ct);
        if (activity is null) return NotFound();

        // #8 — нельзя подать заявку на уже завершённое занятие.
        if (activity.Status == Domain.Enums.ActivityStatus.Finished)
            return BadRequest(new { error = "Занятие уже завершено." });

        if (!isTeacher)
        {
            // Ассистент может подавать заявку только на курс, в котором он записан
            var enrolled = await _db.CourseEnrollments
                .AnyAsync(e => e.CourseId == activity.CourseId && e.UserId == uid.Value, ct);
            if (!enrolled)
                return Forbid();
        }

        var existing = await _db.AssistantApplications
            .FirstOrDefaultAsync(a => a.ActivityId == activityId && a.AssistantId == uid.Value, ct);
        if (existing is not null)
        {
            // #13 — преподаватель не должен «застревать» в Pending: переводим в Approved сразу.
            if (isTeacher && existing.Status != "Approved")
            {
                existing.Status = "Approved";
                existing.ReviewedAt = DateTimeOffset.UtcNow;
                await EnsureAssistantAssignedAsync(activityId, uid.Value, ct);
                await _db.SaveChangesAsync(ct);
                return Ok();
            }
            return Conflict(new { error = "Already applied" });
        }

        // #13 — преподаватель становится ассистентом сразу, без ожидания одобрения.
        _db.AssistantApplications.Add(new AssistantApplication {
            Id = Guid.NewGuid(),
            ActivityId = activityId,
            AssistantId = uid.Value,
            Message = dto.Message,
            Status = isTeacher ? "Approved" : "Pending",
            ReviewedAt = isTeacher ? DateTimeOffset.UtcNow : null
        });

        if (isTeacher)
            await EnsureAssistantAssignedAsync(activityId, uid.Value, ct);

        await _db.SaveChangesAsync(ct);
        return Ok();
    }

    /// <summary>Ассистент отменяет свою ещё не одобренную заявку.</summary>
    [HttpDelete("mine")]
    [Authorize(Roles = $"{AppRoles.Assistant},{AppRoles.Teacher},{AppRoles.Admin}")]
    public async Task<IActionResult> CancelMine(Guid activityId, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();

        var app = await _db.AssistantApplications
            .FirstOrDefaultAsync(a => a.ActivityId == activityId && a.AssistantId == uid.Value, ct);
        if (app is null) return NotFound();
        if (app.Status == "Approved")
            return BadRequest(new { error = "Заявка уже одобрена, отменить нельзя." });

        _db.AssistantApplications.Remove(app);
        await _db.SaveChangesAsync(ct);
        return Ok();
    }

    /// <summary>Закрепляет ассистента за занятием и за командами без ассистента (для авто-назначения).</summary>
    private async Task EnsureAssistantAssignedAsync(Guid activityId, Guid assistantId, CancellationToken ct)
    {
        var alreadyActive = await _db.ActivityAssistants
            .AnyAsync(aa => aa.ActivityId == activityId && aa.AssistantId == assistantId, ct);
        if (!alreadyActive)
            _db.ActivityAssistants.Add(new ActivityAssistant { ActivityId = activityId, AssistantId = assistantId });

        var teamsWithoutAssistant = await _db.Teams
            .Include(t => t.Assistants)
            .Where(t => t.ActivityId == activityId && !t.Assistants.Any())
            .ToListAsync(ct);
        foreach (var team in teamsWithoutAssistant)
            team.Assistants.Add(new TeamAssistant { AssistantId = assistantId });
    }

    /// <summary>Преподаватель одобряет или отклоняет заявку.</summary>
    [HttpPut("{appId:guid}/review")]
    [Authorize(Roles = $"{AppRoles.Teacher},{AppRoles.Admin}")]
    public async Task<IActionResult> Review(Guid activityId, Guid appId, [FromBody] ReviewDto dto, CancellationToken ct)
    {
        var app = await _db.AssistantApplications
            .FirstOrDefaultAsync(a => a.Id == appId && a.ActivityId == activityId, ct);
        if (app is null) return NotFound();

        app.Status = dto.Approved ? "Approved" : "Rejected";
        app.ReviewedAt = DateTimeOffset.UtcNow;

        if (dto.Approved)
        {
            var alreadyActive = await _db.ActivityAssistants
                .AnyAsync(aa => aa.ActivityId == activityId && aa.AssistantId == app.AssistantId, ct);
            if (!alreadyActive)
                _db.ActivityAssistants.Add(new ActivityAssistant { ActivityId = activityId, AssistantId = app.AssistantId });

            // Auto-assign assistant to teams that have no assistant yet (1 assistant per team)
            var teamsWithoutAssistant = await _db.Teams
                .Include(t => t.Assistants)
                .Where(t => t.ActivityId == activityId && !t.Assistants.Any())
                .ToListAsync(ct);

            foreach (var team in teamsWithoutAssistant)
            {
                team.Assistants.Add(new Domain.Entities.TeamAssistant { AssistantId = app.AssistantId });
            }
        }

        await _db.SaveChangesAsync(ct);
        return Ok();
    }

    public sealed record ApplyDto(string? Message);
    public sealed record ReviewDto(bool Approved);
}
