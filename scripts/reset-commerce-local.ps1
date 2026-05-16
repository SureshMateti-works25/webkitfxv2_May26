# Full local reset: clear tenant t1 catalog + lookups, reseed DB, rewrite demo /media JPEGs.
param(
    [string]$TenantId = "t1",
    [switch]$KeepMediaFiles
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot

& "$PSScriptRoot\stop-commerce-api.ps1" -Port 5055

$container = "commerce-api-postgres-1"
$running = docker ps --filter "name=$container" --format "{{.Names}}" 2>$null
if (-not $running) {
    Write-Host "Starting Postgres..."
    docker compose -f services/commerce-api/docker-compose.yml up -d
    Start-Sleep -Seconds 4
}

$mediaRoot = Join-Path $repoRoot "services\commerce-api\Commerce.Api\uploads\media"
$tenantMedia = Join-Path $mediaRoot $TenantId
if (-not $KeepMediaFiles -and (Test-Path $tenantMedia)) {
    Write-Host "Removing local media folder $tenantMedia ..."
    Remove-Item -Path $tenantMedia -Recurse -Force
}
New-Item -ItemType Directory -Path $mediaRoot -Force | Out-Null

$env:ConnectionStrings__Commerce = "Host=localhost;Port=54330;Database=catalog;Username=catalog;Password=catalog"
$env:SEED_MEDIA_ROOT = (Resolve-Path -LiteralPath $mediaRoot).Path
$env:SEED_CLEAR_TENANT = "true"

Write-Host "Resetting local Commerce (clear + seed) for tenant $TenantId ..."
dotnet run --project services/commerce-api/Commerce.OneTimeSeed/Commerce.OneTimeSeed.csproj -c Release

Remove-Item Env:SEED_CLEAR_TENANT -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Local reset complete."
Write-Host "  API:  npm run api:commerce:exec"
Write-Host "  Apps: npm run dev:commerce:apps  (or dev:groceries / dev:sarees)"
Write-Host "  Admin lookups + category tile images should match seeded storage keys under uploads/media/$TenantId/"
