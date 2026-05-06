using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using ScoreHub.Application.Auth;
using ScoreHub.Infrastructure.Persistence;

namespace ScoreHub.Api.Extensions;

public static class DatabaseExtensions
{
    public static async Task MigrateAndSeedAsync(this WebApplication app)
    {
        using var scope = app.Services.CreateScope();
        var sp = scope.ServiceProvider;

        var db = sp.GetRequiredService<ScoreHubDbContext>();
        await db.Database.MigrateAsync();

        await DatabaseSeeder.SeedAsync(db, sp.GetRequiredService<IOptions<AdminSeedOptions>>());
    }
}
