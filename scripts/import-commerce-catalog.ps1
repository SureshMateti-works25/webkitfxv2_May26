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

$ExportDir = Get-CommerceMigrateExportDir -RepoRoot $repoRoot -ExportDir $ExportDir
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
    Write-Host 'Clearing Azure catalog + lookups for tenant (admin users, audit_logs, tenants row kept)...'
    $clearSql = Get-CommerceClearTenantCatalogSql -TenantId $TenantId
    Invoke-CommercePgDockerRun -PgEnv $pg -Sql $clearSql
    if (-not $SkipMedia) {
        Write-Host 'Wiping App Service media blobs before import...'
        Invoke-CommerceAzureAppServiceMediaWipe -ResourceGroup $ResourceGroup -WebAppName $WebAppName | Out-Null
    }
}

$tableOrder = (Get-CommerceCatalogTableSpecs -TenantId $TenantId | ForEach-Object { $_.Name })
Write-Host 'Importing CSV rows (insert order respects FKs; tenants row is not re-imported)...'
Import-CommerceCatalogFromDir -PgEnv $pg -DataDir $dataDir -TableOrder $tableOrder

if ($DisableAzureLookupBootstrap -or -not $SkipClear) {
    Set-CommerceAzureLookupBootstrap -Enabled $false -ResourceGroup $ResourceGroup -WebAppName $WebAppName
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

$azureCounts = Get-CommerceAzureTableCounts -PgEnv $pg -TenantId $TenantId
Write-Host ''
Write-Host 'Azure row counts after import:'
foreach ($key in @('lookup_types', 'lookup_values', 'products', 'media_assets')) {
    if ($azureCounts.ContainsKey($key)) {
        Write-Host "  $key`: $($azureCounts[$key])"
    }
}

if (Test-Path $manifestPath) {
    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
    $expectedLookups = ($manifest.tables | Where-Object { $_.name -eq 'lookup_values' }).rows
    if ($null -ne $expectedLookups -and $azureCounts.lookup_values -ne [int]$expectedLookups) {
        Write-Warning "lookup_values on Azure ($($azureCounts.lookup_values)) != export manifest ($expectedLookups)."
    }
}

Write-Host ''
Write-Host 'Import complete. Verify storefront/admin against manifest row counts.'
Write-Host 'Orders: not in Commerce.Api schema yet — when added, keep them Azure-only (exclude from export tables).'
