# Wipes tenant t1 catalog + lookups in Azure Postgres and App Service media blobs.
# Does NOT run demo seed. Disables grocery aisle bootstrap on the Web App.
param(
    [string]$ConnectionString = '',
    [string]$TenantId = 't1',
    [string]$ResourceGroup = 'rg-nistta-prod',
    [string]$WebAppName = 'commerce-api-webkitfx-dev',
    [switch]$SkipAppServiceMedia
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\lib\commerce-pg.ps1"

$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot

& "$PSScriptRoot\stop-commerce-api.ps1" -Port 5055

$ConnectionString = Resolve-CommerceAzureConnectionString -ConnectionString $ConnectionString `
    -ResourceGroup $ResourceGroup -WebAppName $WebAppName
if ([string]::IsNullOrWhiteSpace($ConnectionString)) {
    throw 'Set -ConnectionString, COMMERCE_DATABASE_CONNECTION_STRING, or sign in to Azure CLI.'
}

$pg = Get-PgEnvFromNpgsql $ConnectionString
Write-Host "Target: $($pg['PGHOST'])/$($pg['PGDATABASE']) tenant $TenantId"

Write-Host 'Clearing Postgres catalog + lookups (admin portal users and tenants row kept)...'
Invoke-CommercePgDockerRun -PgEnv $pg -Sql (Get-CommerceClearTenantCatalogSql -TenantId $TenantId)

if (-not $SkipAppServiceMedia) {
    Invoke-CommerceAzureAppServiceMediaWipe -ResourceGroup $ResourceGroup -WebAppName $WebAppName | Out-Null
    az webapp restart --name $WebAppName --resource-group $ResourceGroup | Out-Null
    Write-Host 'App Service restarted.'
}

Set-CommerceAzureLookupBootstrap -Enabled $false -ResourceGroup $ResourceGroup -WebAppName $WebAppName

$counts = Get-CommerceAzureTableCounts -PgEnv $pg -TenantId $TenantId
Write-Host ''
Write-Host 'Remaining rows on Azure:'
foreach ($key in @('lookup_types', 'lookup_values', 'products', 'media_assets')) {
    if ($counts.ContainsKey($key)) { Write-Host "  $key`: $($counts[$key])" }
}
Write-Host 'Azure catalog + lookups cleared (no demo seed).'
