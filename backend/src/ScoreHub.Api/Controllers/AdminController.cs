using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ScoreHub.Domain.Auth;
using ScoreHub.Domain.Enums;
using ScoreHub.Infrastructure.Persistence;

namespace ScoreHub.Api.Controllers;

/// <summary>Администрирование пользователей (роли Teacher и Admin).</summary>
[ApiController]
[Route("api/admin")]
[Authorize(Roles = $"{AppRoles.Teacher},{AppRoles.Admin}")]
public sealed class AdminController : ControllerBase
{
    private readonly ScoreHubDbContext _db;

    public AdminController(ScoreHubDbContext db)
    {
        _db = db;
    }

    /// <summary>Список всех пользователей (id, email, displayName, role).</summary>
    [HttpGet("users")]
    [Authorize(Roles = $"{AppRoles.Teacher},{AppRoles.Admin}")]
    public async Task<IActionResult> ListUsers(CancellationToken ct)
    {
        var users = await _db.Users
            .AsNoTracking()
            .OrderBy(u => u.DisplayName)
            .Select(u => new { u.Id, u.Email, u.DisplayName, Role = u.Role.ToString() })
            .ToListAsync(ct);
        return Ok(users);
    }

    /// <summary>Назначить пользователю роль (Student, Assistant, Teacher, Admin).</summary>
    /// <param name="userId">Идентификатор пользователя.</param>
    /// <param name="dto">Имя роли в поле roleName.</param>
    /// <param name="ct">Токен отмены.</param>
    [HttpPost("users/{userId:guid}/roles")]
    public async Task<IActionResult> SetRole(Guid userId, [FromBody] SetRoleDto dto, CancellationToken ct)
    {
        if (!Enum.TryParse<UserRole>(dto.RoleName, ignoreCase: true, out var role)
            || !Enum.IsDefined(typeof(UserRole), role))
            return BadRequest(new { error = "Invalid role name." });

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
            return NotFound();

        user.Role = role;
        await _db.SaveChangesAsync(ct);

        return Ok(new { userId, role = role.ToString() });
    }

    /// <summary>Тело: имя роли в поле roleName (Student, Assistant, Teacher, Admin).</summary>
    public sealed record SetRoleDto(string RoleName);
}
