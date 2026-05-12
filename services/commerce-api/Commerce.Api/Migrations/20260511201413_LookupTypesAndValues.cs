using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Commerce.Api.Migrations
{
    /// <inheritdoc />
    public partial class LookupTypesAndValues : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "lookup_types",
                columns: table => new
                {
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Title = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Description = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: true),
                    ParentLookupTypeId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    ParentFieldLabel = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    EntryIdPrefix = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lookup_types", x => new { x.TenantId, x.Id });
                    table.ForeignKey(
                        name: "FK_lookup_types_lookup_types_TenantId_ParentLookupTypeId",
                        columns: x => new { x.TenantId, x.ParentLookupTypeId },
                        principalTable: "lookup_types",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "lookup_values",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    LookupTypeId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Code = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Label = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    ParentValueId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lookup_values", x => x.Id);
                    table.ForeignKey(
                        name: "FK_lookup_values_lookup_types_TenantId_LookupTypeId",
                        columns: x => new { x.TenantId, x.LookupTypeId },
                        principalTable: "lookup_types",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_lookup_values_lookup_values_ParentValueId",
                        column: x => x.ParentValueId,
                        principalTable: "lookup_values",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_lookup_types_TenantId_ParentLookupTypeId",
                table: "lookup_types",
                columns: new[] { "TenantId", "ParentLookupTypeId" });

            migrationBuilder.CreateIndex(
                name: "IX_lookup_values_ParentValueId",
                table: "lookup_values",
                column: "ParentValueId");

            migrationBuilder.CreateIndex(
                name: "IX_lookup_values_TenantId_LookupTypeId_Code",
                table: "lookup_values",
                columns: new[] { "TenantId", "LookupTypeId", "Code" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "lookup_values");

            migrationBuilder.DropTable(
                name: "lookup_types");
        }
    }
}
