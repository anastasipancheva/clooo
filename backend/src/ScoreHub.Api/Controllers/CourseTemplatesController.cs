using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ScoreHub.Application.Abstractions;
using ScoreHub.Domain.Auth;

namespace ScoreHub.Api.Controllers;

[ApiController]
[Authorize(Roles = AppRoles.Teacher + "," + AppRoles.Admin)]
public class CourseTemplatesController(ICourseTemplateService svc) : ApiControllerBase
{
    [HttpGet("/api/templates")]
    public async Task<IActionResult> List() => Ok(await svc.ListAsync());

    [HttpGet("/api/templates/{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var t = await svc.GetAsync(id);
        return t is null ? NotFound() : Ok(t);
    }

    [HttpPost("/api/templates")]
    public async Task<IActionResult> Create([FromBody] CreateTemplateRequest req)
    {
        var id = await svc.CreateAsync(req);
        return Ok(new { id });
    }

    [HttpDelete("/api/templates/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var ok = await svc.DeleteAsync(id);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("/api/templates/{id:guid}/apply")]
    public async Task<IActionResult> Apply(Guid id, [FromBody] ApplyTemplateRequest req)
    {
        var courseId = await svc.ApplyAsync(id, req);
        return Ok(new { courseId });
    }
}
