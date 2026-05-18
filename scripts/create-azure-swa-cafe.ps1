# Create (or show) Azure Static Web App for the café storefront — mirrors swa-groceries-dev.
# After create: set GitHub Actions secrets (deployment token) and push to develop to deploy.
#
# Usage:
#   .\scripts\create-azure-swa-cafe.ps1
#   .\scripts\create-azure-swa-cafe.ps1 -SetGitHubSecrets

param(
    [string]$ResourceGroup = 'rg-nistta-prod',
    [string]$SwaName = 'swa-cafe-dev',
    [string]$Location = 'eastasia',
    [switch]$SetGitHubSecrets
)

$ErrorActionPreference = 'Stop'

$existing = az staticwebapp show --name $SwaName --resource-group $ResourceGroup -o json 2>$null
if (-not $existing) {
    Write-Host "Creating Static Web App $SwaName in $ResourceGroup..." -ForegroundColor Cyan
    az staticwebapp create --name $SwaName --resource-group $ResourceGroup --location $Location --sku Free | Out-Null
}

$swa = az staticwebapp show --name $SwaName --resource-group $ResourceGroup -o json | ConvertFrom-Json
$hostName = $swa.defaultHostname
$hostSlug = ($hostName -replace '\.7\.azurestaticapps\.net$', '' -replace '-', '_').ToUpper()

Write-Host ""
Write-Host "Static Web App: $SwaName" -ForegroundColor Green
Write-Host "  URL:          https://$hostName"
Write-Host "  Resource grp: $ResourceGroup"
Write-Host ""
Write-Host "GitHub secrets to add (Settings → Secrets → Actions):" -ForegroundColor Yellow
Write-Host "  AZURE_STATIC_WEB_APPS_API_TOKEN_CAFE"
Write-Host "  AZURE_STATIC_WEB_APPS_API_TOKEN_${hostSlug}  (hostname workflow)"
Write-Host "  VITE_COMMERCE_API_URL  (same as groceries/sarees)"
Write-Host ""
Write-Host "Add SWA origin to Commerce.Api CORS (appsettings.Production.json):" -ForegroundColor Yellow
Write-Host "  https://$hostName"
Write-Host ""
Write-Host "Deploy: push to develop (apps/cafe/**) or run workflow 'Deploy Café (Azure SWA)'." -ForegroundColor Cyan

if ($SetGitHubSecrets) {
    $token = az staticwebapp secrets list --name $SwaName --resource-group $ResourceGroup --query 'properties.apiKey' -o tsv
    if (-not $token) { throw 'Could not read deployment token from Azure.' }
    $token | gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN_CAFE
    $secretHost = "AZURE_STATIC_WEB_APPS_API_TOKEN_$hostSlug"
    $token | gh secret set $secretHost
    Write-Host "Set GitHub secrets: AZURE_STATIC_WEB_APPS_API_TOKEN_CAFE and $secretHost" -ForegroundColor Green
}
