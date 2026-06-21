using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ScoreHub.Application.Abstractions;
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
    private readonly INotificationService _notify;
    public AssistantApplicationController(ScoreHubDbContext db, INotificationService notify) { _db = db; _notify = notify; }

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

        var status = await _db.Activities.Where(a => a.Id == activityId).Select(a => a.Status).FirstOrDefaultAsync(ct);
        if (status is Domain.Enums.ActivityStatus.Active or Domain.Enums.ActivityStatus.Finished)
            return BadRequest(new { error = "Занятие уже идёт или завершено — отменить нельзя." });

        // Снимаем заявку и ассистента занятия, затем перераспределяем команды между оставшимися.
        _db.AssistantApplications.Remove(app);
        await _db.SaveChangesAsync(ct);
        await _db.ActivityAssistants
            .Where(aa => aa.ActivityId == activityId && aa.AssistantId == uid.Value)
            .ExecuteDeleteAsync(ct);
        await RebalanceTeamAssistantsAsync(activityId, ct);
        return Ok();
    }

    /// <summary>Добавляет ассистента к занятию и пропорционально перераспределяет команды между всеми ассистентами.</summary>
    private async Task EnsureAssistantAssignedAsync(Guid activityId, Guid assistantId, CancellationToken ct)
    {
        var alreadyActive = await _db.ActivityAssistants
            .AnyAsync(aa => aa.ActivityId == activityId && aa.AssistantId == assistantId, ct);
        if (!alreadyActive)
            _db.ActivityAssistants.Add(new ActivityAssistant { ActivityId = activityId, AssistantId = assistantId });

        await _db.SaveChangesAsync(ct);
        await RebalanceTeamAssistantsAsync(activityId, ct);
    }

    /// <summary>D4 — равномерно (round-robin) распределяет команды занятия между всеми его ассистентами.</summary>
    private async Task RebalanceTeamAssistantsAsync(Guid activityId, CancellationToken ct)
    {
        var assistantIds = await _db.ActivityAssistants
            .Where(aa => aa.ActivityId == activityId)
            .Select(aa => aa.AssistantId)
            .ToListAsync(ct);

        var teamIds = await _db.Teams
            .Where(t => t.ActivityId == activityId)
            .OrderBy(t => t.Name)
            .Select(t => t.Id)
            .ToListAsync(ct);

        if (teamIds.Count == 0) return;

        // Полностью пересобираем закрепления команд занятия.
        await _db.TeamAssistants.Where(ta => teamIds.Contains(ta.TeamId)).ExecuteDeleteAsync(ct);

        if (assistantIds.Count == 0) return;

        for (int i = 0; i < teamIds.Count; i++)
            _db.TeamAssistants.Add(new TeamAssistant { TeamId = teamIds[i], AssistantId = assistantIds[i % assistantIds.Count] });

        await _db.SaveChangesAsync(ct);
    }

    /// <summary>Преподаватель одобряет или отклоняет заявку.</summary>
    [HttpPut("{appId:guid}/review")]
    [Authorize(Roles = $"{AppRoles.Teacher},{AppRoles.Admin}")]
    public async Task<IActionResult> Review(Guid activityId, Guid appId, [FromBody] ReviewDto dto, CancellationToken ct)
    {
        var app = await _db.AssistantApplications
            .FirstOrDefaultAsync(a => a.Id == appId && a.ActivityId == activityId, ct);
        if (app is null) return NotFound();

        // D5 — решение обратимо (на случай миссклика): можно повторно одобрить ранее отклонённую
        // или, наоборот, отозвать одобрение.
        app.Status = dto.Approved ? "Approved" : "Rejected";
        app.ReviewedAt = DateTimeOffset.UtcNow;

        if (dto.Approved)
        {
            var alreadyActive = await _db.ActivityAssistants
                .AnyAsync(aa => aa.ActivityId == activityId && aa.AssistantId == app.AssistantId, ct);
            if (!alreadyActive)
                _db.ActivityAssistants.Add(new ActivityAssistant { ActivityId = activityId, AssistantId = app.AssistantId });
            await _db.SaveChangesAsync(ct);
        }
        else
        {
            // Снимаем ассистента с занятия (и его командные закрепления — через ребаланс ниже).
            await _db.SaveChangesAsync(ct);
            await _db.ActivityAssistants
                .Where(aa => aa.ActivityId == activityId && aa.AssistantId == app.AssistantId)
                .ExecuteDeleteAsync(ct);
        }

        // D4 — пропорционально перераспределяем команды между актуальным составом ассистентов.
        await RebalanceTeamAssistantsAsync(activityId, ct);

        // Уведомляем ассистента о решении.
        var activityTitle = await _db.Activities.Where(a => a.Id == activityId).Select(a => a.Title).FirstOrDefaultAsync(ct);
        await _notify.NotifyManyAsync(
            new[] { app.AssistantId },
            dto.Approved ? "AssistantApproved" : "AssistantRejected",
            dto.Approved ? $"Ваша заявка ассистентом одобрена: {activityTitle}" : $"Ваша заявка ассистентом отклонена: {activityTitle}",
            null,
            ct);
        return Ok();
    }

    public sealed record ApplyDto(string? Message);
    public sealed record ReviewDto(bool Approved);
}
