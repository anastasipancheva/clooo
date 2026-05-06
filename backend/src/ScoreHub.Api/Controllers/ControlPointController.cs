using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ScoreHub.Application.Abstractions;
using ScoreHub.Domain.Auth;

namespace ScoreHub.Api.Controllers;

/// <summary>Контрольная точка (КТ): индивидуальная готовность, очередь по задаче, вызов и приём.</summary>
/// <remarks>Очередь по задаче упорядочена по ReadyAt. Нельзя вызвать студента на вторую задачу, пока он InReview по другой.</remarks>
[ApiController]
[Route("api/activities/{activityId:guid}/kt")]
[Authorize]
public sealed class ControlPointController : ApiControllerBase
{
    private readonly IControlPointService _kt;

    public ControlPointController(IControlPointService kt)
    {
        _kt = kt;
    }

    /// <summary>Студент отмечает готовность сдать конкретную задачу КТ (фиксируется время для очереди).</summary>
    [HttpPost("tasks/{taskItemId:guid}/ready")]
    public async Task<IActionResult> MarkReady(Guid activityId, Guid taskItemId, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        var r = await _kt.MarkTaskReady(uid.Value, activityId, taskItemId, ct);
        return r.IsOk ? Ok() : BadRequest(new { error = r.Error });
    }

    /// <summary>Сводка по своим задачам на этой КТ: статус и примерная позиция в очереди.</summary>
    [HttpGet("my-queue")]
    public async Task<IActionResult> MyQueue(Guid activityId, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        var r = await _kt.GetMyQueue(uid.Value, activityId, ct);
        return r.IsOk ? Ok(r.Value) : BadRequest(new { error = r.Error });
    }

    /// <summary>Очередь по одной задаче КТ для ассистента (закреплённого за задачей) или преподавателя.</summary>
    [HttpGet("tasks/{taskItemId:guid}/queue")]
    [Authorize(Roles = $"{AppRoles.Assistant},{AppRoles.Teacher},{AppRoles.Admin}")]
    public async Task<IActionResult> Queue(Guid activityId, Guid taskItemId, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        var r = await _kt.GetQueueForTask(uid.Value, activityId, taskItemId, ct);
        return r.IsOk ? Ok(r.Value) : BadRequest(new { error = r.Error });
    }

    /// <summary>Вызвать следующего в очереди на сдачу этой задачи (статус InReview, уведомление студенту).</summary>
    [HttpPost("tasks/{taskItemId:guid}/call-next")]
    [Authorize(Roles = $"{AppRoles.Assistant},{AppRoles.Teacher},{AppRoles.Admin}")]
    public async Task<IActionResult> CallNext(Guid activityId, Guid taskItemId, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        var r = await _kt.CallNextStudent(uid.Value, activityId, taskItemId, ct);
        return r.IsOk ? Ok() : BadRequest(new { error = r.Error });
    }

    /// <summary>Завершить индивидуальный приём КТ по submissionId (accepted, result01, defenderCoefficient).</summary>
    /// <remarks>Параметр activityId в маршруте зарезервирован для симметрии URL; проверка привязки к занятию внутри сервиса.</remarks>
    [HttpPost("submissions/{submissionId:guid}/review/complete")]
    [Authorize(Roles = $"{AppRoles.Assistant},{AppRoles.Teacher},{AppRoles.Admin}")]
    public async Task<IActionResult> CompleteReview(
        Guid activityId,
        Guid submissionId,
        [FromBody] KtCompleteDto dto,
        CancellationToken ct)
    {
        _ = activityId;
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        var r = await _kt.CompleteKtReview(
            uid.Value,
            submissionId,
            dto.Accepted,
            dto.Result01,
            dto.DefenderCoefficient,
            ct);
        return r.IsOk ? Ok() : BadRequest(new { error = r.Error });
    }

    public sealed record KtCompleteDto(bool Accepted, int Result01, decimal? DefenderCoefficient);
}
