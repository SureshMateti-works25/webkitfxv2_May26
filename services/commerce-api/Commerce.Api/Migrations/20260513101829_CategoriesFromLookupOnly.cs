using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Commerce.Api.Migrations
{
    /// <inheritdoc />
    public partial class CategoriesFromLookupOnly : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "MerchandisingParentId",
                table: "lookup_values",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            // Tree parent for storefront browse (was categories.parent_id).
            migrationBuilder.Sql(
                """
                UPDATE lookup_values AS lv
                SET "MerchandisingParentId" = c."ParentId"
                FROM categories AS c
                WHERE lv."Id" = c."Id"
                  AND lv."LookupTypeId" = 'product_categories';
                """);

            // Any catalog category row not yet in lookup_values (same id as categories.id).
            migrationBuilder.Sql(
                """
                INSERT INTO lookup_values ("Id", "TenantId", "LookupTypeId", "Code", "Label", "SortOrder", "ParentValueId", "MerchandisingParentId")
                SELECT c."Id",
                       c."TenantId",
                       'product_categories',
                       lower(trim(c."Slug")),
                       trim(c."Slug"),
                       c."SortOrder",
                       NULL,
                       c."ParentId"
                FROM categories c
                WHERE NOT EXISTS (SELECT 1 FROM lookup_values lv WHERE lv."Id" = c."Id");
                """);

            migrationBuilder.DropForeignKey(
                name: "FK_product_categories_categories_CategoryId",
                table: "product_categories");

            migrationBuilder.DropTable(
                name: "categories");

            migrationBuilder.CreateIndex(
                name: "IX_lookup_values_MerchandisingParentId",
                table: "lookup_values",
                column: "MerchandisingParentId");

            migrationBuilder.AddForeignKey(
                name: "FK_lookup_values_lookup_values_MerchandisingParentId",
                table: "lookup_values",
                column: "MerchandisingParentId",
                principalTable: "lookup_values",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_product_categories_lookup_values_CategoryId",
                table: "product_categories",
                column: "CategoryId",
                principalTable: "lookup_values",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_lookup_values_lookup_values_MerchandisingParentId",
                table: "lookup_values");

            migrationBuilder.DropForeignKey(
                name: "FK_product_categories_lookup_values_CategoryId",
                table: "product_categories");

            migrationBuilder.DropIndex(
                name: "IX_lookup_values_MerchandisingParentId",
                table: "lookup_values");

            migrationBuilder.DropColumn(
                name: "MerchandisingParentId",
                table: "lookup_values");

            migrationBuilder.CreateTable(
                name: "categories",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ParentId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    Slug = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_categories", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_categories_TenantId_ParentId",
                table: "categories",
                columns: new[] { "TenantId", "ParentId" });

            migrationBuilder.CreateIndex(
                name: "IX_categories_TenantId_Slug",
                table: "categories",
                columns: new[] { "TenantId", "Slug" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_product_categories_categories_CategoryId",
                table: "product_categories",
                column: "CategoryId",
                principalTable: "categories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
