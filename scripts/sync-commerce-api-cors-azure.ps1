# Keep Azure App Service *platform* CORS in sync with Commerce.Api appsettings.Production.json Cors:AllowedOrigins.
# ASP.NET also reads Cors__AllowedOrigins, but the App Service CORS list must include every SWA origin or browsers block fetch.
param(
    [string]$ResourceGroup = 'rg-nistta-prod',
    [string]$WebAppName = 'commerce-api-webkitfx-dev'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$prodJson = Join-Path $repoRoot 'services\commerce-api\Commerce.Api\appsettings.Production.json'
$cfg = Get-Content $prodJson -Raw | ConvertFrom-Json
$csv = [string]$cfg.Cors.AllowedOrigins
if ([string]::IsNullOrWhiteSpace($csv)) { throw 'Cors:AllowedOrigins missing in appsettings.Production.json' }

$origins = $csv -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ }
$current = (az webapp cors show --resource-group $ResourceGroup --name $WebAppName | ConvertFrom-Json).allowedOrigins

foreach ($origin in $origins) {
    if ($current -contains $origin) { continue }
    Write-Host "Adding CORS origin: $origin"
    az webapp cors add --resource-group $ResourceGroup --name $WebAppName --allowed-origins $origin | Out-Null
}

Write-Host ''
Write-Host 'Platform CORS origins:'
az webapp cors show --resource-group $ResourceGroup --name $WebAppName -o table
