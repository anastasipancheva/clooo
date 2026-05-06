using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ScoreHub.Application.Abstractions;
using ScoreHub.Domain.Auth;

namespace ScoreHub.Api.Controllers;

/// <summary>Домашние задания: создание сдачи, очередь с приоритетами, приём ассистентом.</summary>
[ApiController]
[Route("api")]
[Authorize]
public sealed class HomeworkController : ApiControllerBase
{
    private readonly IHomeworkService _svc;
    public HomeworkController(IHomeworkService svc) => _svc = svc;

    /// <summary>Создать сдачу ДЗ (студент). Группа 1–3 человека, обязательна ссылка на документ.</summary>
    [HttpPost("homework/submissions")]
    public async Task<IActionResult> Create([FromBody] CreateHwDto dto, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        var r = await _svc.CreateSubmission(uid.Value, dto.ActivityId, dto.TaskItemId, dto.DocumentUrl, dto.MemberUserIds, ct);
        return r.IsOk ? Ok(new { id = r.Value }) : BadRequest(new { error = r.Error });
    }

    /// <summary>Очередь ДЗ по занятию (Teacher/Assistant). Отсортирована по приоритетам + FIFO.</summary>
    [HttpGet("activities/{activityId:guid}/homework-queue")]
    [Authorize(Roles = $"{AppRoles.Assistant},{AppRoles.Teacher},{AppRoles.Admin}")]
    public async Task<IActionResult> Queue(Guid activityId, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        var r = await _svc.GetQueue(uid.Value, activityId, ct);
        return r.IsOk ? Ok(r.Value) : BadRequest(new { error = r.Error });
    }

    /// <summary>Начать приём ДЗ (Teacher/Assistant). Фиксирует ReviewStartedAt для таймера 8 минут.</summary>
    [HttpPost("homework/submissions/{submissionId:guid}/review/start")]
    [Authorize(Roles = $"{AppRoles.Assistant},{AppRoles.Teacher},{AppRoles.Admin}")]
    public async Task<IActionResult> StartReview(Guid submissionId, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        var r = await _svc.StartReview(uid.Value, submissionId, ct);
        return r.IsOk ? Ok() : BadRequest(new { error = r.Error });
    }

    /// <summary>Завершить приём: принято или нет.</summary>
    [HttpPost("homework/submissions/{submissionId:guid}/review/complete")]
    [Authorize(Roles = $"{AppRoles.Assistant},{AppRoles.Teacher},{AppRoles.Admin}")]
    public async Task<IActionResult> CompleteReview(Guid submissionId, [FromBody] CompleteHwDto dto, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        var r = await _svc.CompleteReview(uid.Value, submissionId, dto.Accepted, ct);
        return r.IsOk ? Ok() : BadRequest(new { error = r.Error });
    }

    /// <summary>Вернуть в конец очереди (не успели за 8 минут).</summary>
    [HttpPost("homework/submissions/{submissionId:guid}/review/back-to-queue")]
    [Authorize(Roles = $"{AppRoles.Assistant},{AppRoles.Teacher},{AppRoles.Admin}")]
    public async Task<IActionResult> BackToQueue(Guid submissionId, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        var r = await _svc.BackToQueue(uid.Value, submissionId, ct);
        return r.IsOk ? Ok() : BadRequest(new { error = r.Error });
    }

    public sealed record CreateHwDto(
        Guid ActivityId,
        Guid TaskItemId,
        string DocumentUrl,
        IReadOnlyList<Guid> MemberUserIds);

    public sealed record CompleteHwDto(bool Accepted);
}
