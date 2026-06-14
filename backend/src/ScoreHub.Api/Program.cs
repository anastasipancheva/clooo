using System.Reflection;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using ScoreHub.Api.Extensions;
using ScoreHub.Api.Hubs;
using ScoreHub.Application.Abstractions;
using ScoreHub.Application.Auth;
using ScoreHub.Infrastructure.DependencyInjection;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<AdminSeedOptions>(
    builder.Configuration.GetSection(AdminSeedOptions.SectionName));

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSignalR();

builder.Services.AddSwaggerGen(c =>
{
    // Вложенные DTO разных контроллеров могут иметь одинаковое короткое имя
    // (напр. EnrollDto). По умолчанию Swashbuckle берёт Type.Name → коллизия schemaId.
    // Используем полное имя (с заменой '+' у вложенных типов) для уникальности.
    c.CustomSchemaIds(t => t.FullName?.Replace("+", ".") ?? t.Name);

    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "ScoreHub API",
        Version = "v1",
        Description =
            """
            API для автоматизации МКН2: курсы, занятия, команды, КТ, уведомления, JWT.

            **OpenAPI (Swagger) JSON:** после запуска приложения скачайте спецификацию по адресу `/swagger/v1/swagger.json`.

            **Авторизация:** нажмите «Authorize» и вставьте JWT.

            **SignalR:** подключиться к `/hubs/notifications` с JWT в query `?access_token=...`.
            """
    });

    var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath))
        c.IncludeXmlComments(xmlPath, includeControllerXmlComments: true);

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT: paste the raw token, or use \"Bearer {token}\".",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        [new OpenApiSecurityScheme
        {
            Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
        }] = Array.Empty<string>()
    });
});

builder.Services.AddInfrastructure(builder.Configuration);

// SignalR push (registered after AddSignalR so IHubContext is available)
builder.Services.AddScoped<IRealtimePushService, SignalRPushService>();

var jwtKey = builder.Configuration[$"{JwtOptions.SectionName}:SigningKey"];
if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.Length < 32)
{
    jwtKey = "ScoreHubFallbackKey_ChangeInProd_32ch!";
    Console.WriteLine("[WARN] Jwt:SigningKey not set — using insecure fallback key. Set Jwt__SigningKey env var in production!");
}

var issuer = builder.Configuration[$"{JwtOptions.SectionName}:Issuer"] ?? "ScoreHub";
var audience = builder.Configuration[$"{JwtOptions.SectionName}:Audience"] ?? "ScoreHub";

builder.Services.AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(o =>
    {
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = issuer,
            ValidateAudience = true,
            ValidAudience = audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(2)
        };
        // SignalR sends JWT via query string
        o.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var token = ctx.Request.Query["access_token"];
                var path = ctx.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(token) && path.StartsWithSegments("/hubs"))
                    ctx.Token = token;
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

// CORS: задаётся через env CORS_ORIGINS (через запятую) или appsettings.json
var corsOrigins = (builder.Configuration["CORS_ORIGINS"] ?? "http://localhost:4200")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
Console.WriteLine($"[CORS] allowed origins: {string.Join(", ", corsOrigins)}");
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins(corsOrigins)
     .AllowAnyHeader()
     .AllowAnyMethod()
     .AllowCredentials()));

var app = builder.Build();

await app.MigrateAndSeedAsync();

// Global exception handler — returns JSON { error: "..." } instead of plain-text 500
app.UseExceptionHandler(errApp => errApp.Run(async ctx =>
{
    ctx.Response.StatusCode = 500;
    ctx.Response.ContentType = "application/json";
    var ex = ctx.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>()?.Error;
    var msg = ex?.InnerException?.Message ?? ex?.Message ?? "Unexpected error";
    await ctx.Response.WriteAsJsonAsync(new { error = msg });
}));

app.UseSwagger();
app.UseSwaggerUI(o =>
{
    o.SwaggerEndpoint("/swagger/v1/swagger.json", "ScoreHub v1");
    o.DocumentTitle = "ScoreHub API";
});

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

// CORS must be before authentication/authorization
// Note: UseHttpsRedirection is intentionally omitted —
// Railway (and most PaaS) terminate TLS at the reverse proxy;
// the container only ever receives plain HTTP on port 8080.
app.UseCors();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<NotificationHub>("/hubs/notifications");

app.Run();
