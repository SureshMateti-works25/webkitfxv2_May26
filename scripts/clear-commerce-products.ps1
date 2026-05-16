# Clears all catalog/product rows for tenant t1 (products, SKUs, media links, collections, attributes, inventory).
# Stops Commerce.Api first. Restart with Commerce:SkipProductReseed=true so demo products are not re-inserted.
param(
    [string]$TenantId = "t1",
    [switch]$DeleteProductMedia
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot

& "$PSScriptRoot\stop-commerce-api.ps1" -Port 5055

$container = "commerce-api-postgres-1"
$running = docker ps --filter "name=$container" --format "{{.Names}}" 2>$null
if (-not $running) {
    Write-Host "Starting Postgres..."
    docker compose -f services/commerce-api/docker-compose.yml up -d
    Start-Sleep -Seconds 3
}

$sql = @"
BEGIN;
DELETE FROM storefront_sponsored_products WHERE "TenantId" = '$TenantId';
DELETE FROM product_engagement_summaries WHERE "TenantId" = '$TenantId';
DELETE FROM product_ratings WHERE "TenantId" = '$TenantId';
DELETE FROM product_comments WHERE "TenantId" = '$TenantId';
DELETE FROM inventory_positions
  WHERE "SkuId" IN (SELECT "Id" FROM skus WHERE "TenantId" = '$TenantId');
DELETE FROM product_media
  WHERE "ProductId" IN (SELECT "Id" FROM products WHERE "TenantId" = '$TenantId');
DELETE FROM product_categories
  WHERE "ProductId" IN (SELECT "Id" FROM products WHERE "TenantId" = '$TenantId');
DELETE FROM collection_items
  WHERE "ProductId" IN (SELECT "Id" FROM products WHERE "TenantId" = '$TenantId');
DELETE FROM product_facets
  WHERE "ProductId" IN (SELECT "Id" FROM products WHERE "TenantId" = '$TenantId');
DELETE FROM skus WHERE "TenantId" = '$TenantId';
DELETE FROM products WHERE "TenantId" = '$TenantId';
DELETE FROM collection_items
  WHERE "CollectionId" IN (SELECT "Id" FROM collections WHERE "TenantId" = '$TenantId');
DELETE FROM collections WHERE "TenantId" = '$TenantId';
DELETE FROM attribute_values
  WHERE "AttributeDefId" IN (SELECT "Id" FROM attribute_defs WHERE "TenantId" = '$TenantId');
DELETE FROM attribute_defs WHERE "TenantId" = '$TenantId';
DELETE FROM locations WHERE "TenantId" = '$TenantId';
DELETE FROM media_assets WHERE "TenantId" = '$TenantId';
COMMIT;
"@

Write-Host "Clearing product catalog for tenant $TenantId..."
$sql | docker exec -i $container psql -U catalog -d catalog -v ON_ERROR_STOP=1

if ($DeleteProductMedia) {
    $mediaRoot = Join-Path $repoRoot "services\commerce-api\Commerce.Api\uploads\media\$TenantId"
    if (Test-Path $mediaRoot) {
        Get-ChildItem -Path $mediaRoot -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match '^p_' } |
            ForEach-Object {
                Write-Host "Removing $($_.FullName) ..."
                Remove-Item -Path $_.FullName -Recurse -Force
            }
    }
}

Write-Host "Done. products, skus, media_assets, collections, and related rows cleared for $TenantId."
Write-Host "Recommended: npm run reset:commerce:local  (clear + full seed + media in one step)"
Write-Host "Start API: npm run api:commerce:exec"
