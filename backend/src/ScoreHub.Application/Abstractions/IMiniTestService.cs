using ScoreHub.Application.Common;

namespace ScoreHub.Application.Abstractions;

public interface IMiniTestService
{
    Task<OpResult<Guid>> AddQuestion(Guid actorId, Guid activityId, int order, string text, string[] options, int correctIndex, CancellationToken ct = default);
    Task<OpResult<Unit>> UpdateQuestion(Guid actorId, Guid questionId, int order, string text, string[] options, int correctIndex, CancellationToken ct = default);
    Task<OpResult<Unit>> DeleteQuestion(Guid actorId, Guid questionId, CancellationToken ct = default);

    Task<OpResult<Unit>> Publish(Guid actorId, Guid activityId, CancellationToken ct = default);

    /// <summary>Returns questions without correct answers (for students during test window).</summary>
    Task<OpResult<MiniTestDto>> GetForStudent(Guid actorId, Guid activityId, CancellationToken ct = default);

    Task<OpResult<Unit>> Submit(Guid actorId, Guid activityId, IReadOnlyList<StudentAnswer> answers, CancellationToken ct = default);
}

public sealed record MiniTestDto(
    Guid ActivityId,
    bool IsOpen,
    int SecondsRemaining,
    IReadOnlyList<QuestionDto> Questions);

public sealed record QuestionDto(Guid Id, int Order, string Text, IReadOnlyList<string> Options);

public sealed record StudentAnswer(Guid QuestionId, int SelectedOptionIndex);
