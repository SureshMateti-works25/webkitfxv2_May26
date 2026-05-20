using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Commerce.Api.Migrations
{
    /// <inheritdoc />
    public partial class TenantStorefrontAndRbac : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CreatedAt",
                table: "tenants",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.AddColumn<string>(
                name: "HostAliasesJson",
                table: "tenants",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "tenants",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "StorefrontMode",
                table: "tenants",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Vertical",
                table: "tenants",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_tenants_IsActive",
                table: "tenants",
                column: "IsActive");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_tenants_IsActive",
                table: "tenants");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "tenants");

            migrationBuilder.DropColumn(
                name: "HostAliasesJson",
                table: "tenants");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "tenants");

            migrationBuilder.DropColumn(
                name: "StorefrontMode",
                table: "tenants");

            migrationBuilder.DropColumn(
                name: "Vertical",
                table: "tenants");
        }
    }
}
