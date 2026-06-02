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

        var exists = await _db.AssistantApplications
            .AnyAsync(a => a.ActivityId == activityId && a.AssistantId == uid.Value, ct);
        if (exists) return Conflict(new { error = "Already applied" });

        _db.AssistantApplications.Add(new AssistantApplication {
            Id = Guid.NewGuid(),
            ActivityId = activityId,
            AssistantId = uid.Value,
            Message = dto.Message
        });
        await _db.SaveChangesAsync(ct);
        return Ok();
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
