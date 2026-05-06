using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ScoreHub.Api.Controllers;

/// <summary>Проверка доступности API (без авторизации).</summary>
[ApiController]
[Route("api/[controller]")]
public sealed class HealthController : ControllerBase
{
    /// <summary>Возвращает статус «ok», если приложение запущено.</summary>
    [HttpGet]
    [AllowAnonymous]
    public ActionResult<object> Get() => Ok(new { status = "ok" });
}
