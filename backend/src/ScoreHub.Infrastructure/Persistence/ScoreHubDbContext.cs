using Microsoft.EntityFrameworkCore;
using ScoreHub.Domain.Entities;

namespace ScoreHub.Infrastructure.Persistence;

public sealed class ScoreHubDbContext : DbContext
{
    public ScoreHubDbContext(DbContextOptions<ScoreHubDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Course> Courses => Set<Course>();
    public DbSet<Module> Modules => Set<Module>();
    public DbSet<Activity> Activities => Set<Activity>();

    public DbSet<Team> Teams => Set<Team>();
    public DbSet<TeamMember> TeamMembers => Set<TeamMember>();
    public DbSet<TeamAssistant> TeamAssistants => Set<TeamAssistant>();
    public DbSet<TeamGroupScore> TeamGroupScores => Set<TeamGroupScore>();
    public DbSet<TeamSwapLog> TeamSwapLogs => Set<TeamSwapLog>();

    public DbSet<ActivityAssistant> ActivityAssistants => Set<ActivityAssistant>();

    public DbSet<TaskSet> TaskSets => Set<TaskSet>();
    public DbSet<TaskItem> TaskItems => Set<TaskItem>();
    public DbSet<TaskAssistant> TaskAssistants => Set<TaskAssistant>();

    public DbSet<TeamHelpRequest> TeamHelpRequests => Set<TeamHelpRequest>();
    public DbSet<TaskSubmission> TaskSubmissions => Set<TaskSubmission>();

    public DbSet<MiniTestQuestion> MiniTestQuestions => Set<MiniTestQuestion>();
    public DbSet<MiniTestAnswer> MiniTestAnswers => Set<MiniTestAnswer>();

    public DbSet<HomeworkSubmission> HomeworkSubmissions => Set<HomeworkSubmission>();
    public DbSet<HomeworkSubmissionMember> HomeworkSubmissionMembers => Set<HomeworkSubmissionMember>();

    public DbSet<StudentActivityScore> StudentActivityScores => Set<StudentActivityScore>();

    public DbSet<Notification> Notifications => Set<Notification>();

    public DbSet<CourseEnrollment> CourseEnrollments => Set<CourseEnrollment>();

    public DbSet<AssistantApplication> AssistantApplications => Set<AssistantApplication>();

    public DbSet<GradeOverride> GradeOverrides => Set<GradeOverride>();

    public DbSet<CourseTemplate> CourseTemplates => Set<CourseTemplate>();
    public DbSet<ModuleTemplate> ModuleTemplates => Set<ModuleTemplate>();
    public DbSet<ActivityTemplate> ActivityTemplates => Set<ActivityTemplate>();
    public DbSet<TaskTemplate> TaskTemplates => Set<TaskTemplate>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>()
            .HasIndex(x => x.Email)
            .IsUnique();

        modelBuilder.Entity<TeamMember>()
            .HasKey(x => new { x.TeamId, x.UserId });

        modelBuilder.Entity<TeamAssistant>()
            .HasKey(x => new { x.TeamId, x.AssistantId });

        modelBuilder.Entity<TaskAssistant>()
            .HasKey(x => new { x.TaskItemId, x.AssistantId });

        modelBuilder.Entity<ActivityAssistant>()
            .HasKey(x => new { x.ActivityId, x.AssistantId });

        modelBuilder.Entity<HomeworkSubmissionMember>()
            .HasKey(x => new { x.HomeworkSubmissionId, x.UserId });

        modelBuilder.Entity<TaskSubmission>()
            .HasIndex(x => new { x.ActivityId, x.TaskItemId, x.TeamId, x.StudentId });

        modelBuilder.Entity<MiniTestAnswer>()
            .HasIndex(x => new { x.ActivityId, x.StudentId, x.QuestionId })
            .IsUnique();

        modelBuilder.Entity<StudentActivityScore>()
            .HasIndex(x => new { x.CourseId, x.StudentId, x.ModuleNumber })
            .IsUnique();

        modelBuilder.Entity<TeamGroupScore>()
            .HasIndex(x => new { x.TeamId, x.ActivityId })
            .IsUnique();

        // User FK restrictions
        modelBuilder.Entity<TeamMember>()
            .HasOne<User>().WithMany()
            .HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TeamAssistant>()
            .HasOne<User>().WithMany()
            .HasForeignKey(x => x.AssistantId).OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TaskAssistant>()
            .HasOne<User>().WithMany()
            .HasForeignKey(x => x.AssistantId).OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<ActivityAssistant>()
            .HasOne<User>().WithMany()
            .HasForeignKey(x => x.AssistantId).OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TeamHelpRequest>()
            .HasOne<User>().WithMany()
            .HasForeignKey(x => x.CreatedByUserId).OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Notification>()
            .HasOne<User>().WithMany()
            .HasForeignKey(x => x.RecipientId).OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<TaskSubmission>()
            .HasOne<User>().WithMany()
            .HasForeignKey(x => x.StudentId).OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TaskSubmission>()
            .HasOne<User>().WithMany()
            .HasForeignKey(x => x.ReviewerId).OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TaskSubmission>()
            .HasOne<User>().WithMany()
            .HasForeignKey(x => x.DefenderUserId).OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<MiniTestAnswer>()
            .HasOne<User>().WithMany()
            .HasForeignKey(x => x.StudentId).OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<HomeworkSubmissionMember>()
            .HasOne<User>().WithMany()
            .HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<HomeworkSubmission>()
            .HasOne<User>().WithMany()
            .HasForeignKey(x => x.ReviewerId).OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<StudentActivityScore>()
            .HasOne<User>().WithMany()
            .HasForeignKey(x => x.StudentId).OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TeamSwapLog>()
            .HasOne<User>().WithMany()
            .HasForeignKey(x => x.InitiatedByUserId).OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TeamSwapLog>()
            .HasOne<User>().WithMany()
            .HasForeignKey(x => x.StudentAId).OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TeamSwapLog>()
            .HasOne<User>().WithMany()
            .HasForeignKey(x => x.StudentBId).OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<CourseEnrollment>()
            .HasKey(x => new { x.CourseId, x.UserId });

        modelBuilder.Entity<CourseEnrollment>()
            .HasOne(x => x.User).WithMany()
            .HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<CourseEnrollment>()
            .HasOne(x => x.Course).WithMany()
            .HasForeignKey(x => x.CourseId).OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<GradeOverride>()
            .HasIndex(x => new { x.CourseId, x.StudentId, x.CellKey })
            .IsUnique();

        modelBuilder.Entity<AssistantApplication>()
            .HasIndex(x => new { x.ActivityId, x.AssistantId })
            .IsUnique();

        modelBuilder.Entity<AssistantApplication>()
            .HasOne(x => x.Assistant).WithMany()
            .HasForeignKey(x => x.AssistantId).OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<AssistantApplication>()
            .HasOne(x => x.Activity).WithMany()
            .HasForeignKey(x => x.ActivityId).OnDelete(DeleteBehavior.Cascade);
    }
}
