# ── Build stage ─────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Railway BuildKit не может COPY поддиректории — копируем весь контекст целиком
COPY . .

RUN dotnet restore backend/ScoreHub.sln

RUN dotnet publish backend/src/ScoreHub.Api/ScoreHub.Api.csproj \
    -c Release -o /app/publish

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

RUN mkdir -p /data && chown -R app:app /data

COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8080
ENV ConnectionStrings__ScoreHub="Data Source=/data/scorehub.db"

EXPOSE 8080

ENTRYPOINT ["dotnet", "ScoreHub.Api.dll"]
