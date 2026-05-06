using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ScoreHub.Application.Abstractions;
using ScoreHub.Application.Common;
using ScoreHub.Domain.Auth;

namespace ScoreHub.Api.Controllers;

/// <summary>Панель ассистента на паре: вызовы на помощь, очередь командных сдач, приём задачи.</summary>
[ApiController]
[Route("api")]
[Authorize(Roles = $"{AppRoles.Assistant},{AppRoles.Teacher},{AppRoles.Admin}")]
public sealed class AssistantSessionController : ApiControllerBase
{
    private readonly IGroupActivityService _group;

    public AssistantSessionController(IGroupActivityService group)
    {
        _group = group;
    }

    /// <summary>Список открытых вызовов ассистента по занятию (только команды, где вы закреплены; Teacher/Admin видят все).</summary>
    [HttpGet("activities/{activityId:guid}/help-requests")]
    public async Task<IActionResult> OpenHelp(Guid activityId, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        var r = await _group.ListOpenHelpRequests(uid.Value, activityId, ct);
        return r.IsOk ? Ok(r.Value) : BadRequest(new { error = r.Error });
    }

    /// <summary>Закрыть вызов помощи (после консультации).</summary>
    [HttpPost("help-requests/{helpRequestId:guid}/resolve")]
    public async Task<IActionResult> ResolveHelp(Guid helpRequestId, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        var r = await _group.ResolveHelpRequest(uid.Value, helpRequestId, ct);
        return r.IsOk ? Ok() : BadRequest(new { error = r.Error });
    }

    /// <summary>Очередь командных сдач по занятию (ожидают приёма или на приёме).</summary>
    [HttpGet("activities/{activityId:guid}/team-submissions/pending")]
    public async Task<IActionResult> PendingTeamSubs(Guid activityId, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        var r = await _group.ListPendingTeamSubmissions(uid.Value, activityId, ct);
        return r.IsOk ? Ok(r.Value) : BadRequest(new { error = r.Error });
    }

    /// <summary>Начать приём: указать студента-защитника (defenderUserId из состава команды).</summary>
    [HttpPost("submissions/{submissionId:guid}/team-review/start")]
    public async Task<IActionResult> StartTeamReview(Guid submissionId, [FromBody] StartReviewDto dto, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        var r = await _group.StartTeamReview(uid.Value, submissionId, dto.DefenderUserId, ct);
        return r.IsOk ? Ok() : BadRequest(new { error = r.Error });
    }

    /// <summary>Завершить приём: accepted, result01 (0/1), опционально defenderCoefficient 0.8–1.2.</summary>
    [HttpPost("submissions/{submissionId:guid}/team-review/complete")]
    public async Task<IActionResult> CompleteTeamReview(Guid submissionId, [FromBody] CompleteReviewDto dto, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        var r = await _group.CompleteTeamReview(
            uid.Value,
            submissionId,
            dto.Accepted,
            dto.Result01,
            dto.DefenderCoefficient,
            ct);
        return r.IsOk ? Ok() : BadRequest(new { error = r.Error });
    }

    public sealed record StartReviewDto(Guid DefenderUserId);
    public sealed record CompleteReviewDto(bool Accepted, int Result01, decimal? DefenderCoefficient);
}
