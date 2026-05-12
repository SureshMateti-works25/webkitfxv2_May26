# Run Commerce.Api with dotnet watch — rebuilds and restarts when project sources change.
# Frees port 5055 first (same as api:commerce:exec:fresh) so the watch process can bind.
#
# From repo root: npm run api:commerce:watch
#
# Optional: -NoStop to skip freeing port 5055 first.

param(
    [switch] $NoStop
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent

if (-not $NoStop) {
    $stop = Join-Path $PSScriptRoot "stop-commerce-api.ps1"
    try {
        & $stop -Port 5055
    }
    catch {
        Write-Host "Could not free port 5055: $_" -ForegroundColor Red
        exit 1
    }
}

$apiDir = Join-Path $root "services/commerce-api/Commerce.Api"
$proj = Join-Path $apiDir "Commerce.Api.csproj"

$env:ASPNETCORE_ENVIRONMENT = "Development"
$env:ASPNETCORE_URLS = "http://localhost:5055"

Set-Location $apiDir
Write-Host "Commerce.Api watch → http://localhost:5055 (auto-restart on code changes; Ctrl+C to stop)" -ForegroundColor Green
dotnet watch run --project $proj -c Release --verbosity minimal
