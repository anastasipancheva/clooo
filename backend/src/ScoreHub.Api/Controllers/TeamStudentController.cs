using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ScoreHub.Application.Abstractions;
using ScoreHub.Application.Common;
using ScoreHub.Infrastructure.Persistence;

namespace ScoreHub.Api.Controllers;

/// <summary>Действия студента в команде на лекции / занятии с ДЗ: вызов ассистента, готовность сдать задачу.</summary>
/// <remarks>Достаточно одного члена команды; уведомления получают все участники и закреплённые ассистенты.</remarks>
[ApiController]
[Route("api/teams")]
[Authorize]
public sealed class TeamStudentController : ApiControllerBase
{
    private readonly IGroupActivityService _group;
    private readonly ScoreHubDbContext _db;

    public TeamStudentController(IGroupActivityService group, ScoreHubDbContext db)
    {
        _group = group;
        _db = db;
    }

    /// <summary>Команда текущего пользователя на занятии.</summary>
    [HttpGet("/api/activities/{activityId:guid}/my-team")]
    public async Task<IActionResult> MyTeam(Guid activityId, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();

        var team = await _db.Teams
            .AsNoTracking()
            .Include(t => t.Members)
            .Include(t => t.Assistants)
            .Where(t => t.ActivityId == activityId && t.Members.Any(m => m.UserId == uid.Value))
            .FirstOrDefaultAsync(ct);

        if (team is null) return NotFound(new { error = "Team not found for current user on this activity." });

        // Load tasks from published task sets of the activity
        var tasks = await _db.TaskSets
            .AsNoTracking()
            .Where(ts => ts.ActivityId == activityId && ts.Published)
            .SelectMany(ts => ts.Tasks)
            .Select(tk => new {
                tk.Id,
                tk.Code,
                tk.Title,
                tk.Points
            })
            .ToListAsync(ct);

        // Load submission statuses for this team
        var subs = await _db.TaskSubmissions
            .AsNoTracking()
            .Where(s => s.TeamId == team.Id && s.ActivityId == activityId)
            .Select(s => new { s.TaskItemId, status = s.Status.ToString() })
            .ToListAsync(ct);

        var subMap = subs.GroupBy(s => s.TaskItemId)
            .ToDictionary(g => g.Key, g => g.First().status);

        return Ok(new {
            id = team.Id,
            name = team.Name,
            tasks = tasks.Select(tk => new {
                tk.Id,
                tk.Code,
                tk.Title,
                tk.Points,
                status = subMap.GetValueOrDefault(tk.Id, "NotStarted")
            })
        });
    }

    /// <summary>Вызвать ассистента на консультацию (опционально текст в message).</summary>
    [HttpPost("{teamId:guid}/help-requests")]
    public async Task<IActionResult> RequestHelp(Guid teamId, [FromBody] HelpBodyDto? dto, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        var r = await _group.RequestAssistantHelp(uid.Value, teamId, dto?.Message, ct);
        return r.IsOk ? Ok(new { id = r.Value }) : BadRequest(new { error = r.Error });
    }

    /// <summary>Отметить готовность сдать задачу от имени команды; фиксируется время для очереди.</summary>
    [HttpPost("{teamId:guid}/tasks/{taskItemId:guid}/ready")]
    public async Task<IActionResult> MarkReady(Guid teamId, Guid taskItemId, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        var r = await _group.MarkTeamTaskReady(uid.Value, teamId, taskItemId, ct);
        return r.IsOk ? Ok() : BadRequest(new { error = r.Error });
    }

    public sealed record HelpBodyDto(string? Message);
}
