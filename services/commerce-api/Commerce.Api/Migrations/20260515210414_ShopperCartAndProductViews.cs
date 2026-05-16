using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Commerce.Api.Migrations
{
    /// <inheritdoc />
    public partial class ShopperCartAndProductViews : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "shopper_carts",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    PortalUserId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_shopper_carts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "shopper_product_views",
                columns: table => new
                {
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    PortalUserId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ProductId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ViewedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_shopper_product_views", x => new { x.TenantId, x.PortalUserId, x.ProductId });
                });

            migrationBuilder.CreateTable(
                name: "shopper_cart_lines",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CartId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ProductId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    SkuId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    UnitPriceMinor = table.Column<long>(type: "bigint", nullable: true),
                    Currency = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: true),
                    PackLabel = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    PackUnitType = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    PackQuantity = table.Column<decimal>(type: "numeric", nullable: true),
                    UnitsPerPack = table.Column<decimal>(type: "numeric", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_shopper_cart_lines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_shopper_cart_lines_products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_shopper_cart_lines_shopper_carts_CartId",
                        column: x => x.CartId,
                        principalTable: "shopper_carts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_shopper_cart_lines_CartId_ProductId_SkuId",
                table: "shopper_cart_lines",
                columns: new[] { "CartId", "ProductId", "SkuId" });

            migrationBuilder.CreateIndex(
                name: "IX_shopper_cart_lines_ProductId",
                table: "shopper_cart_lines",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_shopper_carts_TenantId_PortalUserId",
                table: "shopper_carts",
                columns: new[] { "TenantId", "PortalUserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_shopper_product_views_TenantId_PortalUserId_ViewedAt",
                table: "shopper_product_views",
                columns: new[] { "TenantId", "PortalUserId", "ViewedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "shopper_cart_lines");

            migrationBuilder.DropTable(
                name: "shopper_product_views");

            migrationBuilder.DropTable(
                name: "shopper_carts");
        }
    }
}
