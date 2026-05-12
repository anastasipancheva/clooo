# ── Build stage ─────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Копируем solution и csproj-файлы (для кэширования restore)
COPY ScoreHub.sln ./
COPY src/ScoreHub.Domain/ScoreHub.Domain.csproj             src/ScoreHub.Domain/
COPY src/ScoreHub.Application/ScoreHub.Application.csproj   src/ScoreHub.Application/
COPY src/ScoreHub.Infrastructure/ScoreHub.Infrastructure.csproj src/ScoreHub.Infrastructure/
COPY src/ScoreHub.Api/ScoreHub.Api.csproj                   src/ScoreHub.Api/

RUN dotnet restore

# Копируем весь исходный код и публикуем
COPY . .
RUN dotnet publish src/ScoreHub.Api/ScoreHub.Api.csproj \
    -c Release -o /app/publish --no-restore

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# SQLite будет писать базу в /data.
# .NET 8 runtime image запускается от непривилегированного пользователя "app" —
# нужно явно передать ему владение /data, иначе SQLite не сможет создать файл.
RUN mkdir -p /data && chown -R app:app /data

COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8080
ENV ConnectionStrings__ScoreHub="Data Source=/data/scorehub.db"

EXPOSE 8080

ENTRYPOINT ["dotnet", "ScoreHub.Api.dll"]
