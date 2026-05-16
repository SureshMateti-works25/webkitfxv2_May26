# Repeatable local -> Azure catalog migration (your data, not demo seed):
#   1) export local Postgres + media to artifacts/commerce-migrate/latest
#   2) clear Azure tenant catalog + lookups, import CSVs, push media blobs
#
# Prerequisite: Azure Postgres reachable from this machine (VPN / public access + firewall).
# Orders: not in DB yet; when added, extend export tables to exclude order_* from migration.
param(
    [string]$TenantId = 't1',
    [string]$ExportDir = '',
    [string]$ConnectionString = '',
    [string]$ResourceGroup = 'rg-nistta-prod',
    [string]$WebAppName = 'commerce-api-webkitfx-dev',
    [switch]$ExportOnly,
    [switch]$ImportOnly,
    [switch]$SkipMedia
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot

if (-not $ImportOnly) {
    $exportArgs = @{ TenantId = $TenantId }
    if ($ExportDir) { $exportArgs['ExportDir'] = $ExportDir }
    & "$PSScriptRoot\export-commerce-catalog.ps1" @exportArgs
}

if (-not $ExportOnly) {
    $importArgs = @{
        TenantId       = $TenantId
        ResourceGroup  = $ResourceGroup
        WebAppName     = $WebAppName
        DisableAzureLookupBootstrap = $true
    }
    if ($ExportDir) { $importArgs['ExportDir'] = $ExportDir }
    if ($ConnectionString) { $importArgs['ConnectionString'] = $ConnectionString }
    if ($SkipMedia) { $importArgs['SkipMedia'] = $true }
    & "$PSScriptRoot\import-commerce-catalog.ps1" @importArgs
}

Write-Host ''
Write-Host 'Migration pipeline finished.'
