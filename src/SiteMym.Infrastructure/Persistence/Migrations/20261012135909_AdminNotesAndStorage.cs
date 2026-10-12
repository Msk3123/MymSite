using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SiteMym.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AdminNotesAndStorage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "storage_location",
                table: "products",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "admin_note",
                table: "orders",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "storage_location",
                table: "products");

            migrationBuilder.DropColumn(
                name: "admin_note",
                table: "orders");
        }
    }
}
