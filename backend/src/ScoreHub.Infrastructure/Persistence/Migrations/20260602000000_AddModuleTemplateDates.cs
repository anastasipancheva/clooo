using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ScoreHub.Infrastructure.Persistence.Migrations
{
    public partial class AddModuleTemplateDates : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "StartsAt",
                table: "ModuleTemplates",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "EndsAt",
                table: "ModuleTemplates",
                type: "TEXT",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "StartsAt", table: "ModuleTemplates");
            migrationBuilder.DropColumn(name: "EndsAt",   table: "ModuleTemplates");
        }
    }
}
