using Microsoft.EntityFrameworkCore;
using ScoreHub.Application.Abstractions;
using ScoreHub.Domain.Entities;
using ScoreHub.Domain.Enums;
using ScoreHub.Infrastructure.Persistence;

namespace ScoreHub.Infrastructure.Services;

public sealed class CourseTemplateService(ScoreHubDbContext db) : ICourseTemplateService
{
    public async Task<List<TemplateSummary>> ListAsync()
    {
        // Проецируем в SQL (счётчики — корректные коррелированные подзапросы),
        // а сортировку по CreatedAt делаем в памяти: SQLite не сортирует DateTimeOffset,
        // и OrderBy поверх проекции с подзапросами не транслируется.
        var list = await db.CourseTemplates
            .Select(t => new TemplateSummary(
                t.Id, t.Title, t.Description,
                t.Modules.Count,
                t.Modules.SelectMany(m => m.Activities).Count(),
                t.CreatedAt))
            .ToListAsync();

        return list.OrderByDescending(t => t.CreatedAt).ToList();
    }

    public async Task<TemplateView?> GetAsync(Guid id)
    {
        var t = await db.CourseTemplates
            .Include(x => x.Modules)
                .ThenInclude(m => m.Activities)
                    .ThenInclude(a => a.Tasks)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (t is null) return null;

        return new TemplateView(t.Id, t.Title, t.Description, t.CreatedAt,
            t.Modules.OrderBy(m => m.Number).Select(m =>
                new TemplateModuleView(m.Id, m.Number, m.Title,
                    m.Activities.Select(a =>
                        new TemplateActivityView(a.Id, a.Type, a.Title, a.TaskFileUrl, a.TheoryTestUrl,
                            a.Tasks.Select(tk => new TemplateTaskView(tk.Id, tk.Code, tk.Title, tk.Points)).ToList())
                    ).ToList(),
                    m.StartsAt,
                    m.EndsAt)
            ).ToList());
    }

    public async Task<Guid> CreateAsync(CreateTemplateRequest req)
    {
        var template = new CourseTemplate
        {
            Id = Guid.NewGuid(),
            Title = req.Title,
            Description = req.Description,
            CreatedAt = DateTimeOffset.UtcNow,
            Modules = req.Modules.Select(m => new ModuleTemplate
            {
                Id = Guid.NewGuid(),
                Number = m.Number,
                Title = m.Title,
                StartsAt = m.StartsAt,
                EndsAt = m.EndsAt,
                Activities = m.Activities.Select(a => new ActivityTemplate
                {
                    Id = Guid.NewGuid(),
                    Type = a.Type,
                    Title = a.Title,
                    TaskFileUrl = a.TaskFileUrl,
                    TheoryTestUrl = a.TheoryTestUrl,
                    Tasks = a.Tasks.Select(tk => new TaskTemplate
                    {
                        Id = Guid.NewGuid(),
                        Code = tk.Code,
                        Title = tk.Title,
                        Points = tk.Points
                    }).ToList()
                }).ToList()
            }).ToList()
        };

        db.CourseTemplates.Add(template);
        await db.SaveChangesAsync();
        return template.Id;
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var t = await db.CourseTemplates.FindAsync(id);
        if (t is null) return false;
        db.CourseTemplates.Remove(t);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<Guid> ApplyAsync(Guid templateId, ApplyTemplateRequest req)
    {
        var template = await db.CourseTemplates
            .Include(x => x.Modules)
                .ThenInclude(m => m.Activities)
                    .ThenInclude(a => a.Tasks)
            .FirstOrDefaultAsync(x => x.Id == templateId)
            ?? throw new InvalidOperationException("Template not found");

        // Create course skeleton — dates start from today, each module is 2 weeks
        var courseId = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;

        var course = new Course
        {
            Id = courseId,
            Code = req.CourseCode,
            Title = req.CourseTitle,
            AcademicYear = req.AcademicYear,
            InviteCode = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(4)).ToLowerInvariant()
        };

        var modules = template.Modules.OrderBy(m => m.Number).ToList();

        // Determine date anchor: explicit StartDate > first template module date > today
        DateTimeOffset? dateAnchor = req.StartDate;
        if (dateAnchor is null && modules.Count > 0 && modules[0].StartsAt.HasValue)
            dateAnchor = null; // keep template dates as-is when no StartDate provided

        // If StartDate is provided, calculate offset from the template's first module start (or index 0)
        TimeSpan dateShift = TimeSpan.Zero;
        if (req.StartDate.HasValue && modules.Count > 0)
        {
            var templateAnchor = modules[0].StartsAt ?? now;
            dateShift = req.StartDate.Value.Date - templateAnchor.Date;
        }

        for (int mi = 0; mi < modules.Count; mi++)
        {
            var mt = modules[mi];
            DateTimeOffset moduleStart, moduleEnd;
            if (req.StartDate.HasValue)
            {
                // Shift template dates by the delta; if template has no dates, space evenly
                moduleStart = mt.StartsAt.HasValue ? mt.StartsAt.Value + dateShift : req.StartDate.Value.AddDays(mi * 14);
                moduleEnd   = mt.EndsAt.HasValue   ? mt.EndsAt.Value   + dateShift : moduleStart.AddDays(13);
            }
            else
            {
                // Use template dates if present, otherwise auto-calculate from today
                moduleStart = mt.StartsAt ?? now.AddDays(mi * 14);
                moduleEnd   = mt.EndsAt   ?? moduleStart.AddDays(13);
            }

            var module = new Module
            {
                Id = Guid.NewGuid(),
                CourseId = courseId,
                Number = mt.Number,
                Title = mt.Title,
                StartsAt = moduleStart,
                EndsAt = moduleEnd
            };

            var actList = mt.Activities.ToList();
            for (int ai = 0; ai < actList.Count; ai++)
            {
                var at = actList[ai];
                var actStart = moduleStart.AddDays(ai * 7);
                var actEnd   = actStart.AddHours(2);

                var activity = new Activity
                {
                    Id = Guid.NewGuid(),
                    ModuleId = module.Id,
                    Type = (ActivityType)at.Type,
                    Title = at.Title,
                    Status = ActivityStatus.Scheduled,
                    StartsAt = actStart,
                    EndsAt = actEnd,
                    TaskFileUrl = at.TaskFileUrl,
                    TheoryTestUrl = at.TheoryTestUrl,
                    LectureBasePoints = 1,
                };

                if (at.Tasks.Any())
                {
                    var taskSet = new TaskSet
                    {
                        Id = Guid.NewGuid(),
                        ActivityId = activity.Id,
                        Title = at.Title,
                        Published = false
                    };
                    foreach (var tt in at.Tasks)
                    {
                        taskSet.Tasks.Add(new TaskItem
                        {
                            Id = Guid.NewGuid(),
                            TaskSetId = taskSet.Id,
                            Code = tt.Code,
                            Title = tt.Title,
                            Points = tt.Points
                        });
                    }
                    activity.TaskSets.Add(taskSet);
                }

                module.Activities.Add(activity);
            }

            course.Modules.Add(module);
        }

        db.Courses.Add(course);
        await db.SaveChangesAsync();
        return courseId;
    }
}
