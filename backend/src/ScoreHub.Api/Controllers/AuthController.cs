using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ScoreHub.Application.Auth;
using ScoreHub.Domain.Entities;
using ScoreHub.Domain.Enums;
using ScoreHub.Infrastructure.Auth;
using ScoreHub.Infrastructure.Persistence;

namespace ScoreHub.Api.Controllers;

/// <summary>Регистрация, вход в систему и профиль текущего пользователя.</summary>
[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly ScoreHubDbContext _db;
    private readonly IJwtTokenService _jwt;

    public AuthController(ScoreHubDbContext db, IJwtTokenService jwt)
    {
        _db = db;
        _jwt = jwt;
    }

    /// <summary>Создать аккаунт студента (роль Student, пароль не короче 8 символов).</summary>
    /// <remarks>Email приводится к нижнему регистру. Повторный email — 409.</remarks>
    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<ActionResult<object>> Register([FromBody] RegisterDto dto, CancellationToken ct)
    {
        if (dto.Password.Length < 8)
            return BadRequest(new { error = "Password must be at least 8 characters." });

        var email = dto.Email.Trim().ToLowerInvariant();
        if (await _db.Users.AnyAsync(u => u.Email == email, ct))
            return Conflict(new { error = "Email already registered." });

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = email,
            DisplayName = dto.DisplayName.Trim(),
            PasswordHash = PasswordHashing.Hash(dto.Password),
            Role = UserRole.Student,
            CreatedAt = DateTimeOffset.UtcNow
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync(ct);

        // Сразу выдаём JWT — фронтенд перенаправит на /courses без лишнего шага логина
        var roles = new[] { user.Role.ToString() };
        var token = _jwt.CreateAccessToken(user.Id, user.Email, user.DisplayName, roles);
        return StatusCode(StatusCodes.Status201Created,
            new LoginResponse(token.Token, token.ExpiresAtUtc, user.Id, user.Email, user.DisplayName, roles));
    }

    /// <summary>Вход по email и паролю; в ответе JWT и срок действия.</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginDto dto, CancellationToken ct)
    {
        var email = dto.Email.Trim().ToLowerInvariant();
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Email == email, ct);
        if (user is null || !PasswordHashing.Verify(dto.Password, user.PasswordHash))
            return Unauthorized(new { error = "Invalid email or password." });

        var roles = new[] { user.Role.ToString() };
        var token = _jwt.CreateAccessToken(user.Id, user.Email, user.DisplayName, roles);
        return Ok(new LoginResponse(token.Token, token.ExpiresAtUtc, user.Id, user.Email, user.DisplayName, roles));
    }

    /// <summary>Профиль текущего пользователя (нужен заголовок Authorization: Bearer …).</summary>
    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<MeResponse>> Me(CancellationToken ct)
    {
        var idStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (idStr is null || !Guid.TryParse(idStr, out var id))
            return Unauthorized();

        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null)
            return Unauthorized();

        return Ok(new MeResponse(user.Id, user.Email, user.DisplayName, user.Role.ToString()));
    }

    /// <summary>Выдать новый JWT с актуальной ролью из БД (нужен после смены роли администратором).</summary>
    [HttpPost("refresh")]
    [Authorize]
    public async Task<IActionResult> Refresh(CancellationToken ct)
    {
        var idStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (idStr is null || !Guid.TryParse(idStr, out var id))
            return Unauthorized();

        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null) return Unauthorized();

        var roles = new[] { user.Role.ToString() };
        var token = _jwt.CreateAccessToken(user.Id, user.Email, user.DisplayName, roles);
        return Ok(new { accessToken = token.Token, expiresAtUtc = token.ExpiresAtUtc, role = user.Role.ToString() });
    }

    /// <summary>[DEV ONLY] Задать роль пользователю по email.</summary>
    [HttpPost("dev/set-role")]
    [AllowAnonymous]
    public async Task<IActionResult> DevSetRole([FromBody] DevSetRoleDto dto, CancellationToken ct)
    {
        if (!HttpContext.RequestServices.GetRequiredService<IWebHostEnvironment>().IsDevelopment())
            return NotFound();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == dto.Email.ToLowerInvariant(), ct);
        if (user is null) return NotFound(new { error = "User not found" });
        user.Role = dto.Role;
        await _db.SaveChangesAsync(ct);
        return Ok(new { user.Email, user.Role });
    }

    public sealed record RegisterDto(string Email, string Password, string DisplayName);

    public sealed record LoginDto(string Email, string Password);

    public sealed record LoginResponse(
        string AccessToken,
        DateTimeOffset ExpiresAtUtc,
        Guid UserId,
        string Email,
        string DisplayName,
        IReadOnlyList<string> Roles);

    public sealed record MeResponse(Guid Id, string Email, string DisplayName, string Role);

    public sealed record DevSetRoleDto(string Email, UserRole Role);
}
