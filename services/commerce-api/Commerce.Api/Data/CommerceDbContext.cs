using Commerce.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Commerce.Api.Data;

public sealed class CommerceDbContext(DbContextOptions<CommerceDbContext> options) : DbContext(options)
{
    public DbSet<Tenant> Tenants => Set<Tenant>();
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
    public DbSet<PortalUser> PortalUsers => Set<PortalUser>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<LookupType> LookupTypes => Set<LookupType>();
    public DbSet<LookupValue> LookupValues => Set<LookupValue>();
    public DbSet<ProductEngagementSummary> ProductEngagementSummaries => Set<ProductEngagementSummary>();
    public DbSet<ProductRating> ProductRatings => Set<ProductRating>();
    public DbSet<ProductComment> ProductComments => Set<ProductComment>();
    public DbSet<StorefrontSponsoredProduct> StorefrontSponsoredProducts => Set<StorefrontSponsoredProduct>();
    public DbSet<ShopperCart> ShopperCarts => Set<ShopperCart>();
    public DbSet<ShopperCartLine> ShopperCartLines => Set<ShopperCartLine>();
    public DbSet<ShopperProductView> ShopperProductViews => Set<ShopperProductView>();
    public DbSet<StorefrontOrder> StorefrontOrders => Set<StorefrontOrder>();
    public DbSet<StorefrontOrderLine> StorefrontOrderLines => Set<StorefrontOrderLine>();
    public DbSet<TenantCustomRole> TenantCustomRoles => Set<TenantCustomRole>();
    public DbSet<PortalUserRoleAssignment> PortalUserRoleAssignments => Set<PortalUserRoleAssignment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Tenant>(e =>
        {
            e.ToTable("tenants");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.Name).HasMaxLength(256).IsRequired();
            e.Property(x => x.Slug).HasMaxLength(128).IsRequired();
            e.Property(x => x.StorefrontMode).HasMaxLength(32).IsRequired();
            e.Property(x => x.Vertical).HasMaxLength(32);
            e.Property(x => x.IsActive).HasDefaultValue(true);
            e.Property(x => x.CreatedAt).IsRequired();
            e.Property(x => x.HostAliasesJson);
            e.HasIndex(x => x.Slug).IsUnique();
            e.HasIndex(x => x.IsActive);
        });

        modelBuilder.Entity<Product>(e =>
        {
            e.ToTable("products");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            e.Property(x => x.VendorPortalUserId).HasMaxLength(64);
            e.Property(x => x.ProductTypeId).HasMaxLength(64);
            e.Property(x => x.CommerceJson);
            e.Property(x => x.Slug).HasMaxLength(160).IsRequired();
            e.Property(x => x.TitleDisplay).HasMaxLength(512).IsRequired();
            e.Property(x => x.SearchText).HasMaxLength(2048);
            e.Property(x => x.Status).HasMaxLength(32).IsRequired();
            e.Property(x => x.HeroStorageKey).HasMaxLength(512);
            e.Property(x => x.Currency).HasMaxLength(8);
            e.HasIndex(x => new { x.TenantId, x.Slug }).IsUnique();
            e.HasIndex(x => new { x.TenantId, x.Status });
            e.HasIndex(x => new { x.TenantId, x.VendorPortalUserId });
        });

        modelBuilder.Entity<ProductCategory>(e =>
        {
            e.ToTable("product_categories");
            e.HasKey(x => new { x.ProductId, x.CategoryId });
            e.Property(x => x.ProductId).HasMaxLength(64);
            e.Property(x => x.CategoryId).HasMaxLength(64);
            e.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.CategoryLookup).WithMany().HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.Cascade);
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
            e.Property(x => x.ListPriceMinor);
            e.Property(x => x.CompareAtPriceMinor);
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
            e.Property(x => x.SkuId).HasMaxLength(64);
            e.Property(x => x.MediaAssetId).HasMaxLength(64).IsRequired();
            e.Property(x => x.Role).HasMaxLength(64).IsRequired();
            e.Property(x => x.Locale).HasMaxLength(16);
            e.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Sku).WithMany().HasForeignKey(x => x.SkuId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.MediaAsset).WithMany().HasForeignKey(x => x.MediaAssetId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => x.ProductId);
            e.HasIndex(x => x.MediaAssetId);
            e.HasIndex(x => x.SkuId);
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

        modelBuilder.Entity<PortalUser>(e =>
        {
            e.ToTable("portal_users");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            e.Property(x => x.Email).HasMaxLength(256).IsRequired();
            e.Property(x => x.NormalizedEmail).HasMaxLength(256).IsRequired();
            e.Property(x => x.PasswordHash).HasMaxLength(512).IsRequired();
            e.Property(x => x.Role).HasMaxLength(32).IsRequired();
            e.Property(x => x.ProfileJson);
            e.Property(x => x.LoginDisabled).HasDefaultValue(false);
            e.Property(x => x.MustChangePassword).HasDefaultValue(false);
            e.HasIndex(x => new { x.TenantId, x.NormalizedEmail }).IsUnique();
        });

        modelBuilder.Entity<ProductEngagementSummary>(e =>
        {
            e.ToTable("product_engagement_summaries");
            e.HasKey(x => new { x.TenantId, x.ProductId });
            e.Property(x => x.TenantId).HasMaxLength(64);
            e.Property(x => x.ProductId).HasMaxLength(64);
            e.HasIndex(x => x.ProductId);
        });

        modelBuilder.Entity<ProductRating>(e =>
        {
            e.ToTable("product_ratings");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            e.Property(x => x.ProductId).HasMaxLength(64).IsRequired();
            e.Property(x => x.AuthorName).HasMaxLength(128);
            e.Property(x => x.CommentText).HasMaxLength(2048);
            e.HasIndex(x => new { x.TenantId, x.ProductId, x.CreatedAt });
        });

        modelBuilder.Entity<ProductComment>(e =>
        {
            e.ToTable("product_comments");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            e.Property(x => x.ProductId).HasMaxLength(64).IsRequired();
            e.Property(x => x.AuthorName).HasMaxLength(128);
            e.Property(x => x.CommentText).HasMaxLength(2048).IsRequired();
            e.HasIndex(x => new { x.TenantId, x.ProductId, x.CreatedAt });
        });

        modelBuilder.Entity<LookupType>(e =>
        {
            e.ToTable("lookup_types");
            e.HasKey(x => new { x.TenantId, x.Id });
            e.Property(x => x.TenantId).HasMaxLength(64);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.Title).HasMaxLength(256).IsRequired();
            e.Property(x => x.Description).HasMaxLength(1024);
            e.Property(x => x.ParentLookupTypeId).HasMaxLength(64);
            e.Property(x => x.ParentFieldLabel).HasMaxLength(128);
            e.Property(x => x.EntryIdPrefix).HasMaxLength(32).IsRequired();
            e.HasOne<LookupType>()
                .WithMany()
                .HasForeignKey(x => new { x.TenantId, x.ParentLookupTypeId })
                .HasPrincipalKey(x => new { x.TenantId, x.Id })
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<LookupValue>(e =>
        {
            e.ToTable("lookup_values");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            e.Property(x => x.LookupTypeId).HasMaxLength(64).IsRequired();
            e.Property(x => x.Code).HasMaxLength(128).IsRequired();
            e.Property(x => x.Label).HasMaxLength(512).IsRequired();
            e.Property(x => x.ParentValueId).HasMaxLength(64);
            e.Property(x => x.MerchandisingParentId).HasMaxLength(64);
            e.Property(x => x.ImageStorageKey).HasMaxLength(512);
            e.HasIndex(x => new { x.TenantId, x.LookupTypeId, x.Code }).IsUnique();
            e.HasIndex(x => x.ParentValueId);
            e.HasIndex(x => x.MerchandisingParentId);
            e.HasOne(x => x.LookupType)
                .WithMany()
                .HasForeignKey(x => new { x.TenantId, x.LookupTypeId })
                .HasPrincipalKey(x => new { x.TenantId, x.Id })
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.ParentValue)
                .WithMany()
                .HasForeignKey(x => x.ParentValueId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.MerchandisingParent)
                .WithMany()
                .HasForeignKey(x => x.MerchandisingParentId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<StorefrontSponsoredProduct>(e =>
        {
            e.ToTable("storefront_sponsored_products");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            e.Property(x => x.ProductId).HasMaxLength(64).IsRequired();
            e.Property(x => x.Label).HasMaxLength(160);
            e.HasIndex(x => new { x.TenantId, x.ProductId }).IsUnique();
            e.HasIndex(x => new { x.TenantId, x.SortOrder });
            e.HasOne<Product>().WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ShopperCart>(e =>
        {
            e.ToTable("shopper_carts");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            e.Property(x => x.PortalUserId).HasMaxLength(64).IsRequired();
            e.HasIndex(x => new { x.TenantId, x.PortalUserId }).IsUnique();
        });

        modelBuilder.Entity<ShopperCartLine>(e =>
        {
            e.ToTable("shopper_cart_lines");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.CartId).HasMaxLength(64).IsRequired();
            e.Property(x => x.ProductId).HasMaxLength(64).IsRequired();
            e.Property(x => x.SkuId).HasMaxLength(64);
            e.Property(x => x.Currency).HasMaxLength(8);
            e.Property(x => x.PackLabel).HasMaxLength(128);
            e.Property(x => x.PackUnitType).HasMaxLength(32);
            e.HasOne(x => x.Cart).WithMany(c => c.Lines).HasForeignKey(x => x.CartId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne<Product>().WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.CartId, x.ProductId, x.SkuId });
        });

        modelBuilder.Entity<ShopperProductView>(e =>
        {
            e.ToTable("shopper_product_views");
            e.HasKey(x => new { x.TenantId, x.PortalUserId, x.ProductId });
            e.Property(x => x.TenantId).HasMaxLength(64);
            e.Property(x => x.PortalUserId).HasMaxLength(64);
            e.Property(x => x.ProductId).HasMaxLength(64);
            e.HasIndex(x => new { x.TenantId, x.PortalUserId, x.ViewedAt });
        });

        modelBuilder.Entity<StorefrontOrder>(e =>
        {
            e.ToTable("storefront_orders");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            e.Property(x => x.ShopperPortalUserId).HasMaxLength(64);
            e.Property(x => x.ShopperEmail).HasMaxLength(256).IsRequired();
            e.Property(x => x.ShopperName).HasMaxLength(256);
            e.Property(x => x.ShopperPhone).HasMaxLength(32);
            e.Property(x => x.ProductTypeId).HasMaxLength(64).IsRequired();
            e.Property(x => x.OrderChannel).HasMaxLength(32);
            e.Property(x => x.TableCode).HasMaxLength(32);
            e.Property(x => x.Status).HasMaxLength(32).IsRequired();
            e.Property(x => x.FulfillmentStatus).HasMaxLength(32).IsRequired();
            e.Property(x => x.TrackingNote).HasMaxLength(512);
            e.Property(x => x.PaymentMethod).HasMaxLength(64).IsRequired();
            e.Property(x => x.PaymentStatus).HasMaxLength(32).IsRequired();
            e.Property(x => x.Currency).HasMaxLength(8).IsRequired();
            e.HasIndex(x => new { x.TenantId, x.PlacedAt });
            e.HasIndex(x => new { x.TenantId, x.ShopperPortalUserId, x.PlacedAt });
        });

        modelBuilder.Entity<StorefrontOrderLine>(e =>
        {
            e.ToTable("storefront_order_lines");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.OrderId).HasMaxLength(64).IsRequired();
            e.Property(x => x.ProductId).HasMaxLength(64).IsRequired();
            e.Property(x => x.SkuId).HasMaxLength(64);
            e.Property(x => x.SkuCode).HasMaxLength(64);
            e.Property(x => x.TitleDisplay).HasMaxLength(512).IsRequired();
            e.Property(x => x.VendorPortalUserId).HasMaxLength(64);
            e.Property(x => x.VendorCode).HasMaxLength(128);
            e.Property(x => x.Currency).HasMaxLength(8).IsRequired();
            e.HasOne(x => x.Order).WithMany(o => o.Lines).HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => x.OrderId);
        });

        modelBuilder.Entity<PortalUserRoleAssignment>(e =>
        {
            e.ToTable("portal_user_role_assignments");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            e.Property(x => x.PortalUserId).HasMaxLength(64).IsRequired();
            e.Property(x => x.RoleKey).HasMaxLength(48).IsRequired();
            e.Property(x => x.PortalBaseRole).HasMaxLength(16).IsRequired();
            e.Property(x => x.ScopeJson);
            e.Property(x => x.CreatedByUserId).HasMaxLength(64);
            e.HasIndex(x => new { x.TenantId, x.PortalUserId, x.RoleKey }).IsUnique();
            e.HasIndex(x => new { x.TenantId, x.PortalUserId, x.IsPrimary });
        });

        modelBuilder.Entity<TenantCustomRole>(e =>
        {
            e.ToTable("tenant_custom_roles");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.TenantId).HasMaxLength(64).IsRequired();
            e.Property(x => x.RoleKey).HasMaxLength(48).IsRequired();
            e.Property(x => x.DisplayName).HasMaxLength(120).IsRequired();
            e.Property(x => x.Description).HasMaxLength(512);
            e.Property(x => x.PermissionsJson).IsRequired();
            e.Property(x => x.CreatedByUserId).HasMaxLength(64);
            e.HasIndex(x => new { x.TenantId, x.RoleKey }).IsUnique();
        });

        modelBuilder.Entity<AuditLog>(e =>
        {
            e.ToTable("audit_logs");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.TenantId).HasMaxLength(64);
            e.Property(x => x.ActorUserId).HasMaxLength(64);
            e.Property(x => x.Action).HasMaxLength(64).IsRequired();
            e.Property(x => x.ResourceType).HasMaxLength(64);
            e.Property(x => x.ResourceId).HasMaxLength(128);
            e.Property(x => x.Outcome).HasMaxLength(32).IsRequired();
            e.Property(x => x.DetailJson);
            e.Property(x => x.ClientIp).HasMaxLength(45);
            e.Property(x => x.UserAgentSnippet).HasMaxLength(256);
            e.Property(x => x.RequestId).HasMaxLength(64);
            e.HasIndex(x => x.OccurredAt);
            e.HasIndex(x => new { x.TenantId, x.OccurredAt });
            e.HasIndex(x => new { x.Action, x.OccurredAt });
        });
    }
}
