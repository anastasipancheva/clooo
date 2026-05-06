using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using ScoreHub.Application.Auth;
using ScoreHub.Domain.Entities;
using ScoreHub.Domain.Enums;
using ScoreHub.Infrastructure.Auth;

namespace ScoreHub.Infrastructure.Persistence;

public static class DatabaseSeeder
{
    public static async Task SeedAsync(
        ScoreHubDbContext db,
        IOptions<AdminSeedOptions> adminSeedOptions,
        CancellationToken cancellationToken = default)
    {
        var opts = adminSeedOptions.Value;
        if (!opts.Enabled || string.IsNullOrWhiteSpace(opts.Email) || string.IsNullOrWhiteSpace(opts.Password))
            return;

        var email = opts.Email.Trim().ToLowerInvariant();
        var exists = await db.Users.AnyAsync(u => u.Email == email, cancellationToken);
        if (exists)
            return;

        db.Users.Add(new User
        {
            Id = Guid.NewGuid(),
            Email = email,
            DisplayName = "Administrator",
            PasswordHash = PasswordHashing.Hash(opts.Password),
            Role = UserRole.Admin,
            CreatedAt = DateTimeOffset.UtcNow
        });

        await db.SaveChangesAsync(cancellationToken);
    }
}
