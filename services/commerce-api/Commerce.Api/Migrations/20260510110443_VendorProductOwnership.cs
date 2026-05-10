using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Commerce.Api.Migrations
{
    /// <inheritdoc />
    public partial class VendorProductOwnership : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "VendorPortalUserId",
                table: "products",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_products_TenantId_VendorPortalUserId",
                table: "products",
                columns: new[] { "TenantId", "VendorPortalUserId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_products_TenantId_VendorPortalUserId",
                table: "products");

            migrationBuilder.DropColumn(
                name: "VendorPortalUserId",
                table: "products");
        }
    }
}
