using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ScoreHub.Application.Abstractions;
using ScoreHub.Application.Common;
using ScoreHub.Domain.Entities;
using ScoreHub.Domain.Enums;
using ScoreHub.Infrastructure.Persistence;

namespace ScoreHub.Infrastructure.Services;

public sealed class MiniTestService : IMiniTestService
{
    private readonly ScoreHubDbContext _db;
    private readonly INotificationService _notify;

    public MiniTestService(ScoreHubDbContext db, INotificationService notify)
    {
        _db = db;
        _notify = notify;
    }

    private static bool CanManage(UserRole r) => r is UserRole.Teacher or UserRole.Admin;

    public async Task<OpResult<Guid>> AddQuestion(
        Guid actorId, Guid activityId, int order, string text, string[] options, int correctIndex, CancellationToken ct = default)
    {
        var actor = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == actorId, ct);
        if (actor is null || !CanManage(actor.Role))
            return OpResult<Guid>.Fail("Недостаточно прав.");

        var activity = await _db.Activities.FirstOrDefaultAsync(a => a.Id == activityId, ct);
        if (activity is null || activity.Type != ActivityType.Lecture)
            return OpResult<Guid>.Fail("Мини-тест доступен только для лекций.");

        if (activity.MiniTestPublished)
            return OpResult<Guid>.Fail("Тест уже опубликован — редактирование з��прещено.");

        if (correctIndex < 0 || correctIndex >= options.Length)
            return OpResult<Guid>.Fail("correctIndex выходит за пределы массива вариантов.");

        var q = new MiniTestQuestion
        {
            Id = Guid.NewGuid(),
            ActivityId = activityId,
            Order = order,
            Text = text,
            OptionsJson = JsonSerializer.Serialize(options),
            CorrectOptionIndex = correctIndex
        };
        _db.MiniTestQuestions.Add(q);
        await _db.SaveChangesAsync(ct);
        return OpResult<Guid>.Ok(q.Id);
    }

    public async Task<OpResult<Unit>> UpdateQuestion(
        Guid actorId, Guid questionId, int order, string text, string[] options, int correctIndex, CancellationToken ct = default)
    {
        var actor = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == actorId, ct);
        if (actor is null || !CanManage(actor.Role))
            return OpResult<Unit>.Fail("Недостаточно прав.");

        var q = await _db.MiniTestQuestions.Include(x => x.Activity).FirstOrDefaultAsync(x => x.Id == questionId, ct);
        if (q is null) return OpResult<Unit>.Fail("Вопрос не найден.");
        if (q.Activity.MiniTestPublished) return OpResult<Unit>.Fail("Тест опубликован — редактирование запрещено.");
        if (correctIndex < 0 || correctIndex >= options.Length)
            return OpResult<Unit>.Fail("correctIndex выходит за пределы массива вариантов.");

        q.Order = order;
        q.Text = text;
        q.OptionsJson = JsonSerializer.Serialize(options);
        q.CorrectOptionIndex = correctIndex;
        await _db.SaveChangesAsync(ct);
        return OpResult<Unit>.Ok(Unit.Value);
    }

    public async Task<OpResult<Unit>> DeleteQuestion(Guid actorId, Guid questionId, CancellationToken ct = default)
    {
        var actor = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == actorId, ct);
        if (actor is null || !CanManage(actor.Role))
            return OpResult<Unit>.Fail("Недостаточно прав.");

        var q = await _db.MiniTestQuestions.Include(x => x.Activity).FirstOrDefaultAsync(x => x.Id == questionId, ct);
        if (q is null) return OpResult<Unit>.Fail("Вопрос не найден.");
        if (q.Activity.MiniTestPublished) return OpResult<Unit>.Fail("Тест опубликован — удаление запрещено.");

        _db.MiniTestQuestions.Remove(q);
        await _db.SaveChangesAsync(ct);
        return OpResult<Unit>.Ok(Unit.Value);
    }

    public async Task<OpResult<Unit>> Publish(Guid actorId, Guid activityId, CancellationToken ct = default)
    {
        var actor = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == actorId, ct);
        if (actor is null || !CanManage(actor.Role))
            return OpResult<Unit>.Fail("Недостаточно прав.");

        var activity = await _db.Activities.FirstOrDefaultAsync(a => a.Id == activityId, ct);
        if (activity is null || activity.Type != ActivityType.Lecture)
            return OpResult<Unit>.Fail("Не лекция.");

        if (activity.MiniTestPublished)
            return OpResult<Unit>.Fail("Тест уже опубликован.");

        var hasQuestions = await _db.MiniTestQuestions.AnyAsync(q => q.ActivityId == activityId, ct);
        if (!hasQuestions)
            return OpResult<Unit>.Fail("Нет вопросов для публикации.");

        activity.MiniTestPublished = true;
        activity.MiniTestOpenedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        // Notify all students in teams for this activity
        var studentIds = await _db.TeamMembers
            .Where(m => m.Team.ActivityId == activityId)
            .Select(m => m.UserId)
            .Distinct()
            .ToListAsync(ct);

        await _notify.NotifyManyAsync(studentIds, "MiniTestOpened", "Мини-тест открыт!", null, ct);

        return OpResult<Unit>.Ok(Unit.Value);
    }

    public async Task<OpResult<MiniTestDto>> GetForStudent(Guid actorId, Guid activityId, CancellationToken ct = default)
    {
        var activity = await _db.Activities.AsNoTracking().FirstOrDefaultAsync(a => a.Id == activityId, ct);
        if (activity is null || activity.Type != ActivityType.Lecture)
            return OpResult<MiniTestDto>.Fail("Занятие не найдено.");

        if (!activity.MiniTestPublished || activity.MiniTestOpenedAt is null)
            return OpResult<MiniTestDto>.Fail("Мини-тест ещё не открыт.");

        var elapsed = (DateTimeOffset.UtcNow - activity.MiniTestOpenedAt.Value).TotalSeconds;
        var remaining = (int)Math.Max(0, activity.MiniTestDurationSeconds - elapsed);
        var isOpen = remaining > 0;

        var questions = await _db.MiniTestQuestions
            .AsNoTracking()
            .Where(q => q.ActivityId == activityId)
            .OrderBy(q => q.Order)
            .ToListAsync(ct);

        var dtos = questions.Select(q =>
        {
            var opts = JsonSerializer.Deserialize<string[]>(q.OptionsJson) ?? [];
            return new QuestionDto(q.Id, q.Order, q.Text, opts);
        }).ToList();

        return OpResult<MiniTestDto>.Ok(new MiniTestDto(activityId, isOpen, remaining, dtos));
    }

    public async Task<OpResult<Unit>> Submit(
        Guid actorId, Guid activityId, IReadOnlyList<StudentAnswer> answers, CancellationToken ct = default)
    {
        var activity = await _db.Activities.AsNoTracking().FirstOrDefaultAsync(a => a.Id == activityId, ct);
        if (activity is null || activity.Type != ActivityType.Lecture)
            return OpResult<Unit>.Fail("Занятие не найдено.");

        if (!activity.MiniTestPublished || activity.MiniTestOpenedAt is null)
            return OpResult<Unit>.Fail("Мини-тест не открыт.");

        var elapsed = (DateTimeOffset.UtcNow - activity.MiniTestOpenedAt.Value).TotalSeconds;
        if (elapsed > activity.MiniTestDurationSeconds)
            return OpResult<Unit>.Fail("Время мини-теста истекло.");

        var alreadyAnswered = await _db.MiniTestAnswers
            .AnyAsync(a => a.ActivityId == activityId && a.StudentId == actorId, ct);
        if (alreadyAnswered)
            return OpResult<Unit>.Fail("Вы уже сдали мини-тест.");

        var questions = await _db.MiniTestQuestions
            .AsNoTracking()
            .Where(q => q.ActivityId == activityId)
            .ToListAsync(ct);

        if (questions.Count == 0)
            return OpResult<Unit>.Fail("Нет вопросов.");

        var now = DateTimeOffset.UtcNow;
        int correct = 0;

        foreach (var ans in answers)
        {
            var q = questions.FirstOrDefault(x => x.Id == ans.QuestionId);
            if (q is null) continue;
            bool isCorrect = ans.SelectedOptionIndex == q.CorrectOptionIndex;
            if (isCorrect) correct++;

            _db.MiniTestAnswers.Add(new MiniTestAnswer
            {
                Id = Guid.NewGuid(),
                ActivityId = activityId,
                StudentId = actorId,
                QuestionId = ans.QuestionId,
                SelectedOptionIndex = ans.SelectedOptionIndex,
                AnsweredAt = now,
                BonusAwarded = 0 // computed below
            });
        }

        // Compute bonus: (correct / total) * MiniTestMaxBonus
        decimal bonus = questions.Count > 0
            ? Math.Round((decimal)correct / questions.Count * activity.MiniTestMaxBonus, 4)
            : 0;

        // Back-fill bonus on all answers just added
        var added = _db.ChangeTracker.Entries<MiniTestAnswer>()
            .Where(e => e.State == Microsoft.EntityFrameworkCore.EntityState.Added && e.Entity.StudentId == actorId && e.Entity.ActivityId == activityId)
            .ToList();
        foreach (var e in added)
            e.Entity.BonusAwarded = bonus;

        await _db.SaveChangesAsync(ct);
        return OpResult<Unit>.Ok(Unit.Value);
    }
}
