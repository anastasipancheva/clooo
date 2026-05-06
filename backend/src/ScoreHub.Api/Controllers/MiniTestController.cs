using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ScoreHub.Application.Abstractions;
using ScoreHub.Domain.Auth;

namespace ScoreHub.Api.Controllers;

/// <summary>Мини-тест в начале лекции (5 минут, до 0.5 бонусных баллов).</summary>
[ApiController]
[Route("api/activities/{activityId:guid}/mini-test")]
[Authorize]
public sealed class MiniTestController : ApiControllerBase
{
    private readonly IMiniTestService _svc;
    public MiniTestController(IMiniTestService svc) => _svc = svc;

    /// <summary>Получить вопросы теста (студент, пока тест открыт). Правильные ответы не возвращаются.</summary>
    [HttpGet]
    public async Task<IActionResult> Get(Guid activityId, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        var r = await _svc.GetForStudent(uid.Value, activityId, ct);
        return r.IsOk ? Ok(r.Value) : BadRequest(new { error = r.Error });
    }

    /// <summary>Сдать ответы студента. Принимается только один раз, до истечения таймера.</summary>
    [HttpPost("submit")]
    public async Task<IActionResult> Submit(Guid activityId, [FromBody] SubmitDto dto, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        var r = await _svc.Submit(uid.Value, activityId, dto.Answers, ct);
        return r.IsOk ? Ok() : BadRequest(new { error = r.Error });
    }

    /// <summary>Добавить вопрос (Teacher/Admin, только до публикации).</summary>
    [HttpPost("questions")]
    [Authorize(Roles = $"{AppRoles.Teacher},{AppRoles.Admin}")]
    public async Task<IActionResult> AddQuestion(Guid activityId, [FromBody] QuestionDto dto, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        var r = await _svc.AddQuestion(uid.Value, activityId, dto.Order, dto.Text, dto.Options, dto.CorrectOptionIndex, ct);
        return r.IsOk ? Ok(new { id = r.Value }) : BadRequest(new { error = r.Error });
    }

    /// <summary>Редактировать вопрос (Teacher/Admin, только до публикации).</summary>
    [HttpPut("questions/{questionId:guid}")]
    [Authorize(Roles = $"{AppRoles.Teacher},{AppRoles.Admin}")]
    public async Task<IActionResult> UpdateQuestion(Guid activityId, Guid questionId, [FromBody] QuestionDto dto, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        var r = await _svc.UpdateQuestion(uid.Value, questionId, dto.Order, dto.Text, dto.Options, dto.CorrectOptionIndex, ct);
        return r.IsOk ? Ok() : BadRequest(new { error = r.Error });
    }

    /// <summary>Удалить вопрос (Teacher/Admin, только до публикации).</summary>
    [HttpDelete("questions/{questionId:guid}")]
    [Authorize(Roles = $"{AppRoles.Teacher},{AppRoles.Admin}")]
    public async Task<IActionResult> DeleteQuestion(Guid activityId, Guid questionId, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        var r = await _svc.DeleteQuestion(uid.Value, questionId, ct);
        return r.IsOk ? Ok() : BadRequest(new { error = r.Error });
    }

    /// <summary>Опубликовать тест: открывает 5-минутный таймер, уведомляет студентов через SignalR.</summary>
    [HttpPost("publish")]
    [Authorize(Roles = $"{AppRoles.Teacher},{AppRoles.Admin}")]
    public async Task<IActionResult> Publish(Guid activityId, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        var r = await _svc.Publish(uid.Value, activityId, ct);
        return r.IsOk ? Ok() : BadRequest(new { error = r.Error });
    }

    public sealed record QuestionDto(int Order, string Text, string[] Options, int CorrectOptionIndex);
    public sealed record SubmitDto(IReadOnlyList<StudentAnswer> Answers);
}
