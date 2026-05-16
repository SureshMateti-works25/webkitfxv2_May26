# Repeatable pipeline: export local Docker Postgres + media, wipe Azure tenant data, import CSVs, push media.
# Does NOT run Commerce.OneTimeSeed demo data.
#
# Prerequisites:
#   - Local: docker compose Postgres up with your catalog (npm run docker:commerce-db)
#   - Azure: az login; firewall allows this machine to reach Azure Postgres
#
# Usage:
#   npm run reset:migrate:commerce:azure
#   npm run reset:migrate:commerce:azure -- -ExportOnly
param(
    [string]$TenantId = 't1',
    [string]$ExportDir = '',
    [string]$ConnectionString = '',
    [string]$ResourceGroup = 'rg-nistta-prod',
    [string]$WebAppName = 'commerce-api-webkitfx-dev',
    [switch]$ExportOnly,
    [switch]$ImportOnly,
    [switch]$SkipMedia,
    [switch]$SkipAzureClear
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot

& "$PSScriptRoot\stop-commerce-api.ps1" -Port 5055

if (-not $ImportOnly) {
    $exportArgs = @{ TenantId = $TenantId }
    if ($ExportDir) { $exportArgs['ExportDir'] = $ExportDir }
    & "$PSScriptRoot\export-commerce-catalog.ps1" @exportArgs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

if (-not $ExportOnly) {
    if (-not $SkipAzureClear) {
        & "$PSScriptRoot\clear-commerce-azure.ps1" `
            -TenantId $TenantId `
            -ConnectionString $ConnectionString `
            -ResourceGroup $ResourceGroup `
            -WebAppName $WebAppName `
            -SkipAppServiceMedia:($SkipMedia)
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }

    $importArgs = @{
        TenantId                    = $TenantId
        ResourceGroup               = $ResourceGroup
        WebAppName                  = $WebAppName
        DisableAzureLookupBootstrap = $true
        SkipClear                   = (-not $SkipAzureClear)
    }
    if ($ExportDir) { $importArgs['ExportDir'] = $ExportDir }
    if ($ConnectionString) { $importArgs['ConnectionString'] = $ConnectionString }
    if ($SkipMedia) { $importArgs['SkipMedia'] = $true }
    & "$PSScriptRoot\import-commerce-catalog.ps1" @importArgs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host ''
Write-Host 'Reset + migrate pipeline finished.'
