using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ScoreHub.Application.Abstractions;
using ScoreHub.Domain.Auth;

namespace ScoreHub.Api.Controllers;

/// <summary>Баллы: групповой коэффициент за лекцию, финализация КТ, просмотр итогов.</summary>
[ApiController]
[Route("api")]
[Authorize]
public sealed class ScoringController : ApiControllerBase
{
    private readonly IScoringService _svc;
    public ScoringController(IScoringService svc) => _svc = svc;

    /// <summary>Выставить групповой коэффициент команде за лекцию (0.8–1.2). Пересчитывает TeamGroupScore.</summary>
    [HttpPost("activities/{activityId:guid}/teams/{teamId:guid}/group-score")]
    [Authorize(Roles = $"{AppRoles.Assistant},{AppRoles.Teacher},{AppRoles.Admin}")]
    public async Task<IActionResult> SetGroupScore(Guid activityId, Guid teamId, [FromBody] GroupScoreDto dto, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        var r = await _svc.SetGroupScore(uid.Value, activityId, teamId, dto.GroupCoefficient, ct);
        return r.IsOk ? Ok() : BadRequest(new { error = r.Error });
    }

    /// <summary>Финализировать КТ: применить мультипликатор и пересчитать ModuleScore всем студентам.</summary>
    [HttpPost("activities/{activityId:guid}/kt/finalize")]
    [Authorize(Roles = $"{AppRoles.Teacher},{AppRoles.Admin}")]
    public async Task<IActionResult> FinalizeKt(Guid activityId, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        var r = await _svc.FinalizeKt(uid.Value, activityId, ct);
        return r.IsOk ? Ok() : BadRequest(new { error = r.Error });
    }

    /// <summary>Итоговый балл студента: по модулям + финальная оценка.</summary>
    [HttpGet("courses/{courseId:guid}/students/{studentId:guid}/score")]
    public async Task<IActionResult> StudentScore(Guid courseId, Guid studentId, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        var r = await _svc.GetStudentScore(uid.Value, courseId, studentId, ct);
        return r.IsOk ? Ok(r.Value) : BadRequest(new { error = r.Error });
    }

    /// <summary>Сводная таблица баллов всего потока (Teacher/Assistant/Admin).</summary>
    [HttpGet("courses/{courseId:guid}/scores")]
    [Authorize(Roles = $"{AppRoles.Assistant},{AppRoles.Teacher},{AppRoles.Admin}")]
    public async Task<IActionResult> CourseScores(Guid courseId, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        var r = await _svc.GetCourseScores(uid.Value, courseId, ct);
        return r.IsOk ? Ok(r.Value) : BadRequest(new { error = r.Error });
    }

    public sealed record GroupScoreDto(decimal GroupCoefficient);
}
