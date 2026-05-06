using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ScoreHub.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFullDomainModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "Published",
                table: "TaskSets",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "FinalGradingTableJson",
                table: "Courses",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "KtMultiplierMapJson",
                table: "Courses",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<decimal>(
                name: "LectureBasePoints",
                table: "Activities",
                type: "TEXT",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "MiniTestDurationSeconds",
                table: "Activities",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "MiniTestMaxBonus",
                table: "Activities",
                type: "TEXT",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "MiniTestOpenedAt",
                table: "Activities",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "MiniTestPublished",
                table: "Activities",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "PreLectureVideoUrl",
                table: "Activities",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ActivityAssistants",
                columns: table => new
                {
                    ActivityId = table.Column<Guid>(type: "TEXT", nullable: false),
                    AssistantId = table.Column<Guid>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ActivityAssistants", x => new { x.ActivityId, x.AssistantId });
                    table.ForeignKey(
                        name: "FK_ActivityAssistants_Activities_ActivityId",
                        column: x => x.ActivityId,
                        principalTable: "Activities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ActivityAssistants_Users_AssistantId",
                        column: x => x.AssistantId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "HomeworkSubmissions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    ActivityId = table.Column<Guid>(type: "TEXT", nullable: false),
                    TaskItemId = table.Column<Guid>(type: "TEXT", nullable: false),
                    DocumentUrl = table.Column<string>(type: "TEXT", nullable: false),
                    SubmittedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    Status = table.Column<int>(type: "INTEGER", nullable: false),
                    ReviewerId = table.Column<Guid>(type: "TEXT", nullable: true),
                    ReviewStartedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: true),
                    ReviewedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: true),
                    Result01 = table.Column<int>(type: "INTEGER", nullable: true),
                    TimeCoefficient = table.Column<decimal>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HomeworkSubmissions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_HomeworkSubmissions_Activities_ActivityId",
                        column: x => x.ActivityId,
                        principalTable: "Activities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_HomeworkSubmissions_TaskItems_TaskItemId",
                        column: x => x.TaskItemId,
                        principalTable: "TaskItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_HomeworkSubmissions_Users_ReviewerId",
                        column: x => x.ReviewerId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "MiniTestQuestions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    ActivityId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Order = table.Column<int>(type: "INTEGER", nullable: false),
                    Text = table.Column<string>(type: "TEXT", nullable: false),
                    OptionsJson = table.Column<string>(type: "TEXT", nullable: false),
                    CorrectOptionIndex = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MiniTestQuestions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MiniTestQuestions_Activities_ActivityId",
                        column: x => x.ActivityId,
                        principalTable: "Activities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "StudentActivityScores",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    CourseId = table.Column<Guid>(type: "TEXT", nullable: false),
                    StudentId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ModuleNumber = table.Column<int>(type: "INTEGER", nullable: false),
                    LecturePoints = table.Column<decimal>(type: "TEXT", nullable: false),
                    HomeworkPoints = table.Column<decimal>(type: "TEXT", nullable: false),
                    KtMultiplier = table.Column<decimal>(type: "TEXT", nullable: false),
                    ModuleScore = table.Column<decimal>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StudentActivityScores", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StudentActivityScores_Courses_CourseId",
                        column: x => x.CourseId,
                        principalTable: "Courses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_StudentActivityScores_Users_StudentId",
                        column: x => x.StudentId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TeamGroupScores",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    TeamId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ActivityId = table.Column<Guid>(type: "TEXT", nullable: false),
                    TasksAccepted = table.Column<int>(type: "INTEGER", nullable: false),
                    TasksTotal = table.Column<int>(type: "INTEGER", nullable: false),
                    BasePoints = table.Column<decimal>(type: "TEXT", nullable: false),
                    GroupCoefficient = table.Column<decimal>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeamGroupScores", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TeamGroupScores_Activities_ActivityId",
                        column: x => x.ActivityId,
                        principalTable: "Activities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TeamGroupScores_Teams_TeamId",
                        column: x => x.TeamId,
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TeamSwapLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    ActivityId = table.Column<Guid>(type: "TEXT", nullable: false),
                    StudentAId = table.Column<Guid>(type: "TEXT", nullable: false),
                    TeamAId = table.Column<Guid>(type: "TEXT", nullable: false),
                    StudentBId = table.Column<Guid>(type: "TEXT", nullable: false),
                    TeamBId = table.Column<Guid>(type: "TEXT", nullable: false),
                    InitiatedByUserId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeamSwapLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TeamSwapLogs_Users_InitiatedByUserId",
                        column: x => x.InitiatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TeamSwapLogs_Users_StudentAId",
                        column: x => x.StudentAId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TeamSwapLogs_Users_StudentBId",
                        column: x => x.StudentBId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "HomeworkSubmissionMembers",
                columns: table => new
                {
                    HomeworkSubmissionId = table.Column<Guid>(type: "TEXT", nullable: false),
                    UserId = table.Column<Guid>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HomeworkSubmissionMembers", x => new { x.HomeworkSubmissionId, x.UserId });
                    table.ForeignKey(
                        name: "FK_HomeworkSubmissionMembers_HomeworkSubmissions_HomeworkSubmissionId",
                        column: x => x.HomeworkSubmissionId,
                        principalTable: "HomeworkSubmissions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_HomeworkSubmissionMembers_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "MiniTestAnswers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    ActivityId = table.Column<Guid>(type: "TEXT", nullable: false),
                    StudentId = table.Column<Guid>(type: "TEXT", nullable: false),
                    QuestionId = table.Column<Guid>(type: "TEXT", nullable: false),
                    SelectedOptionIndex = table.Column<int>(type: "INTEGER", nullable: false),
                    AnsweredAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    BonusAwarded = table.Column<decimal>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MiniTestAnswers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MiniTestAnswers_MiniTestQuestions_QuestionId",
                        column: x => x.QuestionId,
                        principalTable: "MiniTestQuestions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MiniTestAnswers_Users_StudentId",
                        column: x => x.StudentId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ActivityAssistants_AssistantId",
                table: "ActivityAssistants",
                column: "AssistantId");

            migrationBuilder.CreateIndex(
                name: "IX_HomeworkSubmissionMembers_UserId",
                table: "HomeworkSubmissionMembers",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_HomeworkSubmissions_ActivityId",
                table: "HomeworkSubmissions",
                column: "ActivityId");

            migrationBuilder.CreateIndex(
                name: "IX_HomeworkSubmissions_ReviewerId",
                table: "HomeworkSubmissions",
                column: "ReviewerId");

            migrationBuilder.CreateIndex(
                name: "IX_HomeworkSubmissions_TaskItemId",
                table: "HomeworkSubmissions",
                column: "TaskItemId");

            migrationBuilder.CreateIndex(
                name: "IX_MiniTestAnswers_ActivityId_StudentId_QuestionId",
                table: "MiniTestAnswers",
                columns: new[] { "ActivityId", "StudentId", "QuestionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MiniTestAnswers_QuestionId",
                table: "MiniTestAnswers",
                column: "QuestionId");

            migrationBuilder.CreateIndex(
                name: "IX_MiniTestAnswers_StudentId",
                table: "MiniTestAnswers",
                column: "StudentId");

            migrationBuilder.CreateIndex(
                name: "IX_MiniTestQuestions_ActivityId",
                table: "MiniTestQuestions",
                column: "ActivityId");

            migrationBuilder.CreateIndex(
                name: "IX_StudentActivityScores_CourseId_StudentId_ModuleNumber",
                table: "StudentActivityScores",
                columns: new[] { "CourseId", "StudentId", "ModuleNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StudentActivityScores_StudentId",
                table: "StudentActivityScores",
                column: "StudentId");

            migrationBuilder.CreateIndex(
                name: "IX_TeamGroupScores_ActivityId",
                table: "TeamGroupScores",
                column: "ActivityId");

            migrationBuilder.CreateIndex(
                name: "IX_TeamGroupScores_TeamId_ActivityId",
                table: "TeamGroupScores",
                columns: new[] { "TeamId", "ActivityId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TeamSwapLogs_InitiatedByUserId",
                table: "TeamSwapLogs",
                column: "InitiatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_TeamSwapLogs_StudentAId",
                table: "TeamSwapLogs",
                column: "StudentAId");

            migrationBuilder.CreateIndex(
                name: "IX_TeamSwapLogs_StudentBId",
                table: "TeamSwapLogs",
                column: "StudentBId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ActivityAssistants");

            migrationBuilder.DropTable(
                name: "HomeworkSubmissionMembers");

            migrationBuilder.DropTable(
                name: "MiniTestAnswers");

            migrationBuilder.DropTable(
                name: "StudentActivityScores");

            migrationBuilder.DropTable(
                name: "TeamGroupScores");

            migrationBuilder.DropTable(
                name: "TeamSwapLogs");

            migrationBuilder.DropTable(
                name: "HomeworkSubmissions");

            migrationBuilder.DropTable(
                name: "MiniTestQuestions");

            migrationBuilder.DropColumn(
                name: "Published",
                table: "TaskSets");

            migrationBuilder.DropColumn(
                name: "FinalGradingTableJson",
                table: "Courses");

            migrationBuilder.DropColumn(
                name: "KtMultiplierMapJson",
                table: "Courses");

            migrationBuilder.DropColumn(
                name: "LectureBasePoints",
                table: "Activities");

            migrationBuilder.DropColumn(
                name: "MiniTestDurationSeconds",
                table: "Activities");

            migrationBuilder.DropColumn(
                name: "MiniTestMaxBonus",
                table: "Activities");

            migrationBuilder.DropColumn(
                name: "MiniTestOpenedAt",
                table: "Activities");

            migrationBuilder.DropColumn(
                name: "MiniTestPublished",
                table: "Activities");

            migrationBuilder.DropColumn(
                name: "PreLectureVideoUrl",
                table: "Activities");
        }
    }
}
