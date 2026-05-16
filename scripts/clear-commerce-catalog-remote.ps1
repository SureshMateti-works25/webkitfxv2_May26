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
$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot

& "$PSScriptRoot\stop-commerce-api.ps1" -Port 5055

if ([string]::IsNullOrWhiteSpace($ConnectionString)) {
    $ConnectionString = $env:COMMERCE_DATABASE_CONNECTION_STRING
}
if ([string]::IsNullOrWhiteSpace($ConnectionString)) {
    Write-Host "Reading ConnectionStrings__Commerce from App Service $WebAppName ..."
    $ConnectionString = az webapp config appsettings list `
        --name $WebAppName --resource-group $ResourceGroup `
        --query "[?name=='ConnectionStrings__Commerce'].value" -o tsv
}
if ([string]::IsNullOrWhiteSpace($ConnectionString)) {
    throw "Set -ConnectionString or COMMERCE_DATABASE_CONNECTION_STRING."
}

function Get-PgEnvFromNpgsql([string]$cs) {
    $map = @{}
    foreach ($part in $cs -split ';') {
        if ([string]::IsNullOrWhiteSpace($part)) { continue }
        $i = $part.IndexOf('=')
        if ($i -lt 1) { continue }
        $k = $part.Substring(0, $i).Trim().ToLowerInvariant()
        $v = $part.Substring($i + 1).Trim()
        switch -Regex ($k) {
            '^host$' { $map['PGHOST'] = $v }
            '^port$' { $map['PGPORT'] = $v }
            '^database$' { $map['PGDATABASE'] = $v }
            '^username$' { $map['PGUSER'] = $v }
            '^password$' { $map['PGPASSWORD'] = $v }
            '^ssl\s*mode$' { $map['PGSSLMODE'] = ($v -replace '\s+', '').ToLowerInvariant() }
        }
    }
    if (-not $map['PGPORT']) { $map['PGPORT'] = '5432' }
    if (-not $map['PGSSLMODE']) { $map['PGSSLMODE'] = 'require' }
    return $map
}

function Remove-AzureAppServiceMedia([string]$ResourceGroup, [string]$WebAppName) {
    $hosts = az webapp show --resource-group $ResourceGroup --name $WebAppName --query "enabledHostNames" -o json | ConvertFrom-Json
    $scmHost = $hosts | Where-Object { $_ -match '\.scm\.' } | Select-Object -First 1
    if (-not $scmHost) { throw "Could not resolve SCM host for $WebAppName" }

    $pub = az webapp deployment list-publishing-credentials --resource-group $ResourceGroup --name $WebAppName -o json | ConvertFrom-Json
    $b64 = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("$($pub.publishingUserName):$($pub.publishingPassword)"))
    $hdr = @{ Authorization = "Basic $b64"; "If-Match" = "*" }

    $vfsBase = "https://$scmHost/api/vfs/site/wwwroot/uploads/media"
    $listUri = "$vfsBase/?recursive=true"
    try {
        $entries = Invoke-RestMethod -Uri $listUri -Headers $hdr -Method Get
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 404) {
            Write-Host "No uploads/media folder on App Service (already empty)."
            return
        }
        throw
    }

    $files = @($entries | Where-Object { $_.mime -ne 'inode/directory' })
    $dirs = @($entries | Where-Object { $_.mime -eq 'inode/directory' } | Sort-Object { $_.path.Length } -Descending)
    $n = 0
    foreach ($f in $files) {
        $rel = ($f.path -replace '\\', '/').TrimStart('/')
        if (-not $rel) { continue }
        $uri = if ($rel.StartsWith('site/wwwroot/')) { "https://$scmHost/api/vfs/$rel" } else { "$vfsBase/$rel" }
        Invoke-WebRequest -Uri $uri -Method Delete -Headers $hdr -UseBasicParsing | Out-Null
        $n++
    }
    foreach ($d in $dirs) {
        $rel = ($d.path -replace '\\', '/').TrimStart('/')
        if (-not $rel) { continue }
        $uri = if ($rel.StartsWith('site/wwwroot/')) { "https://$scmHost/api/vfs/$rel" } else { "$vfsBase/$($d.name)" }
        try {
            Invoke-WebRequest -Uri $uri -Method Delete -Headers $hdr -UseBasicParsing | Out-Null
        } catch { }
    }
    Write-Host "Removed $n media file(s) from App Service wwwroot/uploads/media."
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
    Remove-AzureAppServiceMedia -ResourceGroup $ResourceGroup -WebAppName $WebAppName
    az webapp restart --name $WebAppName --resource-group $ResourceGroup | Out-Null
    Write-Host "App Service restarted."
}

Write-Host "Done. Catalog and vendor/shopper users cleared for tenant $TenantId (admin users kept)."
