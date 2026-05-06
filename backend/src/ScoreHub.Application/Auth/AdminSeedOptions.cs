namespace ScoreHub.Application.Auth;

public sealed class AdminSeedOptions
{
    public const string SectionName = "AdminSeed";

    public bool Enabled { get; set; } = true;
    public string Email { get; set; } = "";
    public string Password { get; set; } = "";
}
