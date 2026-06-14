using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ScoreHub.Application.Abstractions;
using ScoreHub.Application.Common;

namespace ScoreHub.Api.Controllers;

/// <summary>Действия студента в команде на лекции / занятии с ДЗ: вызов ассистента, готовность сдать задачу.</summary>
/// <remarks>Достаточно одного члена команды; уведомления получают все участники и закреплённые ассистенты.</remarks>
[ApiController]
[Route("api/teams")]
[Authorize]
public sealed class TeamStudentController : ApiControllerBase
{
    private readonly IGroupActivityService _group;

    public TeamStudentController(IGroupActivityService group)
    {
        _group = group;
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
