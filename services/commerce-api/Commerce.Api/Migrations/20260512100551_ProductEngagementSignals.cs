using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Commerce.Api.Migrations
{
    /// <inheritdoc />
    public partial class ProductEngagementSignals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "product_comments",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ProductId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CommentText = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: false),
                    AuthorName = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_product_comments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "product_engagement_summaries",
                columns: table => new
                {
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ProductId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ViewsCount = table.Column<long>(type: "bigint", nullable: false),
                    RatingsTotal = table.Column<long>(type: "bigint", nullable: false),
                    RatingsCount = table.Column<int>(type: "integer", nullable: false),
                    CommentsCount = table.Column<int>(type: "integer", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_product_engagement_summaries", x => new { x.TenantId, x.ProductId });
                });

            migrationBuilder.CreateTable(
                name: "product_ratings",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    TenantId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ProductId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Score = table.Column<int>(type: "integer", nullable: false),
                    AuthorName = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    CommentText = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_product_ratings", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_product_comments_TenantId_ProductId_CreatedAt",
                table: "product_comments",
                columns: new[] { "TenantId", "ProductId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_product_engagement_summaries_ProductId",
                table: "product_engagement_summaries",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_product_ratings_TenantId_ProductId_CreatedAt",
                table: "product_ratings",
                columns: new[] { "TenantId", "ProductId", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "product_comments");

            migrationBuilder.DropTable(
                name: "product_engagement_summaries");

            migrationBuilder.DropTable(
                name: "product_ratings");
        }
    }
}
