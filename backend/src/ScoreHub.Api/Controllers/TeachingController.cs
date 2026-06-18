using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ScoreHub.Application.Abstractions;
using ScoreHub.Application.Common;
using ScoreHub.Infrastructure.Services;
using ScoreHub.Domain.Auth;
using ScoreHub.Domain.Entities;
using ScoreHub.Domain.Enums;
using ScoreHub.Infrastructure.Persistence;
using UserRole = ScoreHub.Domain.Enums.UserRole;

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
    private readonly INotificationService _notifications;
    private readonly ICourseTemplateService _svc;
    private readonly IScoringService _scoring;

    public TeachingController(ITeachingSetupService teaching, ScoreHubDbContext db, INotificationService notifications, ICourseTemplateService svc, IScoringService scoring)
    {
        _teaching = teaching;
        _db = db;
        _notifications = notifications;
        _svc = svc;
        _scoring = scoring;
    }

    private IActionResult FromOp<T>(OpResult<T> r) =>
        r.IsOk ? Ok(r.Value) : BadRequest(new { error = r.Error });

    private IActionResult FromOpUnit(OpResult<Unit> r) =>
        r.IsOk ? Ok() : BadRequest(new { error = r.Error });

    /// <summary>Получить полное дерево курса: модули > занятия > наборы задач > задачи.</summary>
    [HttpGet("courses/{courseId:guid}/structure")]
    public async Task<IActionResult> GetStructure(Guid courseId, CancellationToken ct)
    {
        // Не используем OrderBy по DateTimeOffset — SQLite это не поддерживает.
        // Сортировку активностей делаем в памяти после загрузки.
        var course = await _db.Courses
            .AsNoTracking()
            .Where(c => c.Id == courseId)
            .Select(c => new
            {
                c.Id,
                c.Code,
                c.Title,
                c.AcademicYear,
                Modules = c.Modules
                    .OrderBy(m => m.Number)
                    .Select(m => new
                    {
                        m.Id,
                        m.Number,
                        m.Title,
                        m.StartsAt,
                        m.EndsAt,
                        Activities = m.Activities
                            .Select(a => new
                            {
                                a.Id,
                                a.Title,
                                Type = a.Type.ToString(),
                                a.StartsAt,
                                a.EndsAt,
                                a.PreLectureVideoUrl,
                                a.TheoryTestUrl,
                                a.TaskFileUrl,
                                a.TaskCount,
                                a.Status,
                                TaskSets = a.TaskSets
                                    .Select(ts => new
                                    {
                                        ts.Id,
                                        ts.Title,
                                        ts.Published,
                                        Tasks = ts.Tasks.Select(t => new
                                        {
                                            t.Id,
                                            t.Code,
                                            t.Title,
                                            t.Points
                                        }).ToList()
                                    }).ToList()
                            }).ToList()
                    }).ToList()
            })
            .FirstOrDefaultAsync(ct);

        if (course is null) return NotFound();

        // Сортируем занятия в памяти
        var result = new
        {
            course.Id,
            course.Code,
            course.Title,
            course.AcademicYear,
            Modules = course.Modules.Select(m => new
            {
                m.Id,
                m.Number,
                m.Title,
                m.StartsAt,
                m.EndsAt,
                Activities = m.Activities.OrderBy(a => a.StartsAt).ToList()
            }).ToList()
        };

        return Ok(result);
    }

    /// <summary>Создать курс (код, название, учебный год).</summary>
    [HttpPost("courses")]
    public async Task<IActionResult> CreateCourse([FromBody] CreateCourseDto dto, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        return FromOp(await _teaching.CreateCourse(uid.Value, dto.Code, dto.Title, dto.AcademicYear, ct));
    }

    /// <summary>Получить инвайт-код и ссылку курса.</summary>
    [HttpGet("courses/{courseId:guid}/invite")]
    public async Task<IActionResult> GetInvite(Guid courseId, CancellationToken ct)
    {
        var course = await _db.Courses.AsNoTracking()
            .Select(c => new { c.Id, c.InviteCode })
            .FirstOrDefaultAsync(c => c.Id == courseId, ct);
        if (course is null) return NotFound();
        return Ok(new { inviteCode = course.InviteCode });
    }

    /// <summary>Регенерировать инвайт-код курса.</summary>
    [HttpPost("courses/{courseId:guid}/invite/regenerate")]
    public async Task<IActionResult> RegenerateInvite(Guid courseId, CancellationToken ct)
    {
        var course = await _db.Courses.FirstOrDefaultAsync(c => c.Id == courseId, ct);
        if (course is null) return NotFound();
        course.InviteCode = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(4)).ToLowerInvariant();
        await _db.SaveChangesAsync(ct);
        return Ok(new { inviteCode = course.InviteCode });
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

    /// <summary>Перевести занятие в статус Active (начать пару). Отправляет уведомление всем записанным студентам.</summary>
    [HttpPost("activities/{activityId:guid}/start")]
    public async Task<IActionResult> StartActivity(Guid activityId, CancellationToken ct)
    {
        var activity = await _db.Activities
            .Include(a => a.Module)
            .FirstOrDefaultAsync(a => a.Id == activityId, ct);
        if (activity is null) return NotFound();

        if (activity.Status == ActivityStatus.Finished)
            return BadRequest(new { error = "Занятие уже завершено." });

        // #11 — нельзя начать занятие, время которого уже прошло.
        if (activity.EndsAt < DateTimeOffset.UtcNow)
            return BadRequest(new { error = "Нельзя начать занятие, время которого уже прошло." });

        // Лекцию нельзя начать без команд (для ДЗ-сессий команды не используются).
        if (activity.Type == ActivityType.Lecture)
        {
            var hasTeams = await _db.Teams.AnyAsync(t => t.ActivityId == activityId, ct);
            if (!hasTeams)
                return BadRequest(new { error = "Сначала сформируйте команды для лекции." });
        }

        activity.Status = ActivityStatus.Active;

        // B5 — команды без ассистента получают преподавателя, который начал занятие.
        var teacherId = CurrentUserId;
        if (teacherId is not null && activity.Type == ActivityType.Lecture)
        {
            var teamsNoAssistant = await _db.Teams
                .Include(t => t.Assistants)
                .Where(t => t.ActivityId == activityId && !t.Assistants.Any())
                .ToListAsync(ct);

            if (teamsNoAssistant.Count > 0)
            {
                var teacherAssigned = await _db.ActivityAssistants
                    .AnyAsync(aa => aa.ActivityId == activityId && aa.AssistantId == teacherId.Value, ct);
                if (!teacherAssigned)
                    _db.ActivityAssistants.Add(new ActivityAssistant { ActivityId = activityId, AssistantId = teacherId.Value });

                foreach (var team in teamsNoAssistant)
                    team.Assistants.Add(new TeamAssistant { AssistantId = teacherId.Value });
            }
        }

        await _db.SaveChangesAsync(ct);

        // Уведомления — некритичны, не блокируем ответ при ошибке SignalR/DB
        try
        {
            // Уведомление о начале занятия (со ссылкой на тест) получают только студенты,
            // записанные на курс. Ассистентам/преподавателям оно не приходит.
            var studentIds = await _db.CourseEnrollments
                .Where(e => e.CourseId == activity.Module.CourseId)
                .Join(_db.Users, e => e.UserId, u => u.Id, (e, u) => u)
                .Where(u => u.Role == UserRole.Student)
                .Select(u => u.Id)
                .ToListAsync(ct);

            if (studentIds.Count > 0)
            {
                string? body = activity.TheoryTestUrl is not null
                    ? $"Ссылка на тест: {activity.TheoryTestUrl}"
                    : null;
                await _notifications.NotifyManyAsync(
                    studentIds,
                    "ActivityStarted",
                    $"Занятие началось: {activity.Title}",
                    body,
                    ct);
            }
        }
        catch { /* уведомления некритичны */ }

        return Ok(new { theoryTestUrl = activity.TheoryTestUrl });
    }

    /// <summary>Перевести занятие в статус Finished (завершить пару).</summary>
    [HttpPost("activities/{activityId:guid}/finish")]
    public async Task<IActionResult> FinishActivity(Guid activityId, CancellationToken ct)
    {
        var activity = await _db.Activities.FirstOrDefaultAsync(a => a.Id == activityId, ct);
        if (activity is null) return NotFound();
        activity.Status = ActivityStatus.Finished;
        await _db.SaveChangesAsync(ct);

        // Сразу начисляем баллы за модуль (лекция/ДЗ), не дожидаясь финализации КТ.
        try { await _scoring.RecomputeModuleScoresForActivity(activityId, ct); }
        catch { /* пересчёт некритичен для ответа */ }

        return Ok();
    }

    /// <summary>Массовая запись студентов по списку email-адресов. Тело: { "emails": ["a@b.com", ...] }.</summary>
    [HttpPost("courses/{courseId:guid}/enroll-bulk")]
    public async Task<IActionResult> EnrollBulk(Guid courseId, [FromBody] EnrollBulkDto dto, CancellationToken ct)
    {
        if (dto?.Emails is null || dto.Emails.Count == 0)
            return BadRequest(new { error = "Emails list is required." });

        var course = await _db.Courses.FirstOrDefaultAsync(c => c.Id == courseId, ct);
        if (course is null) return NotFound();

        var emails = dto.Emails
            .Where(e => e is not null)
            .Select(e => e.Trim().ToLowerInvariant())
            .Where(e => e.Length > 0)
            .Distinct()
            .ToList();

        if (emails.Count == 0)
            return BadRequest(new { error = "No valid emails provided." });

        var users = await _db.Users.Where(u => emails.Contains(u.Email)).ToListAsync(ct);

        var existingList = await _db.CourseEnrollments
            .Where(e => e.CourseId == courseId)
            .Select(e => e.UserId)
            .ToListAsync(ct);
        var existing = existingList.ToHashSet();

        int added = 0;
        foreach (var user in users)
        {
            if (existing.Contains(user.Id)) continue;
            _db.CourseEnrollments.Add(new CourseEnrollment
            {
                CourseId = courseId,
                UserId = user.Id,
                EnrolledAt = DateTimeOffset.UtcNow
            });
            added++;
        }

        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (Microsoft.EntityFrameworkCore.DbUpdateException ex)
        {
            return StatusCode(500, new { error = $"DB error: {ex.InnerException?.Message ?? ex.Message}" });
        }

        return Ok(new { added, notFound = emails.Count - users.Count });
    }

    /// <summary>Все занятия курса для преподавательского расписания.</summary>
    [HttpGet("courses/{courseId:guid}/activities")]
    public async Task<IActionResult> GetCourseActivities(Guid courseId, CancellationToken ct)
    {
        // OrderBy(StartsAt) убран из SQL — SQLite не поддерживает ORDER BY DateTimeOffset.
        // Сортируем в памяти после ToListAsync.
        var activities = await _db.Activities
            .AsNoTracking()
            .Where(a => a.Module.CourseId == courseId)
            .Select(a => new {
                a.Id, a.Title, a.Type,
                typeLabel = a.Type == ActivityType.Lecture ? "Лекция"
                    : a.Type == ActivityType.ControlPoint ? "КТ" : "ДЗ-сессия",
                status = a.Status.ToString(),
                a.StartsAt, a.EndsAt,
                a.PreLectureVideoUrl,
                a.TheoryTestUrl,
                a.TaskFileUrl,
                a.TaskCount,
                moduleTitle = a.Module.Title,
                moduleNumber = a.Module.Number,
                moduleId = a.Module.Id
            })
            .ToListAsync(ct);

        return Ok(activities.OrderBy(a => a.StartsAt));
    }

    /// <summary>Удалить модуль вместе со всеми занятиями, наборами задач и задачами.</summary>
    [HttpDelete("modules/{moduleId:guid}")]
    public async Task<IActionResult> DeleteModule(Guid moduleId, CancellationToken ct)
    {
        var module = await _db.Modules.FirstOrDefaultAsync(m => m.Id == moduleId, ct);
        if (module is null) return NotFound();

        // SQLite не форсирует FK по умолчанию — удаляем вручную по порядку зависимостей
        var activityIds = await _db.Activities
            .Where(a => a.ModuleId == moduleId)
            .Select(a => a.Id)
            .ToListAsync(ct);

        if (activityIds.Count > 0)
        {
            var taskSetIds = await _db.TaskSets
                .Where(ts => activityIds.Contains(ts.ActivityId))
                .Select(ts => ts.Id)
                .ToListAsync(ct);

            if (taskSetIds.Count > 0)
            {
                await _db.TaskAssistants
                    .Where(t => taskSetIds.Contains(t.TaskItemId))
                    .ExecuteDeleteAsync(ct);
                await _db.TaskItems
                    .Where(t => taskSetIds.Contains(t.TaskSetId))
                    .ExecuteDeleteAsync(ct);
                await _db.TaskSets
                    .Where(ts => taskSetIds.Contains(ts.Id))
                    .ExecuteDeleteAsync(ct);
            }

            var teamIds = await _db.Teams
                .Where(t => activityIds.Contains(t.ActivityId))
                .Select(t => t.Id)
                .ToListAsync(ct);

            if (teamIds.Count > 0)
            {
                await _db.TeamMembers.Where(m => teamIds.Contains(m.TeamId)).ExecuteDeleteAsync(ct);
                await _db.TeamAssistants.Where(a => teamIds.Contains(a.TeamId)).ExecuteDeleteAsync(ct);
                await _db.Teams.Where(t => teamIds.Contains(t.Id)).ExecuteDeleteAsync(ct);
            }

            await _db.MiniTestAnswers
                .Where(a => activityIds.Contains(a.ActivityId))
                .ExecuteDeleteAsync(ct);
            await _db.MiniTestQuestions
                .Where(q => activityIds.Contains(q.ActivityId))
                .ExecuteDeleteAsync(ct);
            await _db.ActivityAssistants
                .Where(a => activityIds.Contains(a.ActivityId))
                .ExecuteDeleteAsync(ct);
            await _db.AssistantApplications
                .Where(a => activityIds.Contains(a.ActivityId))
                .ExecuteDeleteAsync(ct);
            await _db.Activities
                .Where(a => activityIds.Contains(a.Id))
                .ExecuteDeleteAsync(ct);
        }

        _db.Modules.Remove(module);
        await _db.SaveChangesAsync(ct);
        return Ok();
    }

    /// <summary>Удалить курс вместе со всеми модулями, занятиями и задачами.</summary>
    [HttpDelete("courses/{courseId:guid}")]
    public async Task<IActionResult> DeleteCourse(Guid courseId, CancellationToken ct)
    {
        var course = await _db.Courses.FirstOrDefaultAsync(c => c.Id == courseId, ct);
        if (course is null) return NotFound();
        _db.Courses.Remove(course);
        await _db.SaveChangesAsync(ct);
        return Ok();
    }

    /// <summary>Обновить название и даты модуля.</summary>
    [HttpPatch("modules/{moduleId:guid}")]
    public async Task<IActionResult> PatchModule(Guid moduleId, [FromBody] PatchModuleDto dto, CancellationToken ct)
    {
        var module = await _db.Modules.FirstOrDefaultAsync(m => m.Id == moduleId, ct);
        if (module is null) return NotFound();

        var newStart = dto.StartsAt ?? module.StartsAt;
        var newEnd   = dto.EndsAt   ?? module.EndsAt;
        if (newEnd < newStart)
            return BadRequest(new { error = "Дата окончания модуля раньше даты начала." });

        // C2 — модули не должны пересекаться по датам больше чем на 1 день.
        var others = await _db.Modules
            .Where(x => x.CourseId == module.CourseId && x.Id != moduleId)
            .Select(x => new { x.StartsAt, x.EndsAt }).ToListAsync(ct);
        foreach (var o in others)
        {
            var overlapStart = newStart > o.StartsAt ? newStart : o.StartsAt;
            var overlapEnd = newEnd < o.EndsAt ? newEnd : o.EndsAt;
            if (overlapEnd - overlapStart > TimeSpan.FromDays(1))
                return BadRequest(new { error = "Модули не должны пересекаться по датам более чем на 1 день." });
        }

        if (dto.Title is not null) module.Title = dto.Title.Trim();
        module.StartsAt = newStart;
        module.EndsAt   = newEnd;
        await _db.SaveChangesAsync(ct);
        return Ok();
    }

    /// <summary>Обновить название, тип и даты занятия.</summary>
    [HttpPatch("activities/{activityId:guid}")]
    public async Task<IActionResult> PatchActivity(Guid activityId, [FromBody] PatchActivityDto dto, CancellationToken ct)
    {
        var activity = await _db.Activities.Include(a => a.Module).FirstOrDefaultAsync(a => a.Id == activityId, ct);
        if (activity is null) return NotFound();

        var newStart = dto.StartsAt ?? activity.StartsAt;
        var newEnd   = dto.EndsAt   ?? activity.EndsAt;
        if (newEnd < newStart)
            return BadRequest(new { error = "Дата окончания занятия раньше даты начала." });
        if (newStart < activity.Module.StartsAt || newEnd > activity.Module.EndsAt)
            return BadRequest(new { error = "Даты занятия должны быть внутри дат модуля." });

        if (dto.Title is not null)    activity.Title    = dto.Title.Trim();
        activity.StartsAt = newStart;
        activity.EndsAt   = newEnd;
        await _db.SaveChangesAsync(ct);
        return Ok();
    }

    /// <summary>Сохранить курс как новый шаблон.</summary>
    [HttpPost("courses/{courseId:guid}/save-as-template")]
    public async Task<IActionResult> SaveAsTemplate(Guid courseId, [FromBody] SaveAsTemplateDto dto, CancellationToken ct)
    {
        var course = await _db.Courses
            .Include(c => c.Modules).ThenInclude(m => m.Activities).ThenInclude(a => a.TaskSets).ThenInclude(ts => ts.Tasks)
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == courseId, ct);
        if (course is null) return NotFound();

        var req = new CreateTemplateRequest(
            dto.Title ?? course.Title,
            dto.Description,
            course.Modules.OrderBy(m => m.Number).Select(m => new TemplateModuleDto(
                m.Number,
                m.Title,
                m.Activities.OrderBy(a => a.StartsAt).Select(a => new TemplateActivityDto(
                    (int)a.Type,
                    a.Title,
                    a.TaskFileUrl,
                    a.TheoryTestUrl,
                    a.TaskSets.SelectMany(ts => ts.Tasks)
                              .Select(t => new TemplateTaskDto(t.Code, t.Title, t.Points))
                              .ToList()
                )).ToList(),
                m.StartsAt,
                m.EndsAt
            )).ToList()
        );

        var id = await _svc.CreateAsync(req);
        return Ok(new { id });
    }

    /// <summary>Обновить материалы занятия (видео, тест, файл задач).</summary>
    [HttpPatch("activities/{activityId:guid}/materials")]
    public async Task<IActionResult> PatchMaterials(Guid activityId, [FromBody] PatchMaterialsDto dto, CancellationToken ct)
    {
        var activity = await _db.Activities.FirstOrDefaultAsync(a => a.Id == activityId, ct);
        if (activity is null) return NotFound();
        if (dto.PreLectureVideoUrl is not null) activity.PreLectureVideoUrl = dto.PreLectureVideoUrl == "" ? null : dto.PreLectureVideoUrl;
        if (dto.TheoryTestUrl is not null) activity.TheoryTestUrl = dto.TheoryTestUrl == "" ? null : dto.TheoryTestUrl;
        if (dto.TaskFileUrl is not null) activity.TaskFileUrl = dto.TaskFileUrl == "" ? null : dto.TaskFileUrl;
        if (dto.TaskCount.HasValue)
        {
            if (dto.TaskCount.Value < 0) return BadRequest(new { error = "Количество задач не может быть отрицательным." });
            activity.TaskCount = dto.TaskCount.Value;
        }

        // Пункт 5 — баллы за каждую задачу (по умолчанию 1). Синхронизируем служебный набор «Задачи».
        if (dto.TaskPoints is { } pts)
        {
            if (pts.Any(p => p < 0)) return BadRequest(new { error = "Баллы за задачу не могут быть отрицательными." });
            activity.TaskCount = pts.Count;

            var taskSet = await _db.TaskSets.Include(ts => ts.Tasks)
                .FirstOrDefaultAsync(ts => ts.ActivityId == activityId && ts.Title == "Задачи", ct);
            if (taskSet is null)
            {
                taskSet = new TaskSet { Id = Guid.NewGuid(), ActivityId = activityId, Title = "Задачи", Published = true };
                _db.TaskSets.Add(taskSet);
            }
            for (int i = 0; i < pts.Count; i++)
            {
                var code = (i + 1).ToString();
                var item = taskSet.Tasks.FirstOrDefault(t => t.Code == code);
                if (item is null)
                    taskSet.Tasks.Add(new TaskItem { Id = Guid.NewGuid(), TaskSetId = taskSet.Id, Code = code, Title = $"Задача {i + 1}", Points = pts[i] });
                else
                    item.Points = pts[i];
            }
            // лишние задачи (если уменьшили количество) удаляем
            foreach (var extra in taskSet.Tasks.Where(t => int.TryParse(t.Code, out var n) && n > pts.Count).ToList())
                _db.TaskItems.Remove(extra);
        }

        await _db.SaveChangesAsync(ct);
        return Ok();
    }

    /// <summary>Баллы за задачи занятия по их номеру (1..N). Пусто/1 по умолчанию.</summary>
    [HttpGet("activities/{activityId:guid}/task-points")]
    public async Task<IActionResult> GetTaskPoints(Guid activityId, CancellationToken ct)
    {
        var items = await _db.TaskItems
            .AsNoTracking()
            .Where(t => t.TaskSet.ActivityId == activityId && t.TaskSet.Title == "Задачи")
            .Select(t => new { t.Code, t.Points })
            .ToListAsync(ct);

        var points = items
            .Select(t => new { N = int.TryParse(t.Code, out var n) ? n : 0, t.Points })
            .Where(x => x.N > 0)
            .OrderBy(x => x.N)
            .Select(x => x.Points)
            .ToList();

        return Ok(points);
    }

    /// <summary>Удалить занятие со всеми зависимыми данными (пункт 4).</summary>
    [HttpDelete("activities/{activityId:guid}")]
    public async Task<IActionResult> DeleteActivity(Guid activityId, CancellationToken ct)
    {
        var activity = await _db.Activities.FirstOrDefaultAsync(a => a.Id == activityId, ct);
        if (activity is null) return NotFound();

        var taskSetIds = await _db.TaskSets.Where(ts => ts.ActivityId == activityId).Select(ts => ts.Id).ToListAsync(ct);
        if (taskSetIds.Count > 0)
        {
            var taskItemIds = await _db.TaskItems.Where(t => taskSetIds.Contains(t.TaskSetId)).Select(t => t.Id).ToListAsync(ct);
            if (taskItemIds.Count > 0)
                await _db.TaskAssistants.Where(t => taskItemIds.Contains(t.TaskItemId)).ExecuteDeleteAsync(ct);
            await _db.TaskItems.Where(t => taskSetIds.Contains(t.TaskSetId)).ExecuteDeleteAsync(ct);
            await _db.TaskSets.Where(ts => taskSetIds.Contains(ts.Id)).ExecuteDeleteAsync(ct);
        }

        var teamIds = await _db.Teams.Where(t => t.ActivityId == activityId).Select(t => t.Id).ToListAsync(ct);
        if (teamIds.Count > 0)
        {
            await _db.TeamHelpRequests.Where(h => teamIds.Contains(h.TeamId)).ExecuteDeleteAsync(ct);
            await _db.TeamMembers.Where(m => teamIds.Contains(m.TeamId)).ExecuteDeleteAsync(ct);
            await _db.TeamAssistants.Where(a => teamIds.Contains(a.TeamId)).ExecuteDeleteAsync(ct);
            await _db.Teams.Where(t => teamIds.Contains(t.Id)).ExecuteDeleteAsync(ct);
        }

        await _db.TaskSubmissions.Where(s => s.ActivityId == activityId).ExecuteDeleteAsync(ct);
        await _db.MiniTestAnswers.Where(a => a.ActivityId == activityId).ExecuteDeleteAsync(ct);
        await _db.MiniTestQuestions.Where(q => q.ActivityId == activityId).ExecuteDeleteAsync(ct);
        await _db.ActivityAssistants.Where(a => a.ActivityId == activityId).ExecuteDeleteAsync(ct);
        await _db.AssistantApplications.Where(a => a.ActivityId == activityId).ExecuteDeleteAsync(ct);

        _db.Activities.Remove(activity);
        await _db.SaveChangesAsync(ct);
        return Ok();
    }

    /// <summary>Автоматически сгенерировать команды по записанным студентам курса.</summary>
    [HttpPost("activities/{activityId:guid}/teams/auto-generate")]
    public async Task<IActionResult> AutoGenerateTeams(Guid activityId, [FromBody] AutoGenerateDto dto, CancellationToken ct)
    {
        var activity = await _db.Activities
            .Include(a => a.Module)
            .FirstOrDefaultAsync(a => a.Id == activityId, ct);
        if (activity is null) return NotFound();

        if (activity.Type != ActivityType.Lecture)
            return BadRequest(new { error = "Команды генерируются только для лекций." });

        if (activity.Status == ActivityStatus.Finished)
            return BadRequest(new { error = "Занятие завершено — команды менять нельзя." });

        if (activity.EndsAt < DateTimeOffset.UtcNow)
            return BadRequest(new { error = "Нельзя формировать команды для прошедшего занятия." });

        var courseId = activity.Module.CourseId;
        var enrolledIds = await _db.CourseEnrollments
            .Where(e => e.CourseId == courseId)
            .Select(e => e.UserId)
            .ToListAsync(ct);

        var students = await _db.Users
            .Where(u => enrolledIds.Contains(u.Id) && u.Role == UserRole.Student)
            .ToListAsync(ct);

        if (students.Count == 0) return BadRequest(new { error = "Нет записанных студентов на курс." });

        // Remove old teams for this activity
        var oldTeams = await _db.Teams.Where(t => t.ActivityId == activityId).ToListAsync(ct);
        _db.Teams.RemoveRange(oldTeams);
        await _db.SaveChangesAsync(ct);

        int teamSize = Math.Max(2, dto.TeamSize);
        var rnd = new Random();
        var shuffled = students.OrderBy(_ => rnd.Next()).ToList();

        int teamCount = (int)Math.Ceiling((double)shuffled.Count / teamSize);
        var teams = new Team[teamCount];
        for (int i = 0; i < teamCount; i++)
        {
            teams[i] = new Team { Id = Guid.NewGuid(), ActivityId = activityId, Name = $"Команда {i + 1}" };
            _db.Teams.Add(teams[i]);
        }

        // Snake draft: 0,1,2,...,N-1, N-1,...,1,0, 0,1,...
        bool ascending = true;
        int teamIdx = 0;
        foreach (var student in shuffled)
        {
            _db.TeamMembers.Add(new TeamMember
            {
                TeamId = teams[teamIdx].Id,
                UserId = student.Id,
                JoinedAt = DateTimeOffset.UtcNow,
                IsAbsent = false
            });
            if (ascending)
            {
                teamIdx++;
                if (teamIdx >= teamCount) { teamIdx = teamCount - 1; ascending = false; }
            }
            else
            {
                teamIdx--;
                if (teamIdx < 0) { teamIdx = 0; ascending = true; }
            }
        }

        await _db.SaveChangesAsync(ct);

        // D4 — если ассистенты уже одобрены, распределяем их по новым командам пропорционально (round-robin).
        var assistantIds = await _db.ActivityAssistants
            .Where(aa => aa.ActivityId == activityId)
            .Select(aa => aa.AssistantId)
            .ToListAsync(ct);
        if (assistantIds.Count > 0)
        {
            for (int i = 0; i < teams.Length; i++)
                _db.TeamAssistants.Add(new TeamAssistant { TeamId = teams[i].Id, AssistantId = assistantIds[i % assistantIds.Count] });
            await _db.SaveChangesAsync(ct);
        }

        // Return teams with member names
        var result = teams.Select(t => new
        {
            t.Id,
            t.Name,
            Members = _db.TeamMembers
                .Where(m => m.TeamId == t.Id)
                .Join(_db.Users, m => m.UserId, u => u.Id, (m, u) => u.DisplayName)
                .ToList()
        }).ToList();

        return Ok(new { teamCount, studentCount = shuffled.Count, teams = result });
    }

    /// <summary>Получить команды занятия с составом.</summary>
    [HttpGet("activities/{activityId:guid}/teams")]
    public async Task<IActionResult> GetTeams(Guid activityId, CancellationToken ct)
    {
        var teams = await _db.Teams
            .AsNoTracking()
            .Where(t => t.ActivityId == activityId)
            .Select(t => new
            {
                t.Id,
                t.Name,
                Members = t.Members.Select(m => new
                {
                    UserId = m.UserId,
                    DisplayName = _db.Users.Where(u => u.Id == m.UserId).Select(u => u.DisplayName).FirstOrDefault(),
                    m.IsAbsent
                }).ToList(),
                Assistants = t.Assistants.Select(a => new
                {
                    AssistantId = a.AssistantId,
                    DisplayName = _db.Users.Where(u => u.Id == a.AssistantId).Select(u => u.DisplayName).FirstOrDefault()
                }).ToList()
            })
            .ToListAsync(ct);
        return Ok(teams);
    }

    /// <summary>Удалить команду занятия (вместе с участниками, ассистентами и сдачами).</summary>
    [HttpDelete("teams/{teamId:guid}")]
    public async Task<IActionResult> DeleteTeam(Guid teamId, CancellationToken ct)
    {
        var team = await _db.Teams.Include(t => t.Activity).FirstOrDefaultAsync(t => t.Id == teamId, ct);
        if (team is null) return NotFound();
        if (team.Activity.Status == ActivityStatus.Finished)
            return BadRequest(new { error = "Занятие завершено — команды менять нельзя." });

        await _db.TeamMembers.Where(m => m.TeamId == teamId).ExecuteDeleteAsync(ct);
        await _db.TeamAssistants.Where(a => a.TeamId == teamId).ExecuteDeleteAsync(ct);
        await _db.TaskSubmissions.Where(s => s.TeamId == teamId).ExecuteDeleteAsync(ct);
        _db.Teams.Remove(team);
        await _db.SaveChangesAsync(ct);
        return Ok();
    }

    public sealed record CreateCourseDto(string Code, string Title, string AcademicYear);
    public sealed record EnrollBulkDto(List<string> Emails);
    public sealed record AddModuleDto(int Number, string Title, DateTimeOffset StartsAt, DateTimeOffset EndsAt);
    public sealed record AddActivityDto(ActivityType Type, string Title, DateTimeOffset StartsAt, DateTimeOffset EndsAt);
    public sealed record PatchModuleDto(string? Title, DateTimeOffset? StartsAt, DateTimeOffset? EndsAt);
    public sealed record PatchActivityDto(string? Title, DateTimeOffset? StartsAt, DateTimeOffset? EndsAt);
    public sealed record SaveAsTemplateDto(string? Title, string? Description);
    public sealed record AddTaskSetDto(string Title);
    public sealed record AddTaskItemDto(string Code, string Title, string? Statement, decimal Points);
    public sealed record IdListDto(IReadOnlyList<Guid> Ids);
    public sealed record CreateTeamDto(string Name);
    public sealed record AutoGenerateDto(int TeamSize);
    public sealed record PatchMaterialsDto(string? PreLectureVideoUrl, string? TheoryTestUrl, string? TaskFileUrl, int? TaskCount, List<decimal>? TaskPoints);
}
