<#
.SYNOPSIS
  Wipe tenant t1 catalog + lookups on Azure Postgres, run Commerce.OneTimeSeed, optionally push /media to App Service.

.PARAMETER ConnectionString
  Azure Postgres Npgsql connection string. If omitted, uses env COMMERCE_DATABASE_CONNECTION_STRING or ConnectionStrings__Commerce.

.PARAMETER ResourceGroup / WebAppName
  When both are set, runs push-commerce-seed-media-to-azure.ps1 after seed using local uploads/media.

.EXAMPLE
  $env:COMMERCE_DATABASE_CONNECTION_STRING = "Host=....postgres.database.azure.com;..."
  .\scripts\reset-commerce-azure.ps1 -ResourceGroup rg-nistta-prod -WebAppName commerce-api-webkitfx-dev
#>
param(
    [string]$ConnectionString = "",
    [string]$ResourceGroup = "",
    [string]$WebAppName = "",
    [string]$TenantId = "t1",
    [switch]$SkipMediaPush
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot

& "$PSScriptRoot\stop-commerce-api.ps1" -Port 5055

if ([string]::IsNullOrWhiteSpace($ConnectionString)) {
    $ConnectionString = $env:COMMERCE_DATABASE_CONNECTION_STRING
    if ([string]::IsNullOrWhiteSpace($ConnectionString)) {
        $ConnectionString = $env:ConnectionStrings__Commerce
    }
}
if ([string]::IsNullOrWhiteSpace($ConnectionString)) {
    throw "Set -ConnectionString or COMMERCE_DATABASE_CONNECTION_STRING (Azure Postgres Npgsql)."
}

$mediaRoot = Join-Path $repoRoot "services\commerce-api\Commerce.Api\uploads\media"
New-Item -ItemType Directory -Path $mediaRoot -Force | Out-Null

$env:ConnectionStrings__Commerce = $ConnectionString.Trim()
$env:SEED_MEDIA_ROOT = (Resolve-Path -LiteralPath $mediaRoot).Path
$env:SEED_CLEAR_TENANT = "true"

Write-Host "Azure reset: clear tenant $TenantId + full demo seed (portal users kept)."
Write-Host "Target DB: $($ConnectionString.Substring(0, [Math]::Min(48, $ConnectionString.Length)))..."
dotnet run --project services/commerce-api/Commerce.OneTimeSeed/Commerce.OneTimeSeed.csproj -c Release
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Remove-Item Env:SEED_CLEAR_TENANT -ErrorAction SilentlyContinue

if (-not $SkipMediaPush -and $ResourceGroup -and $WebAppName) {
    Write-Host "Pushing seed media to App Service $WebAppName ..."
    & "$PSScriptRoot\push-commerce-seed-media-to-azure.ps1" `
        -ResourceGroup $ResourceGroup `
        -WebAppName $WebAppName `
        -LocalMediaRoot $env:SEED_MEDIA_ROOT
    Write-Host "Restart the Web App in Azure Portal so /media paths refresh."
}
else {
    Write-Host ""
    Write-Host "Media: deploy $env:SEED_MEDIA_ROOT to App Service wwwroot/uploads/media"
    Write-Host "  .\scripts\push-commerce-seed-media-to-azure.ps1 -ResourceGroup <rg> -WebAppName <app> -LocalMediaRoot `"$env:SEED_MEDIA_ROOT`""
    Write-Host "Or run GitHub Actions: Commerce Azure bootstrap (migrate + seed) with clear workflow / artifact upload."
}

Write-Host "Azure database reset + seed finished."
