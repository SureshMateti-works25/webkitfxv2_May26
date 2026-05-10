using Catalog.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Catalog.Api.Data;

public sealed class CatalogDbContext(DbContextOptions<CatalogDbContext> options) : DbContext(options)
{
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductCategory> ProductCategories => Set<ProductCategory>();
    public DbSet<Collection> Collections => Set<Collection>();
    public DbSet<CollectionItem> CollectionItems => Set<CollectionItem>();
    public DbSet<ProductFacet> ProductFacets => Set<ProductFacet>();
    public DbSet<AttributeDef> AttributeDefs => Set<AttributeDef>();
    public DbSet<AttributeValue> AttributeValues => Set<AttributeValue>();
    public DbSet<Location> Locations => Set<Location>();
    public DbSet<Sku> Skus => Set<Sku>();
    public DbSet<MediaAsset> MediaAssets => Set<MediaAsset>();
    public DbSet<ProductMediaRow> ProductMedia => Set<ProductMediaRow>();
    public DbSet<InventoryPosition> InventoryPositions => Set<InventoryPosition>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Tenant>(e =>
        {
            e.ToTable("tenants");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.Name).HasMaxLength(256).IsRequired();
            e.Property(x => x.Slug).HasMaxLength(128).IsRequired();
            e.HasIndex(x => x.Slug).IsUnique();
        });

        modelBuilder.Entity<Category>(e =>
        {
            e.ToTable("categories");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            e.Property(x => x.ParentId).HasMaxLength(64);
            e.Property(x => x.Slug).HasMaxLength(128).IsRequired();
            e.HasIndex(x => new { x.TenantId, x.Slug }).IsUnique();
            e.HasIndex(x => new { x.TenantId, x.ParentId });
        });

        modelBuilder.Entity<Product>(e =>
        {
            e.ToTable("products");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            e.Property(x => x.Slug).HasMaxLength(160).IsRequired();
            e.Property(x => x.TitleDisplay).HasMaxLength(512).IsRequired();
            e.Property(x => x.SearchText).HasMaxLength(2048);
            e.Property(x => x.Status).HasMaxLength(32).IsRequired();
            e.Property(x => x.HeroStorageKey).HasMaxLength(512);
            e.Property(x => x.Currency).HasMaxLength(8);
            e.HasIndex(x => new { x.TenantId, x.Slug }).IsUnique();
            e.HasIndex(x => new { x.TenantId, x.Status });
        });

        modelBuilder.Entity<ProductCategory>(e =>
        {
            e.ToTable("product_categories");
            e.HasKey(x => new { x.ProductId, x.CategoryId });
            e.Property(x => x.ProductId).HasMaxLength(64);
            e.Property(x => x.CategoryId).HasMaxLength(64);
            e.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Category).WithMany().HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => x.CategoryId);
        });

        modelBuilder.Entity<Collection>(e =>
        {
            e.ToTable("collections");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            e.Property(x => x.Slug).HasMaxLength(128).IsRequired();
            e.Property(x => x.Title).HasMaxLength(256).IsRequired();
            e.Property(x => x.Channel).HasMaxLength(32);
            e.HasIndex(x => new { x.TenantId, x.Slug }).IsUnique();
        });

        modelBuilder.Entity<CollectionItem>(e =>
        {
            e.ToTable("collection_items");
            e.HasKey(x => new { x.CollectionId, x.ProductId });
            e.Property(x => x.CollectionId).HasMaxLength(64);
            e.Property(x => x.ProductId).HasMaxLength(64);
            e.HasOne(x => x.Collection).WithMany().HasForeignKey(x => x.CollectionId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => x.ProductId);
        });

        modelBuilder.Entity<ProductFacet>(e =>
        {
            e.ToTable("product_facets");
            e.HasKey(x => new { x.ProductId, x.AttributeDefId, x.AttributeValueId });
            e.Property(x => x.ProductId).HasMaxLength(64);
            e.Property(x => x.AttributeDefId).HasMaxLength(64);
            e.Property(x => x.AttributeValueId).HasMaxLength(64);
            e.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.AttributeDefId, x.AttributeValueId });
        });

        modelBuilder.Entity<AttributeDef>(e =>
        {
            e.ToTable("attribute_defs");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            e.Property(x => x.Code).HasMaxLength(64).IsRequired();
            e.Property(x => x.LabelKey).HasMaxLength(128).IsRequired();
            e.Property(x => x.DisplayType).HasMaxLength(32);
            e.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
        });

        modelBuilder.Entity<AttributeValue>(e =>
        {
            e.ToTable("attribute_values");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.AttributeDefId).HasMaxLength(64).IsRequired();
            e.Property(x => x.Code).HasMaxLength(128).IsRequired();
            e.Property(x => x.LabelKey).HasMaxLength(128).IsRequired();
            e.Property(x => x.SwatchHex).HasMaxLength(16);
            e.HasOne(x => x.AttributeDef).WithMany().HasForeignKey(x => x.AttributeDefId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => x.AttributeDefId);
        });

        modelBuilder.Entity<Location>(e =>
        {
            e.ToTable("locations");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            e.Property(x => x.Code).HasMaxLength(64).IsRequired();
            e.Property(x => x.Name).HasMaxLength(256).IsRequired();
            e.Property(x => x.Type).HasMaxLength(32).IsRequired();
            e.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
        });

        modelBuilder.Entity<Sku>(e =>
        {
            e.ToTable("skus");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            e.Property(x => x.ProductId).HasMaxLength(64).IsRequired();
            e.Property(x => x.SkuCode).HasMaxLength(128).IsRequired();
            e.Property(x => x.Barcode).HasMaxLength(64);
            e.Property(x => x.Status).HasMaxLength(32).IsRequired();
            e.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.TenantId, x.SkuCode }).IsUnique();
            e.HasIndex(x => x.ProductId);
        });

        modelBuilder.Entity<MediaAsset>(e =>
        {
            e.ToTable("media_assets");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            e.Property(x => x.StorageKey).HasMaxLength(512).IsRequired();
            e.Property(x => x.MimeType).HasMaxLength(128).IsRequired();
            e.Property(x => x.Checksum).HasMaxLength(128);
            e.HasIndex(x => new { x.TenantId, x.StorageKey }).IsUnique();
        });

        modelBuilder.Entity<ProductMediaRow>(e =>
        {
            e.ToTable("product_media");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.ProductId).HasMaxLength(64).IsRequired();
            e.Property(x => x.MediaAssetId).HasMaxLength(64).IsRequired();
            e.Property(x => x.Role).HasMaxLength(32).IsRequired();
            e.Property(x => x.Locale).HasMaxLength(16);
            e.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.MediaAsset).WithMany().HasForeignKey(x => x.MediaAssetId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => x.ProductId);
            e.HasIndex(x => x.MediaAssetId);
        });

        modelBuilder.Entity<InventoryPosition>(e =>
        {
            e.ToTable("inventory_positions");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.SkuId).HasMaxLength(64).IsRequired();
            e.Property(x => x.LocationId).HasMaxLength(64).IsRequired();
            e.HasOne(x => x.Sku).WithMany().HasForeignKey(x => x.SkuId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Location).WithMany().HasForeignKey(x => x.LocationId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => x.SkuId);
            e.HasIndex(x => x.LocationId);
            e.HasIndex(x => new { x.SkuId, x.LocationId }).IsUnique();
        });
    }
}
