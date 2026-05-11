using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ScoreHub.Application.Abstractions;
using ScoreHub.Domain.Auth;
using ScoreHub.Domain.Entities;
using ScoreHub.Infrastructure.Persistence;

namespace ScoreHub.Api.Controllers;

/// <summary>Авто-генерация команд, назначение ассистентов, обмен студентами, управление ActivityAssistant.</summary>
[ApiController]
[Route("api/teaching")]
[Authorize(Roles = $"{AppRoles.Teacher},{AppRoles.Admin}")]
public sealed class TeamManagementController : ApiControllerBase
{
    private readonly ITeamGenerationService _gen;
    private readonly ScoreHubDbContext _db;

    public TeamManagementController(ITeamGenerationService gen, ScoreHubDbContext db)
    {
        _gen = gen;
        _db = db;
    }

    /// <summary>Случайно раздать активных ассистентов по командам занятия.</summary>
    [HttpPost("activities/{activityId:guid}/assistants/auto-assign")]
    public async Task<IActionResult> AutoAssign(Guid activityId, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        var r = await _gen.AutoAssignAssistants(uid.Value, activityId, ct);
        return r.IsOk ? Ok() : BadRequest(new { error = r.Error });
    }

    /// <summary>Обменять двух студентов между командами (логируется в TeamSwapLog).</summary>
    [HttpPut("activities/{activityId:guid}/teams/swap-member")]
    public async Task<IActionResult> Swap(Guid activityId, [FromBody] SwapDto dto, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        var r = await _gen.SwapMembers(uid.Value, activityId, dto.StudentAId, dto.StudentBId, ct);
        return r.IsOk ? Ok() : BadRequest(new { error = r.Error });
    }

    /// <summary>Задать список активных ассистентов на занятие (полная замена).</summary>
    [HttpPut("activities/{activityId:guid}/active-assistants")]
    public async Task<IActionResult> SetActiveAssistants(Guid activityId, [FromBody] IdListDto2 dto, CancellationToken ct)
    {
        var existing = await _db.ActivityAssistants.Where(a => a.ActivityId == activityId).ToListAsync(ct);
        _db.ActivityAssistants.RemoveRange(existing);

        foreach (var aId in dto.Ids.Distinct())
            _db.ActivityAssistants.Add(new ActivityAssistant { ActivityId = activityId, AssistantId = aId });

        await _db.SaveChangesAsync(ct);
        return Ok();
    }

    /// <summary>Отметить студента отсутствующим (IsAbsent = true → коэф 0.8).</summary>
    [HttpPost("activities/{activityId:guid}/teams/{teamId:guid}/members/{studentId:guid}/absent")]
    public async Task<IActionResult> MarkAbsent(Guid activityId, Guid teamId, Guid studentId, [FromBody] AbsentDto dto, CancellationToken ct)
    {
        var member = await _db.TeamMembers
            .FirstOrDefaultAsync(m => m.TeamId == teamId && m.UserId == studentId, ct);
        if (member is null) return NotFound();

        member.IsAbsent = dto.IsAbsent;
        await _db.SaveChangesAsync(ct);
        return Ok();
    }

    /// <summary>Обновить конфигурацию занятия (видео, баллы, тест).</summary>
    [HttpPatch("activities/{activityId:guid}/config")]
    public async Task<IActionResult> PatchConfig(Guid activityId, [FromBody] ActivityConfigDto dto, CancellationToken ct)
    {
        var activity = await _db.Activities.FirstOrDefaultAsync(a => a.Id == activityId, ct);
        if (activity is null) return NotFound();

        if (dto.PreLectureVideoUrl is not null) activity.PreLectureVideoUrl = dto.PreLectureVideoUrl;
        if (dto.LectureBasePoints is not null) activity.LectureBasePoints = dto.LectureBasePoints.Value;
        if (dto.MiniTestMaxBonus is not null) activity.MiniTestMaxBonus = dto.MiniTestMaxBonus.Value;
        if (dto.MiniTestDurationSeconds is not null) activity.MiniTestDurationSeconds = dto.MiniTestDurationSeconds.Value;

        await _db.SaveChangesAsync(ct);
        return Ok();
    }

    /// <summary>Обновить таблицы КТ-мультипликаторов и/или оценок курса.</summary>
    [HttpPatch("courses/{courseId:guid}/grading-config")]
    public async Task<IActionResult> PatchGradingConfig(Guid courseId, [FromBody] GradingConfigDto dto, CancellationToken ct)
    {
        var course = await _db.Courses.FirstOrDefaultAsync(c => c.Id == courseId, ct);
        if (course is null) return NotFound();

        if (dto.KtMultiplierMapJson is not null) course.KtMultiplierMapJson = dto.KtMultiplierMapJson;
        if (dto.FinalGradingTableJson is not null) course.FinalGradingTableJson = dto.FinalGradingTableJson;

        await _db.SaveChangesAsync(ct);
        return Ok();
    }

    public sealed record SwapDto(Guid StudentAId, Guid StudentBId);
    public sealed record IdListDto2(IReadOnlyList<Guid> Ids);
    public sealed record AbsentDto(bool IsAbsent);
    public sealed record ActivityConfigDto(
        string? PreLectureVideoUrl,
        decimal? LectureBasePoints,
        decimal? MiniTestMaxBonus,
        int? MiniTestDurationSeconds);
    public sealed record GradingConfigDto(string? KtMultiplierMapJson, string? FinalGradingTableJson);
}
