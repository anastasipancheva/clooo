using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ScoreHub.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSessionFlowFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "DefenderUserId",
                table: "TaskSubmissions",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "MiniTestMaxPoints",
                table: "Activities",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "MiniTestAttempts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    ActivityId = table.Column<Guid>(type: "TEXT", nullable: false),
                    UserId = table.Column<Guid>(type: "TEXT", nullable: false),
                    SubmittedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    Score = table.Column<decimal>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MiniTestAttempts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MiniTestAttempts_Activities_ActivityId",
                        column: x => x.ActivityId,
                        principalTable: "Activities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MiniTestAttempts_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TaskSubmissions_DefenderUserId",
                table: "TaskSubmissions",
                column: "DefenderUserId");

            migrationBuilder.CreateIndex(
                name: "IX_MiniTestAttempts_ActivityId_UserId",
                table: "MiniTestAttempts",
                columns: new[] { "ActivityId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MiniTestAttempts_UserId",
                table: "MiniTestAttempts",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_TaskSubmissions_Users_DefenderUserId",
                table: "TaskSubmissions",
                column: "DefenderUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TaskSubmissions_Users_DefenderUserId",
                table: "TaskSubmissions");

            migrationBuilder.DropTable(
                name: "MiniTestAttempts");

            migrationBuilder.DropIndex(
                name: "IX_TaskSubmissions_DefenderUserId",
                table: "TaskSubmissions");

            migrationBuilder.DropColumn(
                name: "DefenderUserId",
                table: "TaskSubmissions");

            migrationBuilder.DropColumn(
                name: "MiniTestMaxPoints",
                table: "Activities");
        }
    }
}
