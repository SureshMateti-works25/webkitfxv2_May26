using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Commerce.Api.Migrations
{
    /// <inheritdoc />
    public partial class OrderFulfillmentTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FulfillmentStatus",
                table: "storefront_orders",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "placed");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "StatusUpdatedAt",
                table: "storefront_orders",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "NOW()");

            migrationBuilder.Sql(
                """
                UPDATE storefront_orders
                SET "FulfillmentStatus" = 'placed',
                    "StatusUpdatedAt" = COALESCE("PlacedAt", NOW())
                WHERE "FulfillmentStatus" = '' OR "FulfillmentStatus" IS NULL;
                """);

            migrationBuilder.AddColumn<string>(
                name: "TrackingNote",
                table: "storefront_orders",
                type: "character varying(512)",
                maxLength: 512,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FulfillmentStatus",
                table: "storefront_orders");

            migrationBuilder.DropColumn(
                name: "StatusUpdatedAt",
                table: "storefront_orders");

            migrationBuilder.DropColumn(
                name: "TrackingNote",
                table: "storefront_orders");
        }
    }
}
