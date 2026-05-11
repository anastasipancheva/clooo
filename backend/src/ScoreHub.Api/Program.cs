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
    throw new InvalidOperationException("Jwt:SigningKey is missing or shorter than 32 characters.");

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

// CORS: origins прописаны в appsettings.json (ключ CORS_ORIGINS, через запятую)
var corsOrigins = (builder.Configuration["CORS_ORIGINS"] ?? "http://localhost:3000")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
Console.WriteLine(corsOrigins);
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins("https://clooo-p4pm.vercel.app")
     .AllowAnyHeader()
     .AllowAnyMethod()
     .AllowCredentials()));

var app = builder.Build();

await app.MigrateAndSeedAsync();

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
