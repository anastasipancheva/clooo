namespace ScoreHub.Domain.Entities;

public sealed class MiniTestAnswer
{
    public Guid Id { get; set; }

    public Guid ActivityId { get; set; }
    public Guid StudentId { get; set; }
    public Guid QuestionId { get; set; }
    public MiniTestQuestion Question { get; set; } = null!;

    public int SelectedOptionIndex { get; set; }
    public DateTimeOffset AnsweredAt { get; set; }

    /// <summary>Computed when test closes: fraction of MiniTestMaxBonus.</summary>
    public decimal BonusAwarded { get; set; }
}
