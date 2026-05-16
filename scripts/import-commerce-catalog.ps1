# Imports a catalog export (from export-commerce-catalog.ps1) into Azure Postgres.
# Clears tenant catalog + lookups on target first (keeps admin portal_users, audit_logs, tenants row).
# Does NOT run demo seed. Pushes media blobs when -PushMedia (default).
param(
    [string]$ExportDir = '',
    [string]$ConnectionString = '',
    [string]$TenantId = 't1',
    [string]$ResourceGroup = 'rg-nistta-prod',
    [string]$WebAppName = 'commerce-api-webkitfx-dev',
    [switch]$SkipClear,
    [switch]$SkipMedia,
    [switch]$DisableAzureLookupBootstrap
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\lib\commerce-pg.ps1"

$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot

if ([string]::IsNullOrWhiteSpace($ExportDir)) {
    $ExportDir = Join-Path $repoRoot 'artifacts\commerce-migrate\latest'
}
if (-not (Test-Path -LiteralPath $ExportDir)) {
    throw "Export folder not found: $ExportDir. Run: npm run export:commerce:catalog"
}
$ExportDir = (Resolve-Path -LiteralPath $ExportDir).Path
$dataDir = Join-Path $ExportDir 'data'
$manifestPath = Join-Path $ExportDir 'manifest.json'
if (-not (Test-Path $dataDir)) { throw "Missing data/ under $ExportDir" }

& "$PSScriptRoot\stop-commerce-api.ps1" -Port 5055

$ConnectionString = Resolve-CommerceAzureConnectionString -ConnectionString $ConnectionString `
    -ResourceGroup $ResourceGroup -WebAppName $WebAppName
if ([string]::IsNullOrWhiteSpace($ConnectionString)) {
    throw 'Set -ConnectionString or COMMERCE_DATABASE_CONNECTION_STRING, or sign in to Azure CLI.'
}

$pg = Get-PgEnvFromNpgsql $ConnectionString
Write-Host "Target: $($pg['PGHOST'])/$($pg['PGDATABASE']) tenant $TenantId"

if (-not $SkipClear) {
    Write-Host 'Clearing Azure catalog + lookups for tenant (admin users and audit_logs kept)...'
    $clearSql = Get-CommerceClearTenantCatalogSql -TenantId $TenantId
    Invoke-CommercePgDockerRun -PgEnv $pg -Sql $clearSql
}

$tableOrder = (Get-CommerceCatalogTableSpecs -TenantId $TenantId | ForEach-Object { $_.Name })
Write-Host 'Importing CSV rows (FK checks deferred)...'
Import-CommerceCatalogFromDir -PgEnv $pg -DataDir $dataDir -TableOrder $tableOrder

if ($DisableAzureLookupBootstrap -or -not $SkipClear) {
    Write-Host 'Setting Commerce__EnsureGroceryStorefrontAisles=false on App Service (no demo aisle re-insert on restart)...'
    az webapp config appsettings set `
        --name $WebAppName --resource-group $ResourceGroup `
        --settings Commerce__EnsureGroceryStorefrontAisles=false | Out-Null
}

if (-not $SkipMedia) {
    $mediaRoot = Join-Path $ExportDir 'media'
    if (Test-Path -LiteralPath $mediaRoot) {
        & "$PSScriptRoot\push-commerce-seed-media-to-azure.ps1" `
            -ResourceGroup $ResourceGroup `
            -WebAppName $WebAppName `
            -LocalMediaRoot $mediaRoot
    }
    else {
        Write-Warning "No media/ in export; skipping blob upload."
    }
}

Write-Host 'Restarting App Service...'
az webapp restart --name $WebAppName --resource-group $ResourceGroup | Out-Null

if (Test-Path $manifestPath) {
    Write-Host ''
    Write-Host 'Manifest:'
    Get-Content $manifestPath
}

Write-Host ''
Write-Host 'Import complete. Verify Azure storefront + Admin against exported manifest row counts.'
Write-Host 'Orders: not in Commerce.Api schema yet — when added, keep them Azure-only (exclude from export tables).'
