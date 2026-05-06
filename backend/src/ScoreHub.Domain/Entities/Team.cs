namespace ScoreHub.Domain.Entities;

public sealed class Team
{
    public Guid Id { get; set; }

    public Guid ActivityId { get; set; }
    public Activity Activity { get; set; } = null!;

    public string Name { get; set; } = null!;

    public List<TeamMember> Members { get; set; } = new();
    public List<TeamAssistant> Assistants { get; set; } = new();

    public List<TeamHelpRequest> HelpRequests { get; set; } = new();
    public List<TaskSubmission> Submissions { get; set; } = new();
}

