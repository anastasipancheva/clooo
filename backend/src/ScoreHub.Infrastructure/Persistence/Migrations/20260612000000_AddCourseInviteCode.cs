using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ScoreHub.Infrastructure.Persistence.Migrations
{
    public partial class AddCourseInviteCode : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Add column as nullable first
            migrationBuilder.AddColumn<string>(
                name: "InviteCode",
                table: "Courses",
                type: "TEXT",
                nullable: true);

            // Backfill existing rows with a random 8-char hex code
            migrationBuilder.Sql(
                """
                UPDATE Courses
                SET InviteCode = lower(hex(randomblob(4)))
                WHERE InviteCode IS NULL;
                """);

            // Now make it NOT NULL
            migrationBuilder.AlterColumn<string>(
                name: "InviteCode",
                table: "Courses",
                type: "TEXT",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "TEXT",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Courses_InviteCode",
                table: "Courses",
                column: "InviteCode",
                unique: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(name: "IX_Courses_InviteCode", table: "Courses");
            migrationBuilder.DropColumn(name: "InviteCode", table: "Courses");
        }
    }
}
