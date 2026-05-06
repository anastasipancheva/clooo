using ScoreHub.Domain.Enums;

namespace ScoreHub.Domain.Auth;

/// <summary>ASP.NET Identity role names (must match JWT role claims).</summary>
public static class AppRoles
{
    public const string Student = nameof(UserRole.Student);
    public const string Assistant = nameof(UserRole.Assistant);
    public const string Teacher = nameof(UserRole.Teacher);
    public const string Admin = nameof(UserRole.Admin);

    public static IReadOnlyList<string> All { get; } =
    [
        Student,
        Assistant,
        Teacher,
        Admin
    ];
}
