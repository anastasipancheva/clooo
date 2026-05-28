using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ScoreHub.Infrastructure.Persistence.Migrations
{
    public partial class AddCourseTemplates : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CourseTemplates",
                columns: table => new
                {
                    Id          = table.Column<Guid>(type: "TEXT", nullable: false),
                    Title       = table.Column<string>(type: "TEXT", nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedAt   = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: t => t.PrimaryKey("PK_CourseTemplates", x => x.Id));

            migrationBuilder.CreateTable(
                name: "ModuleTemplates",
                columns: table => new
                {
                    Id               = table.Column<Guid>(type: "TEXT", nullable: false),
                    CourseTemplateId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Number           = table.Column<int>(type: "INTEGER", nullable: false),
                    Title            = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: t =>
                {
                    t.PrimaryKey("PK_ModuleTemplates", x => x.Id);
                    t.ForeignKey("FK_ModuleTemplates_CourseTemplates_CourseTemplateId",
                        x => x.CourseTemplateId, "CourseTemplates", "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ActivityTemplates",
                columns: table => new
                {
                    Id               = table.Column<Guid>(type: "TEXT", nullable: false),
                    ModuleTemplateId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Type             = table.Column<int>(type: "INTEGER", nullable: false),
                    Title            = table.Column<string>(type: "TEXT", nullable: false),
                    TaskFileUrl      = table.Column<string>(type: "TEXT", nullable: true),
                    TheoryTestUrl    = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: t =>
                {
                    t.PrimaryKey("PK_ActivityTemplates", x => x.Id);
                    t.ForeignKey("FK_ActivityTemplates_ModuleTemplates_ModuleTemplateId",
                        x => x.ModuleTemplateId, "ModuleTemplates", "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TaskTemplates",
                columns: table => new
                {
                    Id                 = table.Column<Guid>(type: "TEXT", nullable: false),
                    ActivityTemplateId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Code               = table.Column<string>(type: "TEXT", nullable: false),
                    Title              = table.Column<string>(type: "TEXT", nullable: false),
                    Points             = table.Column<decimal>(type: "TEXT", nullable: false)
                },
                constraints: t =>
                {
                    t.PrimaryKey("PK_TaskTemplates", x => x.Id);
                    t.ForeignKey("FK_TaskTemplates_ActivityTemplates_ActivityTemplateId",
                        x => x.ActivityTemplateId, "ActivityTemplates", "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex("IX_ModuleTemplates_CourseTemplateId",  "ModuleTemplates",  "CourseTemplateId");
            migrationBuilder.CreateIndex("IX_ActivityTemplates_ModuleTemplateId", "ActivityTemplates", "ModuleTemplateId");
            migrationBuilder.CreateIndex("IX_TaskTemplates_ActivityTemplateId",   "TaskTemplates",    "ActivityTemplateId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable("TaskTemplates");
            migrationBuilder.DropTable("ActivityTemplates");
            migrationBuilder.DropTable("ModuleTemplates");
            migrationBuilder.DropTable("CourseTemplates");
        }
    }
}
