using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Commerce.Api.Migrations
{
    /// <inheritdoc />
    public partial class EnsurePortalUserRoleAssignments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                CREATE TABLE IF NOT EXISTS portal_user_role_assignments (
                    "Id" character varying(64) NOT NULL,
                    "TenantId" character varying(64) NOT NULL,
                    "PortalUserId" character varying(64) NOT NULL,
                    "RoleKey" character varying(48) NOT NULL,
                    "PortalBaseRole" character varying(16) NOT NULL,
                    "IsPrimary" boolean NOT NULL,
                    "ScopeJson" text,
                    "ValidFrom" timestamp with time zone,
                    "ValidTo" timestamp with time zone,
                    "CreatedAt" timestamp with time zone NOT NULL,
                    "CreatedByUserId" character varying(64),
                    CONSTRAINT "PK_portal_user_role_assignments" PRIMARY KEY ("Id")
                );
                """);

            migrationBuilder.Sql(
                """
                CREATE INDEX IF NOT EXISTS "IX_portal_user_role_assignments_TenantId_PortalUserId_IsPrimary"
                ON portal_user_role_assignments ("TenantId", "PortalUserId", "IsPrimary");
                """);

            migrationBuilder.Sql(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_portal_user_role_assignments_TenantId_PortalUserId_RoleKey"
                ON portal_user_role_assignments ("TenantId", "PortalUserId", "RoleKey");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "portal_user_role_assignments");
        }
    }
}
