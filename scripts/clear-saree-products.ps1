# Deletes catalog rows for saree vertical only (products.product_type_id = pt_saree).
# Grocery and other product types are left intact.
param(
    [string]$TenantId = "t1",
    [string]$ProductTypeId = "pt_saree",
    [switch]$DeleteProductMedia
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot

$container = "commerce-api-postgres-1"
$running = docker ps --filter "name=$container" --format "{{.Names}}" 2>$null
if (-not $running) {
    Write-Host "Starting Postgres..."
    docker compose -f services/commerce-api/docker-compose.yml up -d
    Start-Sleep -Seconds 3
}

$escapedType = $ProductTypeId.Replace("'", "''")
$escapedTenant = $TenantId.Replace("'", "''")

$sql = @"
BEGIN;
DELETE FROM storefront_sponsored_products
  WHERE "TenantId" = '$escapedTenant'
    AND "ProductId" IN (SELECT "Id" FROM products WHERE "TenantId" = '$escapedTenant' AND "ProductTypeId" = '$escapedType');
DELETE FROM product_engagement_summaries
  WHERE "TenantId" = '$escapedTenant'
    AND "ProductId" IN (SELECT "Id" FROM products WHERE "TenantId" = '$escapedTenant' AND "ProductTypeId" = '$escapedType');
DELETE FROM product_ratings
  WHERE "TenantId" = '$escapedTenant'
    AND "ProductId" IN (SELECT "Id" FROM products WHERE "TenantId" = '$escapedTenant' AND "ProductTypeId" = '$escapedType');
DELETE FROM product_comments
  WHERE "TenantId" = '$escapedTenant'
    AND "ProductId" IN (SELECT "Id" FROM products WHERE "TenantId" = '$escapedTenant' AND "ProductTypeId" = '$escapedType');
DELETE FROM inventory_positions
  WHERE "SkuId" IN (
    SELECT s."Id" FROM skus s
    JOIN products p ON p."Id" = s."ProductId"
    WHERE p."TenantId" = '$escapedTenant' AND p."ProductTypeId" = '$escapedType'
  );
DELETE FROM product_media
  WHERE "ProductId" IN (SELECT "Id" FROM products WHERE "TenantId" = '$escapedTenant' AND "ProductTypeId" = '$escapedType');
DELETE FROM product_categories
  WHERE "ProductId" IN (SELECT "Id" FROM products WHERE "TenantId" = '$escapedTenant' AND "ProductTypeId" = '$escapedType');
DELETE FROM collection_items
  WHERE "ProductId" IN (SELECT "Id" FROM products WHERE "TenantId" = '$escapedTenant' AND "ProductTypeId" = '$escapedType');
DELETE FROM product_facets
  WHERE "ProductId" IN (SELECT "Id" FROM products WHERE "TenantId" = '$escapedTenant' AND "ProductTypeId" = '$escapedType');
DELETE FROM skus
  WHERE "ProductId" IN (SELECT "Id" FROM products WHERE "TenantId" = '$escapedTenant' AND "ProductTypeId" = '$escapedType');
DELETE FROM products WHERE "TenantId" = '$escapedTenant' AND "ProductTypeId" = '$escapedType';
COMMIT;
"@

Write-Host "Clearing $ProductTypeId products for tenant $TenantId..."
$sql | docker exec -i $container psql -U catalog -d catalog -v ON_ERROR_STOP=1

if ($DeleteProductMedia) {
    $mediaRoot = Join-Path $repoRoot "services\commerce-api\Commerce.Api\uploads\media\$TenantId"
    if (Test-Path $mediaRoot) {
        $productIds = @(
            docker exec $container psql -U catalog -d catalog -t -A -c `
                "SELECT ""Id"" FROM products WHERE ""TenantId"" = '$escapedTenant' AND ""ProductTypeId"" = '$escapedType';"
        ) | Where-Object { $_.Trim() }
        foreach ($pid in $productIds) {
            $dir = Join-Path $mediaRoot $pid.Trim()
            if (Test-Path $dir) {
                Write-Host "Removing $dir ..."
                Remove-Item -Path $dir -Recurse -Force
            }
        }
    }
}

$countSql = "SELECT COUNT(*) FROM products WHERE `"TenantId`" = '$escapedTenant' AND `"ProductTypeId`" = '$escapedType';"
$remaining = (docker exec $container psql -U catalog -d catalog -t -A -c $countSql 2>$null | Select-Object -First 1)
$count = if ($remaining) { $remaining.Trim() } else { "?" }
Write-Host "Done. Remaining $ProductTypeId products: $count"
