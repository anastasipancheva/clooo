using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ScoreHub.Infrastructure.Persistence;

namespace ScoreHub.Api.Controllers;

/// <summary>Уведомления пользователя (вызов ассистента, готовность к сдаче, вызов на КТ и т.д.).</summary>
[ApiController]
[Route("api/notifications")]
[Authorize]
public sealed class NotificationsController : ApiControllerBase
{
    private readonly ScoreHubDbContext _db;

    public NotificationsController(ScoreHubDbContext db)
    {
        _db = db;
    }

    /// <summary>Последние 100 уведомлений текущего пользователя (новые сверху).</summary>
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();

        var items = await _db.Notifications
            .AsNoTracking()
            .Where(n => n.RecipientId == uid.Value)
            .OrderByDescending(n => n.CreatedAt)
            .Take(100)
            .Select(n => new
            {
                n.Id,
                n.Type,
                n.Title,
                n.Body,
                n.CreatedAt,
                n.ReadAt
            })
            .ToListAsync(ct);

        return Ok(items);
    }

    /// <summary>Отметить уведомление прочитанным.</summary>
    [HttpPost("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id, CancellationToken ct)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();

        var n = await _db.Notifications.FirstOrDefaultAsync(x => x.Id == id && x.RecipientId == uid.Value, ct);
        if (n is null) return NotFound();

        n.ReadAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok();
    }
}
