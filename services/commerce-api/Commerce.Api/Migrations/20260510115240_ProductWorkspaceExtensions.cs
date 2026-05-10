using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Commerce.Api.Migrations
{
    /// <inheritdoc />
    public partial class ProductWorkspaceExtensions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "CompareAtPriceMinor",
                table: "skus",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "ListPriceMinor",
                table: "skus",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CommerceJson",
                table: "products",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProductTypeId",
                table: "products",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CompareAtPriceMinor",
                table: "skus");

            migrationBuilder.DropColumn(
                name: "ListPriceMinor",
                table: "skus");

            migrationBuilder.DropColumn(
                name: "CommerceJson",
                table: "products");

            migrationBuilder.DropColumn(
                name: "ProductTypeId",
                table: "products");
        }
    }
}
