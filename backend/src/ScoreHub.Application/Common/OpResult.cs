namespace ScoreHub.Application.Common;

public readonly record struct OpResult<T>(bool IsOk, T? Value, string? Error)
{
    public static OpResult<T> Ok(T value) => new(true, value, null);
    public static OpResult<T> Fail(string error) => new(false, default, error);
}
