using Catalog.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Catalog.Api.Data;

public static class CatalogDevDataSeeder
{
    public static async Task SeedAsync(CatalogDbContext db, CancellationToken ct = default)
    {
        if (await db.Categories.AnyAsync(ct))
            return;

        db.Categories.AddRange(
            new Category { Id = "cat_saree", TenantId = "t1", ParentId = null, Slug = "sarees", SortOrder = 10 },
            new Category { Id = "cat_silk", TenantId = "t1", ParentId = "cat_saree", Slug = "silk", SortOrder = 20 },
            new Category { Id = "cat_kan", TenantId = "t1", ParentId = "cat_silk", Slug = "kanjeevaram", SortOrder = 30 });

        db.AttributeDefs.AddRange(
            new AttributeDef
            {
                Id = "attr_color", TenantId = "t1", Code = "color", LabelKey = "attr.color", Filterable = true,
                Sortable = false, Searchable = true, DisplayType = "swatch", VariantAxisOrder = 1
            },
            new AttributeDef
            {
                Id = "attr_border", TenantId = "t1", Code = "border", LabelKey = "attr.border", Filterable = true,
                Sortable = true, Searchable = true, DisplayType = "pill", VariantAxisOrder = 2
            });

        db.AttributeValues.AddRange(
            new AttributeValue
            {
                Id = "av_maroon", AttributeDefId = "attr_color", Code = "maroon", LabelKey = "attrValue.color.maroon",
                SortKey = 10, SwatchHex = "#7b1e3a"
            },
            new AttributeValue
            {
                Id = "av_gold", AttributeDefId = "attr_border", Code = "gold-3cm", LabelKey = "attrValue.border.gold3cm",
                SortKey = 20, SwatchHex = null
            });

        var published = new DateTimeOffset(2026, 4, 22, 10, 0, 0, TimeSpan.Zero);
        db.Products.Add(new Product
        {
            Id = "p_kj001",
            TenantId = "t1",
            Slug = "royal-kanjeevaram-zari",
            TitleDisplay = "Royal Kanjeevaram Zari",
            SearchText = "royal kanjeevaram zari maroon wine burgundy silk",
            Status = "active",
            PublishedAt = published,
            HeroStorageKey = "t1/p_kj001/hero_01.jpg",
            MinPriceMinor = 2499900,
            Currency = "INR"
        });

        db.ProductCategories.AddRange(
            new ProductCategory { ProductId = "p_kj001", CategoryId = "cat_kan", IsPrimary = true, SortOrder = 0 },
            new ProductCategory { ProductId = "p_kj001", CategoryId = "cat_silk", IsPrimary = false, SortOrder = 1 });

        db.Collections.Add(new Collection
        {
            Id = "col_pongal",
            TenantId = "t1",
            Slug = "pongal-edit-2026",
            Title = "Pongal Edit 2026",
            Channel = "web",
            ActiveFrom = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero),
            ActiveTo = null
        });

        db.CollectionItems.Add(new CollectionItem
        {
            CollectionId = "col_pongal",
            ProductId = "p_kj001",
            SortOrder = 0,
            Pinned = true
        });

        db.ProductFacets.AddRange(
            new ProductFacet { ProductId = "p_kj001", AttributeDefId = "attr_color", AttributeValueId = "av_maroon" },
            new ProductFacet { ProductId = "p_kj001", AttributeDefId = "attr_border", AttributeValueId = "av_gold" });

        await db.SaveChangesAsync(ct);
    }
}
