namespace ScoreHub.Application.Auth;

public sealed record AccessTokenResult(string Token, DateTimeOffset ExpiresAtUtc);

public interface IJwtTokenService
{
    AccessTokenResult CreateAccessToken(Guid userId, string email, string displayName, IEnumerable<string> roles);
}
