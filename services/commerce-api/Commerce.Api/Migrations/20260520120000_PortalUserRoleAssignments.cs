using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Commerce.Api.Migrations
{
    /// <inheritdoc />
    public partial class PortalUserRoleAssignments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "portal_user_role_assignments",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    PortalUserId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    RoleKey = table.Column<string>(type: "character varying(48)", maxLength: 48, nullable: false),
                    PortalBaseRole = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    IsPrimary = table.Column<bool>(type: "boolean", nullable: false),
                    ScopeJson = table.Column<string>(type: "text", nullable: true),
                    ValidFrom = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ValidTo = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_portal_user_role_assignments", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_portal_user_role_assignments_TenantId_PortalUserId_IsPrimary",
                table: "portal_user_role_assignments",
                columns: new[] { "TenantId", "PortalUserId", "IsPrimary" });

            migrationBuilder.CreateIndex(
                name: "IX_portal_user_role_assignments_TenantId_PortalUserId_RoleKey",
                table: "portal_user_role_assignments",
                columns: new[] { "TenantId", "PortalUserId", "RoleKey" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "portal_user_role_assignments");
        }
    }
}
