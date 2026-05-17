using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Commerce.Api.Migrations
{
    /// <inheritdoc />
    public partial class StorefrontOrders : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "storefront_orders",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ShopperPortalUserId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    ShopperEmail = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    ShopperName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ShopperPhone = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    ShippingAddressJson = table.Column<string>(type: "text", nullable: true),
                    ProductTypeId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    PaymentMethod = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    PaymentStatus = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    TotalMinor = table.Column<long>(type: "bigint", nullable: false),
                    Currency = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    PlacedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_storefront_orders", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "storefront_order_lines",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    OrderId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ProductId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    SkuId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    SkuCode = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    TitleDisplay = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    VendorPortalUserId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    VendorCode = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    UnitPriceMinor = table.Column<long>(type: "bigint", nullable: false),
                    Currency = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_storefront_order_lines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_storefront_order_lines_storefront_orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "storefront_orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_storefront_order_lines_OrderId",
                table: "storefront_order_lines",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_storefront_orders_TenantId_PlacedAt",
                table: "storefront_orders",
                columns: new[] { "TenantId", "PlacedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_storefront_orders_TenantId_ShopperPortalUserId_PlacedAt",
                table: "storefront_orders",
                columns: new[] { "TenantId", "ShopperPortalUserId", "PlacedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "storefront_order_lines");

            migrationBuilder.DropTable(
                name: "storefront_orders");
        }
    }
}
