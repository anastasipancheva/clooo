using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;

namespace ScoreHub.Api.Controllers;

/// <summary>Базовый контроллер: извлекает идентификатор пользователя из JWT.</summary>
public abstract class ApiControllerBase : ControllerBase
{
    protected Guid? CurrentUserId =>
        Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var g) ? g : null;
}
