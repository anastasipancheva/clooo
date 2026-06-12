namespace ScoreHub.Application.Abstractions;

public record TemplateTaskDto(string Code, string Title, decimal Points);
public record TemplateActivityDto(int Type, string Title, string? TaskFileUrl, string? TheoryTestUrl, List<TemplateTaskDto> Tasks);
public record TemplateModuleDto(int Number, string Title, List<TemplateActivityDto> Activities, DateTimeOffset? StartsAt = null, DateTimeOffset? EndsAt = null);
public record CreateTemplateRequest(string Title, string? Description, List<TemplateModuleDto> Modules);

public record TemplateTaskView(Guid Id, string Code, string Title, decimal Points);
public record TemplateActivityView(Guid Id, int Type, string Title, string? TaskFileUrl, string? TheoryTestUrl, List<TemplateTaskView> Tasks);
public record TemplateModuleView(Guid Id, int Number, string Title, List<TemplateActivityView> Activities, DateTimeOffset? StartsAt = null, DateTimeOffset? EndsAt = null);
public record TemplateView(Guid Id, string Title, string? Description, DateTimeOffset CreatedAt, List<TemplateModuleView> Modules);
public record TemplateSummary(Guid Id, string Title, string? Description, int ModuleCount, int ActivityCount, DateTimeOffset CreatedAt);

/// <summary>StartDate: дата начала первого модуля. Если не задана — используются даты шаблона или today+offset.</summary>
public record ApplyTemplateRequest(string CourseCode, string CourseTitle, string AcademicYear, DateTimeOffset? StartDate = null);

public interface ICourseTemplateService
{
    Task<List<TemplateSummary>> ListAsync();
    Task<TemplateView?> GetAsync(Guid id);
    Task<Guid> CreateAsync(CreateTemplateRequest req);
    Task<bool> DeleteAsync(Guid id);
    Task<Guid> ApplyAsync(Guid templateId, ApplyTemplateRequest req);
}
