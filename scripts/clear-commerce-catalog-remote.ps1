# Deletes tenant catalog data on Postgres: products, SKUs, media_assets, collections, attributes,
# engagement, inventory, product_categories links — and portal_users with role vendor/shopper.
# Does NOT delete lookup_types/values, tenants, or admin portal users.
# Optionally wipes App Service wwwroot/uploads/media blobs.
param(
    [string]$ConnectionString = "",
    [string]$TenantId = "t1",
    [string]$ResourceGroup = "rg-nistta-prod",
    [string]$WebAppName = "commerce-api-webkitfx-dev",
    [switch]$SkipAppServiceMedia
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib\commerce-pg.ps1"

$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot

& "$PSScriptRoot\stop-commerce-api.ps1" -Port 5055

$ConnectionString = Resolve-CommerceAzureConnectionString -ConnectionString $ConnectionString `
    -ResourceGroup $ResourceGroup -WebAppName $WebAppName
if ([string]::IsNullOrWhiteSpace($ConnectionString)) {
    throw "Set -ConnectionString or COMMERCE_DATABASE_CONNECTION_STRING."
}

$pg = Get-PgEnvFromNpgsql $ConnectionString
Write-Host "Target: $($pg['PGHOST'])/$($pg['PGDATABASE']) tenant $TenantId"

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
DELETE FROM portal_users WHERE "TenantId" = '$TenantId' AND LOWER("Role") IN ('vendor', 'shopper');
COMMIT;
SELECT 'products' AS what, COUNT(*)::text AS remaining FROM products WHERE "TenantId" = '$TenantId'
UNION ALL SELECT 'media_assets', COUNT(*)::text FROM media_assets WHERE "TenantId" = '$TenantId'
UNION ALL SELECT 'portal_users_vendor_shopper', COUNT(*)::text FROM portal_users WHERE "TenantId" = '$TenantId' AND LOWER("Role") IN ('vendor', 'shopper')
UNION ALL SELECT 'portal_users_admin', COUNT(*)::text FROM portal_users WHERE "TenantId" = '$TenantId' AND LOWER("Role") = 'admin';
"@

$sqlFile = Join-Path $env:TEMP "clear-catalog-$TenantId.sql"
Set-Content -Path $sqlFile -Value $sql -Encoding UTF8

$dockerArgs = @(
    'run', '--rm',
    '-e', "PGHOST=$($pg['PGHOST'])",
    '-e', "PGPORT=$($pg['PGPORT'])",
    '-e', "PGDATABASE=$($pg['PGDATABASE'])",
    '-e', "PGUSER=$($pg['PGUSER'])",
    '-e', "PGPASSWORD=$($pg['PGPASSWORD'])",
    '-e', "PGSSLMODE=$($pg['PGSSLMODE'])",
    '-v', "${sqlFile}:/clear.sql:ro",
    'postgres:16-alpine',
    'psql', '-v', 'ON_ERROR_STOP=1', '-f', '/clear.sql'
)
Write-Host "Deleting products, media rows, and vendor/shopper users from Postgres..."
& docker @dockerArgs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Remove-Item $sqlFile -Force -ErrorAction SilentlyContinue

if (-not $SkipAppServiceMedia) {
    Write-Host "Wiping App Service media blobs..."
    Invoke-CommerceAzureAppServiceMediaWipe -ResourceGroup $ResourceGroup -WebAppName $WebAppName | Out-Null
    az webapp restart --name $WebAppName --resource-group $ResourceGroup | Out-Null
    Write-Host "App Service restarted."
}

Write-Host "Done. Catalog and vendor/shopper users cleared for tenant $TenantId (admin users kept)."
