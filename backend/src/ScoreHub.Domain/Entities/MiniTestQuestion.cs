namespace ScoreHub.Domain.Entities;

public sealed class MiniTestQuestion
{
    public Guid Id { get; set; }

    public Guid ActivityId { get; set; }
    public Activity Activity { get; set; } = null!;

    public int Order { get; set; }
    public string Text { get; set; } = null!;

    /// <summary>JSON array of option strings, e.g. ["A","B","C"]</summary>
    public string OptionsJson { get; set; } = "[]";

    public int CorrectOptionIndex { get; set; }

    public List<MiniTestAnswer> Answers { get; set; } = new();
}
