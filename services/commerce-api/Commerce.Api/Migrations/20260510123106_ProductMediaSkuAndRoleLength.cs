using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Commerce.Api.Migrations
{
    /// <inheritdoc />
    public partial class ProductMediaSkuAndRoleLength : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Role",
                table: "product_media",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(32)",
                oldMaxLength: 32);

            migrationBuilder.AddColumn<string>(
                name: "SkuId",
                table: "product_media",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_product_media_SkuId",
                table: "product_media",
                column: "SkuId");

            migrationBuilder.AddForeignKey(
                name: "FK_product_media_skus_SkuId",
                table: "product_media",
                column: "SkuId",
                principalTable: "skus",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_product_media_skus_SkuId",
                table: "product_media");

            migrationBuilder.DropIndex(
                name: "IX_product_media_SkuId",
                table: "product_media");

            migrationBuilder.DropColumn(
                name: "SkuId",
                table: "product_media");

            migrationBuilder.AlterColumn<string>(
                name: "Role",
                table: "product_media",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(64)",
                oldMaxLength: 64);
        }
    }
}
