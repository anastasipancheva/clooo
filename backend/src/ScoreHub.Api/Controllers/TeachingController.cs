using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ScoreHub.Application.Abstractions;
using ScoreHub.Application.Common;
using ScoreHub.Domain.Auth;
using ScoreHub.Domain.Enums;
using ScoreHub.Infrastructure.Persistence;

namespace ScoreHub.Api.Controllers;

/// <summary>Настройка курса преподавателем: модули, занятия, задачи, команды, закрепление ассистентов.</summary>
/// <remarks>Доступно ролям Teacher и Admin. Используется для сценариев лекции, КТ и занятий с ДЗ.</remarks>
[ApiController]
[Route("api/teaching")]
[Authorize(Roles = $"{AppRoles.Teacher},{AppRoles.Admin}")]
public sealed class TeachingController : ApiControllerBase
{
    private readonly ITeachingSetupService _teaching;
    private readonly ScoreHubDbContext _db;

    public TeachingController(ITeachingSetupService teaching, ScoreHubDbContext db)
    {
        _teaching = teaching;
        _db = db;
    }

    /// <summary>Полная структура курса: модули → занятия → наборы задач → задачи.</summary>
    [HttpGet("courses/{courseId:guid}/full")]
    public async Task<IActionResult> GetCourseFull(Guid courseId, CancellationToken ct)
    {
        var course = await _db.Courses
            .AsNoTracking()
            .Where(c => c.Id == courseId)
            .Select(c => new
            {
                c.Id, c.Code, c.Title, c.AcademicYear,
                modules = c.Modules.OrderBy(m => m.Number).Select(m => new
                {
                    m.Id, m.Number, m.Title, m.StartsAt, m.EndsAt,
                    activities = m.Activities.OrderBy(a => a.StartsAt).Select(a => new
                    {
                        a.Id, a.Type, a.Title, a.StartsAt, a.EndsAt,
                        taskSets = a.TaskSets.OrderBy(ts => ts.Title).Select(ts => new
                        {
                            ts.Id, ts.Title, ts.Published,
                            tasks = ts.Tasks.OrderBy(t => t.Code).Select(t => new
                            {
                                t.Id, t.Code, t.Title, t.Points
                            })
                        })
                    })
                })
            })
            .FirstOrDefaultAsync(ct);

        if (course is null) return NotFound();
        return Ok(course);
    }

    /// <summary>Список студентов, записанных на курс.</summary>
    [HttpGet("courses/{courseId:guid}/enrolled-students")]
    public async Task<IActionResult> GetEnrolledStudents(Guid courseId, CancellationToken ct)
    {
        var students = await _db.CourseEnrollments
            .Where(e => e.CourseId == courseId)
            .Join(_db.Users, e => e.UserId, u => u.Id,
                (e, u) => new { u.Id, u.Email, u.DisplayName, u.Role })
            .OrderBy(u => u.DisplayName)
            .ToListAsync(ct);

        return Ok(students);
    }

    private IActionResult FromOp<T>(OpResult<T> r) =>
        r.IsOk ? Ok(r.Value) : BadRequest(new { error = r.Error });

    private IActionResult FromOpUnit(OpResult<Unit> r) =>
        r.IsOk ? Ok() : BadRequest(new { error = r.Error });

    /// <summary>Создать курс (код, название, учебный год).</summary>
    [HttpPost("courses")]
    public async Task<IActionResult> CreateCourse([FromBody] CreateCourseDto dto, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        return FromOp(await _teaching.CreateCourse(uid.Value, dto.Code, dto.Title, dto.AcademicYear, ct));
    }

    /// <summary>Добавить модуль в курс (номер, название, даты модуля).</summary>
    [HttpPost("courses/{courseId:guid}/modules")]
    public async Task<IActionResult> AddModule(Guid courseId, [FromBody] AddModuleDto dto, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        return FromOp(await _teaching.AddModule(uid.Value, courseId, dto.Number, dto.Title, dto.StartsAt, dto.EndsAt, ct));
    }

    /// <summary>Добавить занятие в модуль: тип (Lecture / ControlPoint / HomeworkSession) и время.</summary>
    [HttpPost("modules/{moduleId:guid}/activities")]
    public async Task<IActionResult> AddActivity(Guid moduleId, [FromBody] AddActivityDto dto, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        return FromOp(await _teaching.AddActivity(
            uid.Value,
            moduleId,
            dto.Type,
            dto.Title,
            dto.StartsAt,
            dto.EndsAt,
            ct));
    }

    /// <summary>Добавить набор задач к занятию (например «Лекция 5» или «КТ — вариант А»).</summary>
    [HttpPost("activities/{activityId:guid}/task-sets")]
    public async Task<IActionResult> AddTaskSet(Guid activityId, [FromBody] AddTaskSetDto dto, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        return FromOp(await _teaching.AddTaskSet(uid.Value, activityId, dto.Title, ct));
    }

    /// <summary>Добавить задачу в набор (код, заголовок, условие, баллы/вес).</summary>
    [HttpPost("task-sets/{taskSetId:guid}/tasks")]
    public async Task<IActionResult> AddTask(Guid taskSetId, [FromBody] AddTaskItemDto dto, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        return FromOp(await _teaching.AddTaskItem(uid.Value, taskSetId, dto.Code, dto.Title, dto.Statement, dto.Points, ct));
    }

    /// <summary>Назначить ассистентов на задачу (для КТ: кто может принимать сдачу по этой задаче). Тело: { "ids": [guid, ...] }.</summary>
    [HttpPut("tasks/{taskId:guid}/assistants")]
    public async Task<IActionResult> SetTaskAssistants(Guid taskId, [FromBody] IdListDto dto, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        return FromOpUnit(await _teaching.SetTaskAssistants(uid.Value, taskId, dto.Ids, ct));
    }

    /// <summary>Создать команду на занятии (лекция или сессия ДЗ).</summary>
    [HttpPost("activities/{activityId:guid}/teams")]
    public async Task<IActionResult> CreateTeam(Guid activityId, [FromBody] CreateTeamDto dto, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        return FromOp(await _teaching.CreateTeam(uid.Value, activityId, dto.Name, ct));
    }

    /// <summary>Задать состав команды (полная замена списка). Тело: { "ids": [guid студентов] }.</summary>
    [HttpPut("teams/{teamId:guid}/members")]
    public async Task<IActionResult> SetMembers(Guid teamId, [FromBody] IdListDto dto, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        return FromOpUnit(await _teaching.SetTeamMembers(uid.Value, teamId, dto.Ids, ct));
    }

    /// <summary>Закрепить ассистентов за командой (кто ведёт команды на паре). Тело: { "ids": [guid] }.</summary>
    [HttpPut("teams/{teamId:guid}/assistant-links")]
    public async Task<IActionResult> SetTeamAssistants(Guid teamId, [FromBody] IdListDto dto, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        return FromOpUnit(await _teaching.SetTeamAssistants(uid.Value, teamId, dto.Ids, ct));
    }

    public sealed record CreateCourseDto(string Code, string Title, string AcademicYear);
    public sealed record AddModuleDto(int Number, string Title, DateTimeOffset StartsAt, DateTimeOffset EndsAt);
    public sealed record AddActivityDto(
        ActivityType Type,
        string Title,
        DateTimeOffset StartsAt,
        DateTimeOffset EndsAt);
    public sealed record AddTaskSetDto(string Title);
    public sealed record AddTaskItemDto(string Code, string Title, string? Statement, decimal Points);
    public sealed record IdListDto(IReadOnlyList<Guid> Ids);
    public sealed record CreateTeamDto(string Name);
}
