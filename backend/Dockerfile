# ── Build stage ─────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# 1. Копируем только csproj/sln для кэширования restore
COPY backend/ScoreHub.sln                                                    ./
COPY backend/src/ScoreHub.Domain/ScoreHub.Domain.csproj                     src/ScoreHub.Domain/
COPY backend/src/ScoreHub.Application/ScoreHub.Application.csproj           src/ScoreHub.Application/
COPY backend/src/ScoreHub.Infrastructure/ScoreHub.Infrastructure.csproj     src/ScoreHub.Infrastructure/
COPY backend/src/ScoreHub.Api/ScoreHub.Api.csproj                           src/ScoreHub.Api/

RUN dotnet restore

# 2. Копируем исходный код по проектам (избегаем COPY directory/)
COPY backend/src/ScoreHub.Domain/       src/ScoreHub.Domain/
COPY backend/src/ScoreHub.Application/  src/ScoreHub.Application/
COPY backend/src/ScoreHub.Infrastructure/ src/ScoreHub.Infrastructure/
COPY backend/src/ScoreHub.Api/          src/ScoreHub.Api/

RUN dotnet publish src/ScoreHub.Api/ScoreHub.Api.csproj \
    -c Release -o /app/publish --no-restore

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

RUN mkdir -p /data && chown -R app:app /data

COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8080
ENV ConnectionStrings__ScoreHub="Data Source=/data/scorehub.db"

EXPOSE 8080

ENTRYPOINT ["dotnet", "ScoreHub.Api.dll"]
